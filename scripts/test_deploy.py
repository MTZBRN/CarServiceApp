#!/usr/bin/python3 -I
"""Installed, root-owned TEST deploy entry point. Its only input is one approved SHA on stdin."""
import hashlib
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import uuid
from contextlib import closing

# Installed beside the reviewed ops_storage module; never import from the release checkout.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ops_storage as storage

RELEASE_BRANCH = "test-deploy"
PROJECT = "carserviceapp-test"
NETWORK = PROJECT + "_workshop"
BASE = Path("/opt/carserviceapp")
DATA, UPLOADS, BACKUPS = (BASE / name for name in ("test-data", "test-uploads", "test-backups"))
DB = DATA / "app.db"
ENV_FILE = BASE / ".env.test"
LIVE_COMPOSE = BASE / "test-compose/docker-compose.test.yml"
ETC = Path("/etc/carservice-test-deploy")
STATE = Path("/var/lib/carservice-test-deploy")
REPO = STATE / "source.git"
SERVICES = ("backend", "frontend")
SHA = re.compile(r"[0-9a-f]{40}")
PORTS = {"backend": {}, "frontend": {"8080/tcp": [{"HostIp": "127.0.0.1", "HostPort": "5174"}]}}


class Refused(ValueError):
    """Reasons are fixed operator messages, never command output or input values."""


def require(condition, reason):
    if not condition:
        raise Refused(reason)


def revision_from(line):
    require(re.fullmatch(r"[0-9a-f]{40}\n", line), "expected one full lowercase commit SHA")
    return line[:-1]


def trusted(path, private=False):
    storage.safe_path(path)
    for item in (path, *path.parents):
        st = item.stat()
        require(st.st_uid == 0 and not st.st_mode & 0o022, "unsafe runtime ownership or permissions")
    if private:
        require(not path.stat().st_mode & 0o077, "private file or directory required")


def capacity_requirements(pair_bytes):
    # Sum budgets when Docker, backup and scratch share a filesystem.
    gib = 1024 ** 3
    return ((BACKUPS, 2 * pair_bytes + gib),
            (Path("/var/tmp"), 2 * pair_bytes + gib), (STATE, 2 * gib))


def check_capacity(requirements):
    budgets = {}
    for path, needed in requirements:
        device = path.stat().st_dev
        total, free = budgets.get(device, (0, shutil.disk_usage(path).free))
        budgets[device] = (total + needed, min(free, shutil.disk_usage(path).free))
    require(all(free >= needed for needed, free in budgets.values()), "insufficient deployment disk reserve")


def validate_network(model, live_ipam):
    config = model["networks"]["workshop"]["ipam"]["config"]
    require(len(config) == 1 and len(live_ipam) == 1, "one TEST subnet required")
    subnet = ipaddress.ip_network(config[0]["subnet"])
    require(str(subnet) == live_ipam[0]["Subnet"] and subnet.version == 4, "live TEST subnet mismatch")
    addresses = [model["services"][s]["networks"]["workshop"]["ipv4_address"] for s in SERVICES]
    require(len(set(addresses)) == 2 and all(ipaddress.ip_address(a) in subnet
            and ipaddress.ip_address(a) not in (subnet.network_address, subnet.broadcast_address)
            and a != live_ipam[0].get("Gateway") for a in addresses), "invalid TEST service addresses")
    require(model["services"]["backend"]["environment"]["ReverseProxy__KnownProxies__0"] == addresses[1],
            "trusted proxy must be TEST frontend")


def preflight():
    """Local metadata/configuration checks; no fetch, DB reads or service mutations."""
    require(os.geteuid() == 0 and sys.version_info >= (3, 12), "requires root and Python 3.12+")
    for command in ("git", "gh", "docker", "sudo", "ssh", "tar"):
        require(shutil.which(command, path="/usr/sbin:/usr/bin:/sbin:/bin"), "required package missing")
    for p in (ETC, BASE, Path("/usr/local/sbin/carservice-test-deploy"),
              Path("/usr/local/sbin/ops_storage.py"), Path("/usr/local/sbin/carservice-test-ssh-gate")):
        trusted(p)
    for p in (STATE, STATE/"home", REPO, BACKUPS, ENV_FILE):
        trusted(p, private=True)
    for p in (STATE/"deploy.lock", STATE/"in-progress", ETC/"actions-enabled"):
        require(not p.is_symlink(), "linked runtime control file")
        if p.exists():
            trusted(p)
            require(p.is_file() and p.stat().st_nlink == 1, "unsafe runtime control file")
    require(not (STATE/"in-progress").exists(), "unfinished deployment requires local operator")
    frozen = ETC/"docker-compose.test.yml"
    trusted(frozen, private=True)
    # JSON is a YAML subset. Reject file-loading directives BEFORE Compose sees them.
    raw = json.loads(frozen.read_text())
    require(set(raw) == {"name", "services", "networks"}, "standalone JSON Compose required")
    require(set(raw["services"]) == set(SERVICES), "unexpected services")
    for service in raw["services"].values():
        require(not set(service).intersection({"build", "extends", "env_file", "label_file"}),
                "external Compose inputs forbidden")
    compose = ["docker", "compose", "--project-name", PROJECT, "--project-directory", str(ETC),
               "--env-file", str(ENV_FILE), "-f", str(frozen)]
    require("--wait" in run("docker", "compose", "up", "--help"), "Compose wait support required")
    model = json.loads(run(*compose, "config", "--format", "json", env={"APP_IMAGE_TAG":"preflight"}))
    validate_model(model, "preflight")
    validate_network(model, json.loads(run("docker", "network", "inspect", "-f", "{{json .IPAM.Config}}", NETWORK)))
    current = containers()
    protect_storage()
    pair_bytes = 0
    for root in (DATA, UPLOADS):
        for p in (root, *root.rglob("*")):
            s = p.stat()
            require(s.st_uid == 1654 and s.st_gid == 1654 and not s.st_mode & 0o022,
                    "TEST storage requires service ownership without group/other write")
            if stat.S_ISREG(s.st_mode):
                pair_bytes += s.st_size
    docker_root = Path(run("docker", "info", "--format", "{{.DockerRootDir}}"))
    require(docker_root.is_absolute(), "unexpected Docker data root")
    check_capacity((*capacity_requirements(pair_bytes), (docker_root, 10 * 1024**3)))
    require(all(c["status"] == "running" for c in current.values()), "TEST baseline not running")
    for c in current.values():
        require(run("docker", "inspect", "-f", "{{.State.Health.Status}}", c["id"]) == "healthy",
                "unhealthy baseline")


def run(*args, env=None, stdin=None, timeout=120):
    # Drop caller environment, command output and exception arguments from user-facing logs.
    clean = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "HOME": str(STATE/"home"), "LC_ALL": "C",
             "GIT_TERMINAL_PROMPT":"0", **(env or {})}
    result = subprocess.run(args, env=clean, stdin=stdin or subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=timeout, check=True)
    return result.stdout.decode().strip()


def validate_model(model, tag):
    require(model["name"] == PROJECT and set(model["services"]) == set(SERVICES), "unexpected TEST services")
    require(set(model["networks"]) == {"workshop"} and model["networks"]["workshop"]["name"] == NETWORK
            and not model["networks"]["workshop"].get("external"), "network is not TEST-owned")
    require(not any(model.get(k) for k in ("volumes", "configs", "secrets")), "unexpected shared resources")
    for name, s in model["services"].items():
        allowed = {"image","build","restart","expose","volumes","read_only","tmpfs","cap_drop","security_opt",
                   "mem_limit","cpus","pids_limit","networks","environment","ports","depends_on"}
        require(not set(s).difference(allowed), "unreviewed service option")
        require(s["image"] == f"{PROJECT}-{name}:{tag}", "image needs TEST-specific repository and tag")
        require(set(s["networks"]) == {"workshop"}, "unexpected service network")
        require(s.get("read_only") and not s.get("privileged") and s.get("cap_drop") == ["ALL"],
                "unexpected service privileges")
        require(s.get("security_opt") in (["no-new-privileges:true"], ["no-new-privileges=true"]),
                "no-new-privileges required")
        require(all(entry.split(":")[0] == "/tmp" for entry in s.get("tmpfs",[])), "unexpected tmpfs target")
        mounts = s.get("volumes", [])
        expected = {"/app/data": str(DATA), "/app/uploads": str(UPLOADS)} if name == "backend" else {}
        require(len(mounts) == len(expected) and all(m["type"] == "bind" and expected.get(m["target"]) == m["source"]
                and not m.get("bind", {}).get("create_host_path", True) for m in mounts), "unexpected TEST mounts")
        ports = s.get("ports", [])
        if name == "frontend":
            require(len(ports) == 1 and ports[0]["host_ip"] == "127.0.0.1" and str(ports[0]["published"]) == "5174"
                    and ports[0]["target"] == 8080 and ports[0].get("protocol","tcp") == "tcp", "unexpected frontend port")
        else:
            env = s["environment"]
            require(env.get("ASPNETCORE_ENVIRONMENT") == "Production" and env.get("DOTNET_ENVIRONMENT","Production") == "Production",
                    "TEST must run the hardened application configuration")
            require(not ports and env["ConnectionStrings__DefaultConnection"] == "Data Source=/app/data/app.db"
                    and env["Uploads__Path"] == "/app/uploads", "unexpected backend storage or ports")


def containers():
    result = {}
    # Metadata only. Never retrieve another project's env, logs or mounted file contents.
    fields = [".Id", '(index .Config.Labels "com.docker.compose.project")',
              '(index .Config.Labels "com.docker.compose.service")', ".Mounts", ".NetworkSettings.Networks", ".HostConfig.PortBindings",
              ".Image", ".State.Status"]
    template = "[" + ",".join("{{json " + field + "}}" for field in fields) + "]"
    for cid in run("docker","ps","-aq","--no-trunc").splitlines():
        ident, project, name, mounts, nets, ports, image, status = json.loads(run("docker","inspect","-f",template,cid))
        if project != PROJECT:
            for m in mounts:
                sources = [m.get("Source")]
                if m.get("Type") == "volume":
                    device = run("docker","volume","inspect","-f",'{{with .Options}}{{index . "device"}}{{end}}',m["Name"])
                    if device.startswith("/"):
                        sources.append(device)
                for source in filter(None,sources):
                    require(not any(storage.overlaps(Path(source), p) for p in (DATA,UPLOADS,BACKUPS)),
                            "another container shares TEST storage")
            require(NETWORK not in nets, "another project uses TEST network")
            continue
        require(name in SERVICES and name not in result and ident == cid, "unexpected TEST container")
        require(set(nets) == {NETWORK} and (ports or {}) == PORTS[name], "live TEST network/port mismatch")
        expected = {("/app/data", str(DATA)), ("/app/uploads", str(UPLOADS))} if name == "backend" else set()
        persistent = [m for m in mounts if not (m["Type"] == "tmpfs" and m["Destination"] == "/tmp")]
        require(len(persistent) == len(expected) and all(m["Type"] == "bind" and (m["Destination"], m["Source"]) in expected
                for m in persistent), "live TEST mount mismatch")
        result[name] = {"id":cid,"image":image,"status":status}
    require(set(result) == set(SERVICES), "expected an existing TEST installation with two services")
    owner = run("docker","network","inspect","-f",'{{index .Labels "com.docker.compose.project"}}',NETWORK)
    require(owner == PROJECT, "live network ownership mismatch")
    return result


def migration_state():
    with closing(storage.readonly(DB)) as con:
        return [row[0] for row in con.execute('SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId')]


def check_ci(sha):
    token = ETC / "actions-read.token"
    trusted(token, private=True)
    endpoint = ("repos/MTZBRN/CarServiceApp/actions/workflows/worksheet-ci.yml/runs"
                f"?branch={RELEASE_BRANCH}&event=push&head_sha={sha}&per_page=1")
    runs = json.loads(run("gh","api","--hostname","github.com",endpoint,
                          env={"GH_TOKEN":token.read_text().strip()}))["workflow_runs"]
    require(runs and all(runs[0].get(k) == v for k,v in {
        "head_sha":sha, "head_branch":RELEASE_BRANCH, "event":"push", "status":"completed",
        "conclusion":"success",
    }.items()), "no successful test-deploy CI for this exact revision")


def check_release(git, sha, approval, policy):
    trusted(approval, private=True)
    require(policy.get("branch") == RELEASE_BRANCH and policy.get("revision") == sha and SHA.fullmatch(sha)
            and json.loads(approval.read_text()) == policy, "revision lacks current TEST operator approval")
    ref = "refs/heads/" + RELEASE_BRANCH
    tracking = "refs/remotes/origin/" + RELEASE_BRANCH
    run(*git,"fetch","--no-tags","origin",f"+{ref}:{tracking}")
    require(run(*git,"rev-parse","--verify",tracking) == sha, "revision is not the current test-deploy tip")
    require(run(*git,"cat-file","-t",sha) == "commit", "expected commit")
    check_ci(sha)


def check_mount_layout():
    # Mount aliases can have innocent-looking paths; refuse host submounts and hard links.
    rows = [line.split() for line in Path("/proc/self/mountinfo").read_text().splitlines()]
    root = next(row for row in rows if row[4] == "/")
    def decoded(value):
        return Path(re.sub(r"\\([0-7]{3})", lambda m: chr(int(m[1],8)), value))
    for row in rows:
        mount = decoded(row[4])
        require(mount == Path("/") or not any(storage.overlaps(mount,p) for p in (DATA,UPLOADS,BACKUPS)),
                "TEST storage mount needs independent isolation review")
        if mount != Path("/") and row[2] == root[2]:
            require(not any(storage.overlaps(decoded(row[3]),decoded(root[3])/p.relative_to("/"))
                            for p in (DATA,UPLOADS,BACKUPS)), "TEST storage is aliased elsewhere")
    for root in (DATA, UPLOADS):
        storage.safe_path(root)
        require(root.is_dir(), "missing TEST storage")
    storage.safe_path(DB)
    require(DB.is_file() and DB.stat().st_nlink == 1, "existing isolated TEST database required")


def protect_storage():
    check_mount_layout()
    for root in (DATA, UPLOADS):
        for p in root.rglob("*"):
            require(not p.is_symlink() and (p.is_dir() or (p.is_file() and p.stat().st_nlink == 1)),
                    "unsafe TEST storage entry")


def smoke():
    for path, expected in (("/",200),("/api/Auth/me",401)):
        with closing(http.client.HTTPConnection("127.0.0.1",5174,timeout=10)) as conn:
            conn.request("GET",path)
            response = conn.getresponse()
            require(response.status == expected, "TEST smoke status failed")
            if path == "/":
                require(b'id="root"' in response.read(65536), "TEST SPA missing")


def deploy(sha):
    import fcntl
    require(os.geteuid() == 0 and sys.version_info >= (3,12), "requires installed root runtime, Python 3.12+")
    os.umask(0o077)
    preflight()
    trusted(ETC)
    for p in (STATE, STATE/"home", REPO, BACKUPS, ENV_FILE):
        trusted(p, private=True)
    trusted(BASE)
    approval = ETC / "approved.json"
    frozen = ETC / "docker-compose.test.yml"
    trusted(approval, private=True)
    trusted(frozen)
    policy = json.loads(approval.read_text())
    require(policy["migrations"] and policy["migrations"] == sorted(set(policy["migrations"])), "invalid migration inventory")
    # Read-only comparison; Compose never executes the worktree file or runs git in that worktree.
    require(storage.digest(frozen) == policy["frozen_compose_sha256"]
            and storage.digest(storage.safe_path(LIVE_COMPOSE)) == policy["compose_sha256"]
            and storage.digest(ENV_FILE) == policy["env_sha256"], "configuration approval mismatch")
    with (STATE / "deploy.lock").open("a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
        active = STATE / "in-progress"
        require(not active.exists(), "unfinished deployment requires local operator")
        git = ["git","--git-dir",str(REPO)]
        require(run(*git,"remote","get-url","origin") == "https://github.com/MTZBRN/CarServiceApp.git", "unexpected source")
        check_release(git, sha, approval, policy)
        run_id = uuid.uuid4().hex
        tag = sha + "-" + run_id
        images_file = STATE / (run_id+".images.json")
        images_file.write_text(json.dumps({"services":{
            name:{"image":f"{PROJECT}-{name}:{tag}"} for name in SERVICES}}))
        compose = ["docker","compose","--project-name",PROJECT,"--project-directory",str(ETC),
                   "--env-file",str(ENV_FILE),"-f",str(frozen),"-f",str(images_file)]
        def dc(*args, timeout=120):
            return run(*compose,*args,env={"APP_IMAGE_TAG":tag},timeout=timeout)
        model = json.loads(dc("config","--format","json"))
        validate_model(model,tag)
        check_mount_layout()
        previous = containers()
        require(all(c["status"] == "running" for c in previous.values()), "TEST baseline not running")
        smoke()
        for c in previous.values():
            require(run("docker","inspect","-f","{{.State.Health.Status}}",c["id"]) == "healthy",
                    "unhealthy baseline")
        record = {"revision":sha,"run":run_id,"previous":previous,"images":{}}
        journal = STATE / (run_id+".json")
        def checkpoint(stage):
            record["stage"] = stage
            draft = journal.with_suffix(".tmp")
            draft.write_text(json.dumps(record,sort_keys=True)+"\n")
            draft.replace(journal)
            print(f"TEST {run_id} {sha} {stage}",flush=True)
        active.write_text(run_id+"\n")
        checkpoint("building")
        for name, c in previous.items():
            c["rollback_tag"] = f"{PROJECT}-{name}:rollback-{run_id}"
            run("docker","image","tag",c["image"],c["rollback_tag"])
        for name, subtree in (("backend","Backend/CarServiceShop"),("frontend","Frontend")):
            with tempfile.TemporaryDirectory(dir=STATE) as tmp:
                archive = Path(tmp)/"source.tar"
                iid = Path(tmp)/"image.id"
                run(*git,"archive","--format=tar","--output="+str(archive),sha+":"+subtree)
                image = model["services"][name]["image"]
                with archive.open("rb") as source:
                    run("docker","build","--quiet","--iidfile",str(iid),"--label","org.opencontainers.image.revision="+sha,
                        "--tag",image,"-",stdin=source,timeout=1200)
                record["images"][name] = iid.read_text().strip()
        current = containers()
        require(all(current[n]["id"] == c["id"] and current[n]["status"] == "running"
                    for n,c in previous.items()), "TEST changed during build")
        check_release(git, sha, approval, policy)
        checkpoint("stopping")
        for name in ("frontend","backend"):
            run("docker","stop","--time","45",previous[name]["id"])
        stopped = containers()
        require(all(c["status"] == "exited" and c["id"] == previous[n]["id"] for n,c in stopped.items()), "writers not stopped")
        protect_storage()
        record["before_migrations"] = migration_state()
        require(record["before_migrations"] and policy["migrations"][:len(record["before_migrations"])] == record["before_migrations"],
                "database history diverged")
        checkpoint("backing-up")
        backup = storage.backup(DB,UPLOADS,BACKUPS,quiesced=True)
        record["backup"] = str(backup)
        checkpoint("verifying-backup")
        with tempfile.TemporaryDirectory(prefix="carservice-test-verify-",dir="/var/tmp") as tmp:
            storage.restore_test(backup,Path(tmp)/"carserviceapp-restore-test-pair")
        checkpoint("starting-backend")
        dc("up","-d","--no-build","--pull","never","--no-deps","--wait","--wait-timeout","180","backend",timeout=240)
        require(containers()["backend"]["image"] == record["images"]["backend"], "unexpected backend image")
        require(migration_state() == policy["migrations"], "unexpected migrated schema")
        before = storage.database_info(backup/"database.sqlite")
        after = storage.database_info(DB)
        require(all(after.get(table) == count for table,count in before.items() if table != "__EFMigrationsHistory"),
                "existing business table counts changed during migration")
        checkpoint("starting-frontend")
        dc("up","-d","--no-build","--pull","never","--no-deps","--wait","--wait-timeout","180","frontend",timeout=240)
        running = containers()
        require(all(c["status"] == "running" and c["image"] == record["images"][n] for n,c in running.items()),
                "running revision mismatch")
        smoke()
        checkpoint("healthy")
        active.unlink()


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 1, "no command-line arguments accepted")
        deploy(revision_from(sys.stdin.read(42)))
    except Exception as exc:
        # Child process messages, configuration and paths may contain credentials or customer data.
        reason = str(exc) if isinstance(exc,Refused) else type(exc).__name__
        print("TEST deployment refused or interrupted ("+reason+"); inspect the private local journal.",file=sys.stderr)
        sys.exit(1)
