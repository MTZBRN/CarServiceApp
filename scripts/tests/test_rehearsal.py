"""Offline checks of the rehearsal safety boundary and fictional migration."""
import importlib.util
from contextlib import closing
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT/"ops/test-deploy/rehearsal"


def load(name):
    spec = importlib.util.spec_from_file_location(name, FOLDER/(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


h = load("harness")
context = load("prepare_context")


class RehearsalTests(unittest.TestCase):
    def test_boundary_denies_external_interfaces_routes_and_credentials(self):
        header = "Iface Destination Gateway\n"
        h.validate_boundary("phase6e-disposable\n", ["lo", "br-fixture", "vethfixture"], header, {})
        for marker, interfaces, routes, env in [
            ("other", ["lo"], header, {}),
            ("phase6e-disposable\n", ["lo", "eth0"], header, {}),
            ("phase6e-disposable\n", ["lo"], header + "lo 00000000 01020304\n", {}),
            *[("phase6e-disposable\n", ["lo"], header, {key:"fixture"}) for key in
              ("DOCKER_HOST", "DOCKER_CONTEXT", "GH_TOKEN", "GITHUB_TOKEN", "SSH_AUTH_SOCK")],
        ]:
            with self.assertRaises(RuntimeError): h.validate_boundary(marker, interfaces, routes, env)

    def test_context_has_only_reviewed_files_and_refuses_existing_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)/"context"
            context.prepare(target)
            actual = {p.relative_to(target/"review").as_posix()
                      for p in (target/"review").rglob("*") if p.is_file()}
            self.assertEqual(actual, set(context.FILES))
            self.assertFalse(any(".git/" in p or ".env" in p or p.endswith(".db") for p in actual))
            with self.assertRaises(FileExistsError): context.prepare(target)

    def test_admission_adapter_fetches_only_local_synthetic_source(self):
        sha = "a"*40
        calls = []
        with patch.object(h, "real_run", return_value="fixture") as run:
            command = h.admission_adapter(sha, calls)
            command("git", "--git-dir", str(h.d.REPO), "fetch", "--no-tags", "origin",
                    "+refs/heads/test-deploy:refs/remotes/origin/test-deploy")
            self.assertEqual(run.call_args.args[5], str(h.SOURCE))
            with self.assertRaises(RuntimeError):
                command("git", "--git-dir", str(h.d.REPO), "fetch", "--no-tags", "https://external.invalid", "main")
            result = command("gh", "api", "--hostname", "github.com", "runs?head_sha="+sha+"&per_page=1")
            self.assertIn(sha, result)
            self.assertEqual(run.call_count, 1)
            with self.assertRaises(RuntimeError): command("gh", "api", "--hostname", "external.invalid", "x")

    def test_sqlite_fixture_migrates_and_really_fails(self):
        # Run the exact fixture startup code, ending before its HTTP server starts.
        code = (FOLDER/"fixture.py").read_text().split("class Handler")[0]
        for failure in (False, True):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp:
                base = Path(tmp)
                (base/"role").write_text("backend")
                (base/"generation").write_text("new")
                if failure: (base/"migration-fails").touch()
                dbfile = base/"app.db"
                with closing(sqlite3.connect(dbfile)) as db, db:
                    db.execute("CREATE TABLE __EFMigrationsHistory (MigrationId TEXT PRIMARY KEY, ProductVersion TEXT)")
                    db.execute("INSERT INTO __EFMigrationsHistory VALUES ('001_fixture','fixture')")
                def fixture_path(path):
                    return base/path.lstrip("/")
                real_connect = sqlite3.connect
                with patch("pathlib.Path", side_effect=fixture_path), \
                     patch("sqlite3.connect", side_effect=lambda _:real_connect(dbfile)), \
                     patch.object(sys, "argv", ["fixture.py"]):
                    if failure:
                        with self.assertRaises(sqlite3.OperationalError): exec(code, {})
                    else:
                        exec(code, {})
                with closing(real_connect(dbfile)) as db:
                    history = db.execute("SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId").fetchall()
                self.assertEqual(history, [("001_fixture",)] + ([] if failure else [("002_fixture",)]))

    def test_workflow_is_manual_hosted_and_has_no_deployment_credentials(self):
        workflow = (ROOT/".github/workflows/rehearse-test-deploy.yml").read_text()
        self.assertIn("runs-on: ubuntu-24.04", workflow)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("--privileged --network none", workflow)
        for prohibited in ("secrets.", "environment:", "self-hosted", "workflow_run:", "pull_request_target:",
                           "--mount", "--volume", "-v /", "TEST_DEPLOY_ENABLED=true", "sudo ssh"):
            # Comments do not configure a self-hosted runner or credentials.
            content = "\n".join(line for line in workflow.splitlines() if not line.lstrip().startswith("#"))
            self.assertNotIn(prohibited, content)
        self.assertIn("--approve-fixture-recovery", workflow)


if __name__ == "__main__":
    unittest.main()
