"""No Docker/systemd/network execution: every service operation is mocked."""
import json
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import orchestrate_backup as ops


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((Path(__file__).resolve().parents[2] / "ops/backup-staging.json").read_text())
        self.job = ops.Orchestrator(self.config)
        self.job.ids = {"backend": "backend-id", "frontend": "frontend-id"}
        self.job.original = dict.fromkeys(["backend", "frontend", "caddy"], True)
        self.calls = []

    def command(self, args, seconds=30):
        self.calls.append(args)
        if args[:2] == ["systemctl", "show"]:
            return "inactive"
        if args[0] == "curl":
            return "401" if args[-1].endswith("Customers") else "200"
        return ""

    def exercise(self, fail=None):
        def command(args, seconds=30):
            result = self.command(args, seconds)
            if args[0] == "bash" and fail:
                raise fail
            return result
        with patch.object(ops, "run", side_effect=command), patch.object(self.job, "state", return_value={"Running": False}), patch.object(self.job, "healthy"), patch.object(signal, "signal"):
            if fail:
                with self.assertRaises(type(fail)):
                    self.job.execute()
            else:
                self.job.execute()
        starts = [a[-1] for a in self.calls if "start" in a]
        self.assertEqual(starts, ["backend", "frontend", "caddy"])

    def test_success_order_and_quiesced(self):
        self.exercise()
        stops = [a[-1] for a in self.calls if "stop" in a]
        self.assertEqual(stops, ["caddy", "frontend", "backend"])
        self.assertIn("--quiesced", next(a for a in self.calls if a[0] == "bash"))

    def test_backup_failure_survives_recovery(self):
        self.exercise(ops.Failure("mock backup error"))

    def test_backup_timeout_survives_recovery(self):
        self.exercise(subprocess.TimeoutExpired("synthetic-backup", 900))

    def test_sigterm_and_sigint_recovery(self):
        for sig in [signal.SIGTERM, signal.SIGINT]:
            self.calls = []
            try:
                ops.interrupted(sig, None)
            except ops.Failure as error:
                self.exercise(error)

    def test_health_deadline(self):
        with patch.object(self.job, "state", return_value={"Running": True, "Health": {"Status": "unhealthy"}}), patch.object(ops.time, "monotonic", side_effect=[0, 0, 181]), patch.object(ops.time, "sleep"):
            with self.assertRaises(ops.Failure):
                self.job.healthy("backend")

    def test_failed_backend_health_still_attempts_frontend_and_caddy(self):
        with patch.object(ops, "run", side_effect=self.command), patch.object(self.job, "healthy", side_effect=ops.Failure("timeout")):
            with self.assertRaises(ops.Failure):
                self.job.recover()
        self.assertEqual([a[-1] for a in self.calls if "start" in a], ["backend", "frontend", "caddy"])

    def test_originally_stopped_services_stay_stopped(self):
        self.job.original = dict.fromkeys(self.job.original, False)
        with patch.object(ops, "run", side_effect=self.command), patch.object(self.job, "state", return_value={"Running": False}), patch.object(signal, "signal"):
            self.job.execute()
        self.assertFalse(any("start" in a or "stop" in a for a in self.calls))

    def test_partial_stop_failure_recovers(self):
        def command(args, seconds=30):
            value = self.command(args, seconds)
            if "stop" in args:
                raise ops.Failure("stop failed")
            return value
        with patch.object(ops, "run", side_effect=command), patch.object(self.job, "healthy"), patch.object(signal, "signal"):
            with self.assertRaises(ops.Failure):
                self.job.execute()
        self.assertEqual([a[-1] for a in self.calls if "start" in a], ["backend", "frontend", "caddy"])
        self.assertFalse(any(a[0] == "bash" for a in self.calls))

    def test_https_rejects_success_on_protected_route(self):
        with patch.object(ops, "run", return_value="200"):
            with self.assertRaises(ops.Failure):
                self.job.https()

    def test_readonly_preflight_and_mount_mismatch(self):
        self._preflight_checks()

    def test_own_backend_is_not_extra_writer_but_distinct_writer_is_rejected(self):
        self._preflight_checks(check_writers=True)

    def _preflight_checks(self, check_writers=False):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            c = dict(self.config)
            (root / "deploy-owned").mkdir()
            for key in ["compose_dir", "release", "uploads", "output"]:
                c[key] = str(root / "deploy-owned" / key) if key == "output" else str(root / key)
                Path(c[key]).mkdir()
            (root / "data").mkdir()
            for key, relative in [("db", "data/app.db"), ("env_file", "env"), ("lock", "lock")]:
                c[key] = str(root / relative)
                Path(c[key]).touch()
            for name in ["runtime.json", "identity.json"]:
                (Path(c["compose_dir"]) / name).touch()
            (Path(c["release"]) / "scripts").mkdir()
            for name in ["orchestrate_backup.py", "backup.sh", "ops_storage.py"]:
                (Path(c["release"]) / "scripts" / name).touch()
            (Path(c["compose_dir"]) / "identity.json").write_text(json.dumps({"project": c["project_name"], "services": {"backend": {"image": "backend-image"}, "frontend": {"image": "frontend-image"}}}))
            job = ops.Orchestrator(c)
            original_stat = Path.stat
            untrusted_helper = False
            def secure_stat(path, *args, **kwargs):
                s = original_stat(path, *args, **kwargs)
                return SimpleNamespace(st_uid=1000 if path.name == "deploy-owned" or (untrusted_helper and path.name == "ops_storage.py") else 0,
                                       st_mode=s.st_mode & ~0o077, st_size=s.st_size)
            bad_mount = False
            extra_writer = False
            container_ids = {"backend": "a" * 64, "frontend": "b" * 64}
            writer_id = "a" * 12 + "c" * 52  # Shared prefix must not bypass the guard.
            commands = []
            def command(args, seconds=30):
                commands.append(args)
                if args in [ops.DOCKER + ["ps", "--quiet"], ops.DOCKER + ["ps", "--no-trunc", "--quiet"]]:
                    ids = list(container_ids.values()) + ([writer_id] if extra_writer else [])
                    return "\n".join(ids if "--no-trunc" in args else [value[:12] for value in ids])
                if "--quiet" in args and "ps" in args:
                    return container_ids[args[-1]]
                if "{{json .State}}" in args:
                    return json.dumps({"Status": "running", "Running": True, "Health": {"Status": "healthy"}})
                if "{{json .Config.Env}}" in args:
                    return json.dumps(["ConnectionStrings__DefaultConnection=Data Source=/app/data/app.db", "Uploads__Path=/app/uploads"])
                if "{{json .Mounts}}" in args:
                    return json.dumps([{"Type": "bind", "RW": True, "Destination": target, "Source": source} for target, source in [("/app/data", "WRONG" if bad_mount else str(root / "data")), ("/app/uploads", c["uploads"])]])
                if "json" in args:
                    return json.dumps({"name": c["project_name"], "services": {"frontend": {"image": "frontend-image"}, "backend": {"image": "backend-image", "environment": {"ConnectionStrings__DefaultConnection": "Data Source=/app/data/app.db", "Uploads__Path": "/app/uploads"}, "volumes": [{"type": "bind", "target": "/app/data", "source": str(root / "data")}, {"type": "bind", "target": "/app/uploads", "source": c["uploads"]}]}}})
                if args[:2] == ["systemctl", "show"]:
                    return "active"
                if args[0] == "curl":
                    return "401" if args[-1].endswith("Customers") else "200"
                return ""
            before = sorted(str(p.relative_to(root)) for p in root.rglob("*"))
            with patch.object(ops.sys, "platform", "linux"), patch.object(ops.os, "geteuid", return_value=0, create=True), patch.object(Path, "stat", secure_stat), patch.object(ops.shutil, "which", return_value="tool"), patch.object(ops.shutil, "disk_usage", return_value=SimpleNamespace(free=10**12)), patch.object(ops, "run", side_effect=command), patch.object(ops.Orchestrator, "verify_identity"):
                job.preflight()
                self.assertIn(ops.DOCKER + ["ps", "--no-trunc", "--quiet"], commands)
                if check_writers:
                    extra_writer = True
                    with self.assertRaisesRegex(ops.Failure, "Additional container can write backup sources"):
                        job.preflight()
                    extra_writer = False
                untrusted_helper = True
                with self.assertRaisesRegex(ops.Failure, "Untrusted backup implementation"):
                    job.preflight()
                untrusted_helper = False
                bad_mount = True
                with self.assertRaisesRegex(ops.Failure, "mounts mismatch"):
                    job.preflight()
                bad_mount = False
                with patch.object(ops.shutil, "disk_usage", return_value=SimpleNamespace(free=0)):
                    with self.assertRaisesRegex(ops.Failure, "space"):
                        job.preflight()
            self.assertEqual(before, sorted(str(p.relative_to(root)) for p in root.rglob("*")))
            self.assertFalse(any("start" in a or "stop" in a or a[0] == "bash" for a in commands))

    def test_dry_run_never_executes_and_lock_contention_fails(self):
        path = MagicMock()
        path.parents = []
        path.stat.return_value = SimpleNamespace(st_uid=0, st_mode=0o100600)
        path.read_text.return_value = json.dumps(self.config)
        path.is_file.return_value = True
        locking = MagicMock()
        with patch.dict(sys.modules, {"fcntl": locking}), patch.object(ops, "safe_path", return_value=path), patch.object(sys, "argv", ["tool", "--config", "test", "--dry-run"]), patch.object(ops, "Orchestrator") as factory, patch.object(signal, "signal"):
            self.assertEqual(ops.main(), 0)
            factory.return_value.preflight.assert_called_once()
            factory.return_value.execute.assert_not_called()
            factory.reset_mock()
            locking.flock.side_effect = BlockingIOError()
            self.assertEqual(ops.main(), 1)
            factory.assert_not_called()

    def test_timeout_and_signal_kill_child_before_recovery(self):
        for error in [subprocess.TimeoutExpired("synthetic", 1), ops.Failure("Interrupted")]:
            child = MagicMock()
            child.communicate.side_effect = error
            child.poll.return_value = None
            child.pid = 123
            with patch.object(ops.subprocess, "Popen", return_value=child), patch.object(signal, "SIGKILL", 9, create=True), patch.object(ops.os, "killpg", create=True) as kill:
                with self.assertRaises(type(error)):
                    ops.run(["synthetic"], 1)
                kill.assert_called_once_with(123, signal.SIGKILL if hasattr(signal, "SIGKILL") else 9)
                child.wait.assert_called_once()


if __name__ == "__main__":
    unittest.main()
