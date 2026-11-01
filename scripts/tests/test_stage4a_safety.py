import copy
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stage4a_validate import choose_subnet, local_docker_command, png, require_local_engine, validate_config


class StagingSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="carserviceapp-stage4a-")
        self.root = Path(self.temp.name).resolve()
        hardening = {"read_only": True, "cap_drop": ["ALL"], "security_opt": ["no-new-privileges:true"]}
        self.config = {"networks": {"workshop": {}}, "services": {
            "backend": {**copy.deepcopy(hardening), "environment": {"ASPNETCORE_ENVIRONMENT": "Production", "ConnectionStrings__DefaultConnection": "Data Source=/app/data/app.db", "Uploads__Path": "/app/uploads"}, "volumes": [
                {"type": "bind", "source": str(self.root / "data"), "target": "/app/data"},
                {"type": "bind", "source": str(self.root / "uploads"), "target": "/app/uploads"}]},
            "frontend": {**copy.deepcopy(hardening), "ports": [{"host_ip": "127.0.0.1", "published": "15173", "target": 8080}]}}}
        for service in self.config["services"].values():
            service["networks"] = {"workshop": {}}

    def tearDown(self):
        self.temp.cleanup()

    def test_disposable_configuration_accepted(self):
        validate_config(self.config, self.root, 15173)

    def test_production_or_other_bind_refused(self):
        for source in ("/opt/carserviceapp/data", str(self.root.parent / "real-data")):
            invalid = copy.deepcopy(self.config)
            invalid["services"]["backend"]["volumes"][0]["source"] = source
            with self.subTest(source=source), self.assertRaises(ValueError):
                validate_config(invalid, self.root, 15173)

    def test_public_ports_and_backend_binding_refused(self):
        for service in ("backend", "frontend"):
            invalid = copy.deepcopy(self.config)
            invalid["services"][service]["ports"] = [{"host_ip": "0.0.0.0", "published": "15173", "target": 8080}]
            with self.subTest(service=service), self.assertRaises(ValueError):
                validate_config(invalid, self.root, 15173)

    def test_hardening_cannot_be_disabled(self):
        for key, value in (("read_only", False), ("cap_drop", []), ("security_opt", []), ("cap_add", ["SYS_ADMIN"])):
            invalid = copy.deepcopy(self.config)
            invalid["services"]["backend"][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_config(invalid, self.root, 15173)

    def test_named_volumes_and_development_environment_refused(self):
        invalid = copy.deepcopy(self.config)
        invalid["volumes"] = {"production": {}}
        with self.assertRaises(ValueError):
            validate_config(invalid, self.root, 15173)
        invalid = copy.deepcopy(self.config)
        invalid["services"]["backend"]["environment"]["ASPNETCORE_ENVIRONMENT"] = "Development"
        with self.assertRaises(ValueError):
            validate_config(invalid, self.root, 15173)
        invalid = copy.deepcopy(self.config)
        invalid["services"]["backend"]["environment"]["InitialAdmin__Password"] = "synthetic unexpected field"
        with self.assertRaises(ValueError):
            validate_config(invalid, self.root, 15173)
        invalid = copy.deepcopy(self.config)
        invalid["networks"]["unreviewed"] = {}
        with self.assertRaises(ValueError):
            validate_config(invalid, self.root, 15173)

    def test_remote_engines_refused(self):
        require_local_engine("unix:///var/run/docker.sock")
        for endpoint in ("ssh://example.invalid", "tcp://example.invalid:2376", "npipe:////./pipe/docker_engine", "unix://relative", "unix:///tmp/socket\n"):
            with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                require_local_engine(endpoint)

    def test_checked_socket_is_pinned_over_inherited_context(self):
        self.assertEqual(["docker", "--host", "unix:///var/run/docker.sock"], local_docker_command("unix:///var/run/docker.sock"))
        with self.assertRaises(ValueError):
            local_docker_command("ssh://example.invalid")

    def test_subnet_selection_avoids_existing_docker_networks(self):
        self.assertEqual("172.29.11.0/24", str(choose_subnet(["172.29.10.0/24"])))
        with self.assertRaises(ValueError):
            choose_subnet(["172.29.0.0/16"])

    def test_synthetic_image_is_png(self):
        self.assertTrue(png().startswith(b"\x89PNG\r\n\x1a\n"))


if __name__ == "__main__":
    unittest.main()
