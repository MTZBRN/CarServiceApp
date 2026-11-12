"""Offline checks of the rehearsal safety boundary and fictional migration."""
import importlib.util
import io
import json
import os
from contextlib import redirect_stdout
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
cg = load("cgroup_setup")
pd = load("preflight_diagnostics")


class RehearsalTests(unittest.TestCase):
    def test_preflight_diagnostics_reports_real_invariant_without_values(self):
        with patch.object(h.d, 'preflight', side_effect=h.d.Refused('unexpected TEST mounts')):
            self.assertEqual(pd.result(h.d), {'status':'refused', 'invariant':'unexpected TEST mounts'})
        for error in (h.d.Refused('SECRET-CANARY'), RuntimeError('SECRET-CANARY'),
                      subprocess.CalledProcessError(1, ['docker', 'SECRET-CANARY'], output=b'SECRET-CANARY')):
            with patch.object(h.d, 'preflight', side_effect=error):
                self.assertNotIn('SECRET-CANARY', json.dumps(pd.result(h.d)))
        with patch.object(h.d, 'preflight', return_value=None):
            self.assertEqual(pd.result(h.d), {'status':'passed'})

    def test_failed_installed_preflight_still_aborts_after_diagnostics(self):
        failure = subprocess.CalledProcessError(1, ['carservice-test-preflight'])
        calls = []
        def command(*args, **kwargs):
            calls.append(args)
            if len(args) == 1: raise failure
            return '{"status":"passed"}'
        with patch.object(h, 'provision', return_value='a'*40), patch.object(h, 'real_run', side_effect=command), \
             patch.object(h.d, 'containers') as containers, redirect_stdout(io.StringIO()):
            with self.assertRaises(subprocess.CalledProcessError) as caught: h.run_case('success')
        self.assertIs(caught.exception, failure)
        containers.assert_not_called()
        self.assertEqual([c[-1] for c in calls[1:]], ['installed', 'source'])
        self.assertTrue(all(c[:2] == ('python3', '-I') for c in calls[1:]))

    def test_cgroup_setup_requires_delegated_controllers(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'cgroup.controllers').write_text('cpu pids')
            with self.assertRaisesRegex(RuntimeError, 'unavailable'):
                cg.prepare(root)
            self.assertFalse((root/'init').exists())

    def test_cgroup_setup_moves_processes_before_enabling_controllers(self):
        calls = []
        def read(path):
            return {'cgroup.controllers':'cpu memory pids', 'cgroup.procs':'123 456',
                    'cgroup.subtree_control':'cpu memory pids'}[path.name]
        def write(path, value):
            calls.append((path.as_posix(), value))
        with patch.object(Path, 'read_text', read), patch.object(Path, 'write_text', write), patch.object(Path, 'mkdir'):
            cg.prepare(Path('/synthetic-cgroup'))
        self.assertEqual(calls, [('/synthetic-cgroup/init/cgroup.procs', '123'),
                                 ('/synthetic-cgroup/init/cgroup.procs', '456'),
                                 ('/synthetic-cgroup/cgroup.subtree_control', '+cpu +memory +pids')])

    def test_cgroup_setup_propagates_permission_errors(self):
        with patch.object(Path, 'read_text', return_value='cpu memory pids'), patch.object(Path, 'mkdir', side_effect=PermissionError):
            with self.assertRaises(PermissionError): cg.prepare()

    def test_cgroup_setup_does_not_ignore_missing_enforcement(self):
        def read(path):
            return 'cpu memory pids' if path.name == 'cgroup.controllers' else ''
        with patch.object(Path, 'read_text', read), patch.object(Path, 'write_text'), patch.object(Path, 'mkdir'), patch.object(cg.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'unable to enable'): cg.prepare()

    def test_cgroup_bootstrap_preserves_private_namespace_and_limits(self):
        entry = (FOLDER/'entry.sh').read_text()
        self.assertLess(entry.index('cgroup_setup.py'), entry.index('dockerd --'))
        self.assertIn('--exec-opt native.cgroupdriver=cgroupfs', entry)
        workflow = (ROOT/'.github/workflows/rehearse-test-deploy.yml').read_text()
        self.assertIn('--network none --cgroupns private', workflow)
        self.assertNotIn('--cgroupns host', workflow)
        model = json.loads((ROOT/'ops/test-deploy/docker-compose.test.yml').read_text())
        for service in model['services'].values():
            self.assertIn('mem_limit', service)
            self.assertIn('cpus', service)
            self.assertIn('pids_limit', service)
    def test_runtime_error_preserves_cause_but_not_secrets_paths_or_controls(self):
        message = 'OCI runtime create failed: open sysctl net.ipv4.ip_unprivileged_port_start: permission denied SECRET-CANARY /private/customer.db token=abc123\n\x1b'
        clean = h.diagnostic_text(message)
        self.assertIn('OCI runtime create failed', clean)
        self.assertIn('net.ipv4.ip_unprivileged_port_start', clean)
        self.assertIn('permission denied', clean)
        for secret in ('SECRET-CANARY', '/private/customer.db', 'abc123', '\n', '\x1b'):
            self.assertNotIn(secret, clean)
        self.assertEqual(h.diagnostic_text(None), '')

    def test_daemon_tail_is_bounded_and_sanitized(self):
        payload = b'secret-value\n' * 10000 + b'failed to create namespace: operation not permitted secret-value\n'
        with patch.object(Path, 'open', return_value=io.BytesIO(payload)):
            lines = h.daemon_diagnostics()
        self.assertEqual(len(lines), 40)
        self.assertIn('operation not permitted', lines[-1])
        self.assertNotIn('secret-value', ''.join(lines))

    def test_diagnostics_run_before_cleanup_even_on_failure(self):
        workflow = (ROOT/'.github/workflows/rehearse-test-deploy.yml').read_text()
        block = workflow.split('- name: Record sanitized runtime diagnostics before cleanup')[1].split('- name: Record synthetic evidence')[0]
        self.assertIn('if: always()', block)
        self.assertIn('harness.py diagnose', block)
        self.assertNotIn('daemon.log', block)
        self.assertLess(workflow.index('harness.py diagnose'), workflow.index('docker rm -f'))

    def test_fixture_metadata_permissions_are_explicit_for_both_service_users(self):
        for role, uid in (("backend", 1654), ("frontend", 101)):
            for generation in ("old", "new"):
                dockerfile = h.fixture_dockerfile(role, generation)
                self.assertIn("chmod 0644 /role /generation", dockerfile)
                self.assertLess(dockerfile.index("chmod 0644"), dockerfile.index(f"USER {uid}:{uid}"))
                self.assertIn('"/fixture.py", "health"', dockerfile)

    @unittest.skipUnless(os.name == "posix", "requires POSIX permission semantics")
    def test_exact_metadata_command_remains_readable_under_private_umask(self):
        for role in ("backend", "frontend"):
            with tempfile.TemporaryDirectory() as tmp:
                command = next(line[4:] for line in h.fixture_dockerfile(role, "old").splitlines()
                               if line.startswith("RUN "))
                command = command.replace("/role", "./role").replace("/generation", "./generation")
                subprocess.run(["sh", "-c", "umask 077; " + command], cwd=tmp, check=True)
                for name in ("role", "generation"):
                    self.assertEqual((Path(tmp)/name).stat().st_mode & 0o777, 0o644)

    def test_startup_diagnostics_discard_output_env_and_error_text(self):
        state = {"Status":"exited", "ExitCode":1, "Error":"SECRET-CANARY",
                 "Health":{"Status":"unhealthy", "Log":[{"ExitCode":1,"Output":"SECRET-CANARY"}]},
                 "Config":{"Env":["SECRET-CANARY"]}}
        output = io.StringIO()
        with patch.object(h, "real_run", side_effect=lambda *a: "fixture-id" if a[1] == "ps" else json.dumps(state)), redirect_stdout(output):
            h.startup_diagnostics()
        self.assertNotIn("SECRET-CANARY", output.getvalue())
        rows = json.loads(output.getvalue())["fixture_startup"]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["health_exit_codes"], [1])
        self.assertEqual(rows[0]["exit_code"], 1)

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
