import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import stat

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from freeze_backup_runtime import freeze, trusted_path
from orchestrate_backup import Orchestrator, Failure


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.config = {"name": "existing-staging", "services": {}, "networks": {"workshop": {"name": "existing-staging_workshop"}}}
        self.live = []
        for service in ["backend", "frontend"]:
            self.config["services"][service] = {"build": {"context": "/developer/checkout"}, "image": "old-tag", "environment": {"SECRET": "literal$value"}, "networks": {"workshop": {}}, "volumes": []}
            self.live.append({"Id": service+"-id", "Image": "sha256:"+service, "Config": {"Env": ["SECRET=literal$value"], "Labels": {"com.docker.compose.project": "existing-staging", "com.docker.compose.service": service}}, "Mounts": [], "NetworkSettings": {"Networks": {"existing-staging_workshop": {"NetworkID": "network-id"}}}})

    def test_freeze_keeps_identity_removes_build_and_escapes_credentials(self):
        runtime, identity = freeze(self.config, self.live)
        self.assertEqual(identity["project"], "existing-staging")
        self.assertEqual(runtime["services"]["backend"]["image"], "sha256:backend")
        self.assertNotIn("build", runtime["services"]["backend"])
        self.assertEqual(runtime["services"]["backend"]["environment"]["SECRET"], "literal$$value")
        self.assertTrue(runtime["networks"]["workshop"]["external"])

    def test_refuse_mismatched_project_environment_mounts_and_network(self):
        for kind in ["project", "env", "mount", "network"]:
            live = copy.deepcopy(self.live)
            if kind == "project": live[0]["Config"]["Labels"]["com.docker.compose.project"] = "other"
            if kind == "env": live[0]["Config"]["Env"] = []
            if kind == "mount": live[0]["Mounts"] = [{"Type": "bind", "Source": "/wrong", "Destination": "/app/data", "RW": True}]
            if kind == "network": live[0]["NetworkSettings"]["Networks"] = {}
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                freeze(copy.deepcopy(self.config), live)

    def test_changed_container_or_network_refused(self):
        _, identity = freeze(self.config, self.live)
        c = json.loads((Path(__file__).resolve().parents[2]/"ops/backup-staging.json").read_text())
        c["project_name"] = "existing-staging"
        job = Orchestrator(c)
        job.ids["backend"] = "backend-id"
        with patch("orchestrate_backup.run", return_value=json.dumps([self.live[0]])):
            job.verify_identity("backend", identity["services"]["backend"])
        for field in ["Id", "Image", "NetworkSettings"]:
            changed = copy.deepcopy(self.live[0])
            changed[field] = {"Networks": {}} if field == "NetworkSettings" else "changed"
            with patch("orchestrate_backup.run", return_value=json.dumps([changed])), self.assertRaises(Failure):
                job.verify_identity("backend", identity["services"]["backend"])

    def test_commands_explicitly_target_installed_runtime(self):
        c = json.loads((Path(__file__).resolve().parents[2]/"ops/backup-staging.json").read_text())
        job = Orchestrator(c)
        self.assertIn("--project-name", job.compose)
        self.assertNotIn("/opt/carserviceapp/compose", job.compose)
        self.assertTrue(job.compose[-1].endswith("/compose/runtime.json"))
        self.assertEqual(c["release"], "/var/lib/carserviceapp-backup/staging/r1")
        self.assertEqual(c["lock"], "/var/lib/carserviceapp-backup/maintenance.lock")
        self.assertEqual(c["output"], "/opt/carserviceapp/verified-backups")

    def test_packaging_checks_every_ancestor(self):
        path = Path.cwd() / "protected" / "staging" / "r1"
        with patch.object(Path, "lstat", return_value=SimpleNamespace(st_uid=0, st_mode=stat.S_IFDIR | 0o755)):
            self.assertEqual(trusted_path(path), path)
        for ancestor in [path, *path.parents]:
            for uid, mode in [(1000, stat.S_IFDIR | 0o750), (0, stat.S_IFDIR | 0o775), (0, stat.S_IFLNK | 0o777)]:
                def info(entry):
                    return SimpleNamespace(st_uid=uid if entry == ancestor else 0,
                                           st_mode=mode if entry == ancestor else stat.S_IFDIR | 0o755)
                with self.subTest(ancestor=ancestor, uid=uid, mode=mode), patch.object(Path, "lstat", info), self.assertRaises(ValueError):
                    trusted_path(path)
