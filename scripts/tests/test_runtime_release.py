import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from freeze_backup_runtime import freeze
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
