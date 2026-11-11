"""No daemon, network, credentials or customer data needed."""
import copy
import json
from contextlib import ExitStack
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import test_deploy as deploy


def model():
    common = {"networks":{"workshop":{}}, "read_only":True, "cap_drop":["ALL"],
              "security_opt":["no-new-privileges:true"]}
    backend = {**common,"image":"carserviceapp-test-backend:tag",
               "environment":{"ASPNETCORE_ENVIRONMENT":"Production","ConnectionStrings__DefaultConnection":"Data Source=/app/data/app.db",
                              "Uploads__Path":"/app/uploads"},
               "volumes":[{"type":"bind","target":target,"source":str(source),"bind":{"create_host_path":False}}
                          for target,source in (("/app/data",deploy.DATA),("/app/uploads",deploy.UPLOADS))]}
    frontend = {**common,"image":"carserviceapp-test-frontend:tag",
                "ports":[{"host_ip":"127.0.0.1","published":"5174","target":8080}]}
    return {"name":deploy.PROJECT,"networks":{"workshop":{"name":deploy.NETWORK}},
            "services":{"frontend":frontend,"backend":backend}}


class TestDeploymentGuards(unittest.TestCase):
    def test_runtime_ownership_and_private_modes(self):
        parent = Mock()
        path = Mock(parents=[parent])
        parent.stat.return_value = Mock(st_uid=0,st_mode=0o755)
        with patch.object(deploy.storage,"safe_path"):
            path.stat.return_value = Mock(st_uid=0,st_mode=0o600)
            deploy.trusted(path,private=True)
            for uid,mode in ((1000,0o600),(0,0o620),(0,0o644)):
                path.stat.return_value = Mock(st_uid=uid,st_mode=mode)
                with self.assertRaises(deploy.Refused): deploy.trusted(path,private=True)
            path.stat.return_value = Mock(st_uid=0,st_mode=0o600)
            parent.stat.return_value = Mock(st_uid=0,st_mode=0o775)
            with self.assertRaises(deploy.Refused): deploy.trusted(path)

    def test_preflight_failure_prevents_deployment_commands(self):
        with patch.dict(sys.modules,fcntl=Mock()), \
             patch.object(deploy.os,"geteuid",return_value=0,create=True), \
             patch.object(deploy,"preflight",side_effect=deploy.Refused("fixture")), \
             patch.object(deploy,"run") as command:
            with self.assertRaises(deploy.Refused): deploy.deploy("a"*40)
            command.assert_not_called()

    def test_capacity_aggregates_shared_filesystems(self):
        a, b = Mock(), Mock()
        a.stat.return_value.st_dev = b.stat.return_value.st_dev = 1
        with patch.object(deploy.shutil, "disk_usage", return_value=Mock(free=100)):
            deploy.check_capacity([(a, 50), (b, 50)])
            with self.assertRaises(deploy.Refused):
                deploy.check_capacity([(a, 60), (b, 60)])
            b.stat.return_value.st_dev = 2
            deploy.check_capacity([(a, 60), (b, 60)])

    def test_standalone_template_and_network(self):
        import re
        from pathlib import PurePosixPath
        raw = (Path(__file__).resolve().parents[2]/"ops/test-deploy/docker-compose.test.yml").read_text()
        values = {"APP_IMAGE_TAG":"tag", "TEST_SUBNET":"172.29.80.0/24",
                  "TEST_BACKEND_IP":"172.29.80.2", "TEST_FRONTEND_IP":"172.29.80.3",
                  "JWT_KEY":"synthetic", "JWT_ISSUER":"fixture", "JWT_AUDIENCE":"fixture"}
        config = json.loads(re.sub(r"\$\{([A-Z_]+):\?[^}]*\}", lambda m:values[m[1]], raw))
        with patch.object(deploy,"DATA",PurePosixPath("/opt/carserviceapp/test-data")), \
             patch.object(deploy,"UPLOADS",PurePosixPath("/opt/carserviceapp/test-uploads")):
            deploy.validate_model(config,"tag")
        ipam = [{"Subnet":"172.29.80.0/24", "Gateway":"172.29.80.1"}]
        deploy.validate_network(config,ipam)
        for subnet in ("172.29.81.0/24", "0.0.0.0/0"):
            with self.assertRaises(deploy.Refused):
                deploy.validate_network(config,[{"Subnet":subnet}])
        config["services"]["backend"]["environment"]["ReverseProxy__KnownProxies__0"] = "172.29.80.8"
        with self.assertRaises(deploy.Refused): deploy.validate_network(config,ipam)

    def test_registration_patch_contains_only_unchanged_dispatcher(self):
        root = Path(__file__).resolve().parents[2]
        text = (root/"ops/test-deploy/register-main.patch").read_text()
        self.assertEqual(text.count("+++ "),1)
        self.assertIn("+++ b/.github/workflows/deploy-test.yml\n",text)
        added = "".join(line[1:] for line in text.splitlines(keepends=True)
                        if line.startswith("+") and not line.startswith("+++"))
        self.assertEqual(added,(root/".github/workflows/deploy-test.yml").read_text())

    def test_backup_and_migration_gate_service_start(self):
        sha = "a"*40
        for failure in ("promotion during build", "backup-write", "backup", "migration", None):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
                root = Path(tmp)
                for name in ("ETC","STATE","REPO","BASE","BACKUPS"):
                    stack.enter_context(patch.object(deploy,name,root))
                stack.enter_context(patch.dict(sys.modules,fcntl=Mock(LOCK_EX=2,LOCK_NB=4)))
                stack.enter_context(patch.object(deploy.os,"geteuid",return_value=0,create=True))
                for name in ("preflight","trusted","check_mount_layout","protect_storage","smoke","check_ci"):
                    stack.enter_context(patch.object(deploy,name))
                stack.enter_context(patch.object(deploy.storage,"safe_path",side_effect=lambda p:p))
                stack.enter_context(patch.object(deploy.storage,"digest",return_value="digest"))
                stack.enter_context(patch.object(deploy.storage,"database_info",return_value={"ServiceJobs":1}))
                (root/"approved.json").write_text(json.dumps({"branch":"test-deploy","revision":sha,"compose_sha256":"digest",
                    "frozen_compose_sha256":"digest","env_sha256":"digest","migrations":["001","002"]}))
                events = []
                live = {n:{"id":n,"status":"running","image":"old-"+n} for n in deploy.SERVICES}
                stack.enter_context(patch.object(deploy,"containers",side_effect=lambda:copy.deepcopy(live)))
                stack.enter_context(patch.object(deploy,"migration_state",
                    side_effect=[["001"], ["001"] if failure=="migration" else ["001","002"]]))
                stack.enter_context(patch.object(deploy.storage,"backup",return_value=root/"pair",
                    side_effect=ValueError("fixture backup failure") if failure == "backup-write" else None))
                def restore(*args):
                    events.append("restore")
                    if failure=="backup": raise ValueError("bad backup")
                stack.enter_context(patch.object(deploy.storage,"restore_test",side_effect=restore))
                def command(*args, **kwargs):
                    if "get-url" in args: return "https://github.com/MTZBRN/CarServiceApp.git"
                    if "rev-parse" in args:
                        if failure == "promotion during build" and (root/"in-progress").exists(): return "b"*40
                        return sha
                    if "cat-file" in args: return "commit"
                    if "config" in args:
                        config = model()
                        for name,svc in config["services"].items():
                            svc["image"] = f'{deploy.PROJECT}-{name}:'+kwargs["env"]["APP_IMAGE_TAG"]
                        return json.dumps(config)
                    if "inspect" in args: return "healthy"
                    if "archive" in args: Path(next(a[9:] for a in args if a.startswith("--output="))).touch()
                    if "build" in args: Path(args[args.index("--iidfile")+1]).write_text("new")
                    if "stop" in args:
                        events.append("stop-"+args[-1])
                        live[args[-1]]["status"]="exited"
                    if "up" in args:
                        events.append("up-"+args[-1])
                        live[args[-1]].update(image="new",status="running")
                    return ""
                stack.enter_context(patch.object(deploy,"run",side_effect=command))
                # Use a private disposable directory for the simulated restore scratch space.
                temporary = tempfile.TemporaryDirectory
                stack.enter_context(patch.object(deploy.tempfile,"TemporaryDirectory",
                    side_effect=lambda **kw:temporary(dir=root)))
                if failure:
                    with self.assertRaises(ValueError): deploy.deploy(sha)
                else: deploy.deploy(sha)
                expected = ["stop-frontend","stop-backend","restore"]
                if failure == "backup-write": expected.remove("restore")
                if failure not in ("backup", "backup-write"): expected.append("up-backend")
                if not failure: expected.append("up-frontend")
                self.assertEqual(events, [] if failure == "promotion during build" else expected)
                self.assertEqual((root/"in-progress").exists(),bool(failure))

    def test_release_uses_only_the_reviewed_current_promotion_tip(self):
        sha = "a"*40
        other = "b"*40
        policy = {"branch":"test-deploy", "revision":sha}
        for case,tip,receipt,current,allowed in [
            ("reviewed final merge or cherry-pick",sha,policy,policy,True),
            ("main-only object",other,policy,policy,False),
            ("feature-only object",other,policy,policy,False),
            ("old test-deploy ancestor",other,policy,policy,False),
            ("feature SHA before cherry-pick",other,policy,policy,False),
            ("approved parent of final merge",sha,{**policy,"revision":other},policy,False),
            ("legacy main receipt",sha,{"revision":sha},{"revision":sha},False),
            ("other branch approval",sha,{**policy,"branch":"main"},policy,False),
            ("approval revoked while waiting",sha,policy,{**policy,"revision":other},False),
        ]:
            def git(*args):
                if args[1]=="fetch":
                    self.assertEqual(args[2:],("--no-tags","origin","+refs/heads/test-deploy:refs/remotes/origin/test-deploy"))
                    return ""
                if args[1]=="rev-parse":
                    self.assertEqual(args[2:],("--verify","refs/remotes/origin/test-deploy"))
                    return tip
                self.assertEqual(args[1:],("cat-file","-t",sha))
                return "commit"
            with self.subTest(case=case), patch.object(deploy,"trusted"), patch.object(deploy,"run",side_effect=git), \
                    patch.object(Path,"read_text",return_value=json.dumps(current)), patch.object(deploy,"check_ci") as ci:
                if allowed:
                    deploy.check_release(["git"],sha,Path("approval"),receipt)
                    ci.assert_called_once_with(sha)
                else:
                    with self.assertRaises(deploy.Refused):
                        deploy.check_release(["git"],sha,Path("approval"),receipt)
                    ci.assert_not_called()

    def test_revision_grammar(self):
        sha = "a"*40
        self.assertEqual(deploy.revision_from(sha+"\n"),sha)
        for value in ["main",sha+";id",sha+"\n\n",sha.upper(),"-"*40, "../deploy",sha+"\nrun"]:
            with self.assertRaises(ValueError): deploy.revision_from(value)

    def test_compose_resource_guards(self):
        deploy.validate_model(model(),"tag")
        for path,value in [
            (["name"],"staging"), (["services","worker"],{}),
            (["networks","workshop","external"],True),
            (["services","backend","volumes",0,"source"],"/opt/carserviceapp/prod-data"),
            (["services","backend","volumes",1,"source"],"/opt/carserviceapp/prod-uploads"),
            (["services","backend","volumes",1,"bind","create_host_path"],True),
            (["services","backend","image"],"shared:latest"),
            (["services","frontend","ports",0,"host_ip"],"0.0.0.0"),
            (["services","frontend","ports",0,"published"],"5173"),
            (["services","backend","privileged"],True), (["services","backend","pid"],"host"),
            (["services","backend","tmpfs"],["/app/data"]),
            (["services","backend","environment","DOTNET_ENVIRONMENT"],"Development"),
            (["services","backend","environment","Uploads__Path"],"/elsewhere"),
            (["services","backend","security_opt"],["apparmor:unconfined"])]:
            with self.subTest(path=path):
                config = model()
                node = config
                for key in path[:-1]: node = node[key]
                node[path[-1]] = value
                with self.assertRaises(ValueError): deploy.validate_model(config,"tag")

    def test_live_topology(self):
        backend = ["b",deploy.PROJECT,"backend",[
            {"Type":"bind","Source":str(deploy.DATA),"Destination":"/app/data"},
            {"Type":"bind","Source":str(deploy.UPLOADS),"Destination":"/app/uploads"}],
            {deploy.NETWORK:{}},{}, "sha256:old-b","running"]
        frontend = ["f",deploy.PROJECT,"frontend",[],{deploy.NETWORK:{}},deploy.PORTS["frontend"],"sha256:old-f","running"]
        other = ["s","staging","backend",[{"Type":"bind","Destination":"/app/data","Source":"/opt/carserviceapp/prod-data"}],
                 {"staging_workshop":{}},{}, "sha256:staging","running"]
        def inspect(rows):
            def command(*args):
                if args[1]=="ps": return "\n".join(rows)
                if args[1]=="network": return deploy.PROJECT
                return json.dumps(rows[args[-1]])
            with patch.object(deploy,"run",side_effect=command):
                return deploy.containers()
        rows = {"b":backend,"f":frontend,"s":other}
        self.assertEqual(set(inspect(rows)),set(deploy.SERVICES))
        for container,index,value in [
            ("s",3,[{"Source":str(deploy.BASE)}]), ("s",3,[{"Source":str(deploy.BACKUPS)}]),
            ("s",4,{deploy.NETWORK:{}}), ("b",3,other[3]), ("f",5,{}), ("b",2,"frontend")]:
            changed = copy.deepcopy(rows)
            changed[container][index] = value
            with self.assertRaises(ValueError): inspect(changed)

    def test_ci_requires_exact_successful_push(self):
        sha = "a"*40
        good = {"head_sha":sha,"head_branch":"test-deploy","event":"push","status":"completed","conclusion":"success"}
        with patch.object(deploy,"trusted"), patch.object(Path,"read_text",return_value="fixture"):
            for change in [None, {"head_sha":"b"*40},{"event":"pull_request"},{"status":"in_progress"},
                           {"conclusion":"skipped"},{"head_branch":"main"},{"head_branch":"feature/x"}]:
                with patch.object(deploy,"run",return_value=json.dumps({"workflow_runs":[{**good,**(change or {})}]})):
                    if change:
                        with self.assertRaises(ValueError): deploy.check_ci(sha)
                    else: deploy.check_ci(sha)
