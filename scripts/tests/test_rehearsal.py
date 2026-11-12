"""Offline checks of the rehearsal safety boundary and fictional migration."""
import importlib.util
import copy
import http.server
import io
import json
import os
from contextlib import redirect_stdout, ExitStack
from contextlib import closing
from pathlib import Path
import sqlite3
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch, Mock

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
compat = load("compose_compat")


class LocalPipeline:
    """Real helper/admission/journals/SQLite/backup/recovery; simulated Docker + OS.

    These contract tests cannot establish Linux isolation, image builds or health.
    The workflow still runs the unmodified real deployment against real Docker.
    """
    def __init__(self, root, stack, scenario, fault=None):
        self.root, self.scenario, self.fault = root, scenario, fault
        self.sha = 'a' * 40
        self.events = []
        self.fetches = 0
        self.failure = subprocess.CalledProcessError(19, ['SECRET-CANARY'], output=b'SECRET-CANARY')
        self.live = {n: {'id': 'old-' + n, 'image': 'old-image-' + n, 'status': 'running'} for n in h.d.SERVICES}
        self.tags = {}
        for name, path in {'BASE': root, 'ETC': root/'etc', 'STATE': root/'state',
                           'REPO': root/'state/source.git', 'DATA': root/'data',
                           'UPLOADS': root/'uploads', 'BACKUPS': root/'backups',
                           'DB': root/'data/app.db', 'ENV_FILE': root/'env',
                           'LIVE_COMPOSE': root/'live.json'}.items():
            stack.enter_context(patch.object(h.d, name, path))
        stack.enter_context(patch.object(h, 'REPORT', root/'report.json'))
        stack.enter_context(patch.object(h, 'SOURCE', root/'source'))
        for path in (h.d.ETC, h.d.STATE, h.d.DATA, h.d.UPLOADS, h.d.BACKUPS):
            path.mkdir(mode=0o700)
        (h.d.STATE/'home').mkdir()
        h.d.REPO.mkdir()
        h.d.ENV_FILE.write_text('fictional')
        (h.d.ETC/'actions-read.token').write_text('fictional-token')
        raw = (ROOT/'ops/test-deploy/docker-compose.test.yml').read_text()
        import re
        values = {'APP_IMAGE_TAG':'baseline', 'TEST_BACKEND_IP':'172.29.80.2',
                  'TEST_FRONTEND_IP':'172.29.80.3', 'TEST_SUBNET':'172.29.80.0/24'}
        self.model = json.loads(re.sub(r'\$\{([A-Z_]+):\?[^}]*\}', lambda m: values.get(m[1], 'fictional'), raw))
        for m in self.model['services']['backend']['volumes']:
            m['source'] = str(h.d.DATA if m['target'] == '/app/data' else h.d.UPLOADS)
        for path in (h.d.LIVE_COMPOSE, h.d.ETC/'docker-compose.test.yml'):
            path.write_text(json.dumps(self.model))
        policy = {'branch':'test-deploy', 'revision':self.sha, 'migrations':['001_fixture','002_fixture'],
                  'compose_sha256':h.d.storage.digest(h.d.LIVE_COMPOSE),
                  'frozen_compose_sha256':h.d.storage.digest(h.d.ETC/'docker-compose.test.yml'),
                  'env_sha256':h.d.storage.digest(h.d.ENV_FILE)}
        (h.d.ETC/'approved.json').write_text(json.dumps(policy))
        with closing(sqlite3.connect(h.d.DB)) as db, db:
            db.executescript("CREATE TABLE Customers (Id INTEGER PRIMARY KEY, Name TEXT);"
                            "INSERT INTO Customers VALUES (1,'FICTIONAL PERSON');"
                            "CREATE TABLE __EFMigrationsHistory (MigrationId TEXT PRIMARY KEY, ProductVersion TEXT);"
                            "INSERT INTO __EFMigrationsHistory VALUES ('001_fixture','fixture');")
        (h.d.UPLOADS/'fictional.txt').write_text('FICTIONAL UPLOAD\n')
        # Explicit OS/daemon boundaries only; never patch deploy/check_release/check_ci,
        # validate_model/migration_state/backup or the recovery algorithm.
        stack.enter_context(patch.dict(sys.modules, fcntl=Mock(LOCK_EX=2, LOCK_NB=4)))
        stack.enter_context(patch.object(h.d.os, 'geteuid', return_value=0, create=True))
        for name in ('trusted', 'check_mount_layout', 'protect_storage'):
            stack.enter_context(patch.object(h.d, name))
        stack.enter_context(patch.object(h.d, 'preflight', side_effect=self.preflight))
        stack.enter_context(patch.object(h.d, 'containers', side_effect=lambda:copy.deepcopy(self.live)))
        stack.enter_context(patch.object(h.d, 'smoke', side_effect=self.smoke))
        stack.enter_context(patch.object(h, 'own_pair'))
        stack.enter_context(patch.object(h, 'boundary'))
        stack.enter_context(patch.object(h, 'fixture_ingress'))
        stack.enter_context(patch.object(h, 'real_run', side_effect=self.command))
        stack.enter_context(patch.object(h, 'provision', return_value=self.sha))
        # System-temp restore targets remain real isolated directories on either OS.
        temporary = tempfile.TemporaryDirectory
        stack.enter_context(patch.object(h.d.tempfile, 'TemporaryDirectory',
            side_effect=lambda **kw:temporary(**{**kw, 'dir':root})))
        restore = h.d.storage.restore_test
        def restore_local(backup, target):
            if self.fault == 'restore': raise self.failure
            if target == Path('/var/tmp/carserviceapp-restore-test-recovery'):
                target = root/'carserviceapp-restore-test-recovery'
            return restore(backup, target)
        stack.enter_context(patch.object(h.d.storage, 'restore_test', side_effect=restore_local))

    def preflight(self):
        if (h.d.STATE/'in-progress').exists():
            raise h.d.Refused('unfinished deployment requires local operator')
        if (h.d.ETC/'recovery.json').exists():
            raise h.d.Refused('live TEST mount mismatch')

    def smoke(self):
        self.events.append('smoke')
        if self.fault == 'smoke': raise self.failure
        if not all(c['status'] == 'running' for c in self.live.values()):
            raise h.d.Refused('TEST smoke status failed')

    def command(self, *args, **kwargs):
        if args == ('/usr/local/sbin/carservice-test-preflight',): return ''
        if args[0] == 'git':
            if 'get-url' in args: return 'https://github.com/MTZBRN/CarServiceApp.git'
            if 'fetch' in args:
                assert args[5] == str(h.SOURCE), 'only local fixture fetch allowed'
                self.fetches += 1
                self.events.append('fetch')
                if self.fault == 'fetch': raise self.failure
                return ''
            if 'rev-parse' in args:
                return 'b'*40 if self.fault == 'second-admission' and self.fetches == 2 else self.sha
            if 'cat-file' in args: return 'commit'
            if 'archive' in args:
                Path(next(a[9:] for a in args if a.startswith('--output='))).write_bytes(b'fictional archive boundary')
                return ''
        if args[:2] == ('docker', 'build'):
            self.events.append('build')
            assert '--network=none' in args and '--pull=false' in args
            if self.fault == 'build': raise self.failure
            image = args[args.index('--tag')+1]
            name = next(n for n in h.d.SERVICES if image.startswith(h.d.PROJECT+'-'+n+':'))
            self.tags[image] = 'new-image-' + name
            Path(args[args.index('--iidfile')+1]).write_text(self.tags[image])
            return ''
        if args[:3] == ('docker', 'image', 'tag'):
            self.tags[args[4]] = args[3]
            return ''
        if args[:3] == ('docker', 'image', 'inspect'): return self.tags.get(args[-1], 'fixture-base')
        if args[:2] in (('docker', 'stop'), ('docker', 'start')):
            name = next(n for n,c in self.live.items() if c['id'] == args[-1])
            self.events.append(args[1]+'-'+name)
            self.live[name]['status'] = 'exited' if args[1] == 'stop' else 'running'
            return ''
        if args[:2] == ('docker', 'inspect'):
            if args[3] == '{{.State.ExitCode}}': return '1'
            if args[3] == '{{.Image}}':
                return next(c['image'] for c in self.live.values() if c['id'] == args[-1])
            return 'healthy'
        if args[:2] == ('docker', 'version'): return 'fixture-version'
        if args[:2] == ('docker', 'compose'):
            if 'version' in args: return 'fixture-version'
            files = [Path(args[i+1]) for i,a in enumerate(args) if a == '-f']
            config = json.loads(files[0].read_text())
            if len(files) == 2:
                overlay = json.loads(files[1].read_text())
                for n in h.d.SERVICES: config['services'][n].update(overlay['services'][n])
            if 'config' in args: return json.dumps(config)
            if 'ps' in args: return self.live[args[-1]]['id']
            if 'up' in args:
                name = args[-1]
                self.events.append('up-'+name)
                image = self.tags[config['services'][name]['image']]
                self.live[name] = {'id':image+'-container', 'image':image, 'status':'running'}
                if name == 'backend' and image.startswith('new-'):
                    try: self.migrate()
                    except sqlite3.OperationalError:
                        self.live[name]['status'] = 'exited'
                        raise subprocess.CalledProcessError(1, args) from None
                return ''
        raise AssertionError('unhandled command boundary')

    def migrate(self):
        code = (FOLDER/'fixture.py').read_text().split('class Handler')[0]
        fixture = self.root/'migration'
        fixture.mkdir(exist_ok=True)
        (fixture/'role').write_text('backend')
        (fixture/'generation').write_text('new')
        if self.scenario == 'migration-failure': (fixture/'migration-fails').touch()
        connect = sqlite3.connect
        with patch('pathlib.Path', side_effect=lambda p:fixture/p.lstrip('/')), \
             patch('sqlite3.connect', side_effect=lambda _:connect(h.d.DB)), \
             patch.object(sys, 'argv', ['fixture.py']):
            exec(code, {})


class RehearsalTests(unittest.TestCase):
    def test_real_local_git_admission_repeats_without_contacting_origin(self):
        if not shutil.which('git'): self.skipTest('local Git unavailable')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            source, repo = root/'source', root/'bare.git'
            def command(*args, **kwargs):
                # Use native Windows PATH in this test only. All transport is local.
                return subprocess.run(args, check=True, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, timeout=30).stdout.decode().strip()
            command('git', 'init', '-b', 'test-deploy', str(source))
            (source/'fictional.txt').write_text('FICTIONAL')
            command('git', '-C', str(source), 'add', '.')
            command('git', '-C', str(source), '-c', 'user.name=Fixture',
                    '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Disposable fixture only')
            sha = command('git', '-C', str(source), 'rev-parse', 'HEAD')
            command('git', 'clone', '--bare', str(source), str(repo))
            command('git', '--git-dir', str(repo), 'remote', 'set-url', 'origin',
                    'https://github.com/MTZBRN/CarServiceApp.git')
            approval = root/'approved.json'
            policy = {'branch':'test-deploy', 'revision':sha}
            approval.write_text(json.dumps(policy))
            (root/'actions-read.token').write_text('fictional')
            calls = []
            with patch.object(h, 'SOURCE', source), patch.object(h.d, 'REPO', repo), \
                 patch.object(h.d, 'ETC', root), patch.object(h, 'real_run', side_effect=command), \
                 patch.object(h.d, 'trusted'), \
                 patch.object(h.d, 'run', side_effect=h.admission_adapter(sha, calls)):
                for _ in range(2): h.d.check_release(['git', '--git-dir', str(repo)], sha, approval, policy)
            self.assertEqual(calls, h.ADMISSION)

    def test_loopback_ingress_transports_real_http_and_never_fabricates_success(self):
        # Actual sockets and unchanged production smoke(); only the fixed container
        # address is mapped to a local fictional server because Docker is unavailable.
        class Handler(http.server.BaseHTTPRequestHandler):
            status_override = None
            def do_GET(self):
                self.send_response(self.status_override or (401 if self.path == '/api/Auth/me' else 200))
                self.end_headers()
                self.wfile.write(b'<div id="root">FICTIONAL</div>')
            def log_message(self, *_): pass
        connect = socket.create_connection
        with http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler) as upstream:
            thread = threading.Thread(target=upstream.serve_forever, daemon=True)
            thread.start()
            def local_connection(address, *args, **kwargs):
                if address == ('172.29.80.3', 8080): address = upstream.server_address
                return connect(address, *args, **kwargs)
            try:
                with patch.object(h, 'real_run', return_value='true'), \
                     patch.object(h.socket, 'create_connection', side_effect=local_connection):
                    for status in (None, 503):  # Reopening also exercises recovery reuse.
                        Handler.status_override = status
                        with h.fixture_ingress():
                            if status:
                                with self.assertRaisesRegex(h.d.Refused, 'smoke status failed'): h.d.smoke()
                            else: h.d.smoke()
            finally:
                upstream.shutdown()
                thread.join()
        with self.assertRaises(OSError): connect(('127.0.0.1', 5174), timeout=1)
        with patch.object(h, 'real_run', return_value='false'):
            with self.assertRaisesRegex(RuntimeError, 'internal network'):
                with h.fixture_ingress(): self.fail('unsafe network accepted')

    def test_ci_refusal_propagates_before_journal_or_stop(self):
        adapter = h.admission_adapter
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            pipeline = LocalPipeline(Path(tmp).resolve(), stack, 'success')
            def failed_ci(sha, calls):
                original = adapter(sha, calls)
                def command(*args, **kwargs):
                    result = original(*args, **kwargs)
                    if args[0] == 'gh':
                        response = json.loads(result)
                        response['workflow_runs'][0]['conclusion'] = 'failure'
                        return json.dumps(response)
                    return result
                return command
            with patch.object(h, 'admission_adapter', side_effect=failed_ci), redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(h.d.Refused, 'no successful test-deploy CI'):
                    h.exercise_deployment('success', pipeline.sha, copy.deepcopy(pipeline.live))
            report = json.loads(h.REPORT.read_text())
            self.assertEqual(report['deployment_evidence']['admission_calls'], h.ADMISSION[:2])
            self.assertEqual(report['deployment_evidence']['journal_count'], 0)
            self.assertFalse(report['deployment_evidence']['in_progress'])
            self.assertEqual(pipeline.events, ['fetch'])

    def test_absent_loopback_ingress_reproduces_partial_admission_with_real_smoke(self):
        smoke = h.d.smoke
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            pipeline = LocalPipeline(Path(tmp).resolve(), stack, 'success')
            with patch.object(h.d, 'smoke', side_effect=smoke), redirect_stdout(io.StringIO()):
                with self.assertRaises(ConnectionRefusedError):
                    h.exercise_deployment('success', pipeline.sha, copy.deepcopy(pipeline.live))
            evidence = json.loads(h.REPORT.read_text())['deployment_evidence']
            self.assertEqual(evidence['admission_calls'], h.ADMISSION[:2])
            self.assertEqual(evidence['failure']['kind'], 'connection-refused')
            self.assertIsInstance(evidence['failure']['errno'], int)
            self.assertEqual(evidence['journal_count'], 0)
            self.assertFalse(evidence['in_progress'])
            self.assertEqual(evidence['services'], {'backend':'running', 'frontend':'running'})

    def test_missing_admission_repetition_is_still_rejected(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            pipeline = LocalPipeline(Path(tmp).resolve(), stack, 'success')
            with patch.object(h.d, 'deploy'), redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(RuntimeError, 'admission not repeated'):
                    h.exercise_deployment('success', pipeline.sha, copy.deepcopy(pipeline.live))
            self.assertEqual(json.loads(h.REPORT.read_text())['recovery'], 'unexpected-failure')

    def test_deployment_evidence_does_not_publish_arbitrary_exception_or_journal_values(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(h.d, 'STATE', Path(tmp)), \
             patch.object(h.d, 'containers', side_effect=RuntimeError('SECRET-CANARY')):
            for text in ('not-json SECRET-CANARY', '{"stage": ["SECRET-CANARY"]}'):
                (Path(tmp)/'run.json').write_text(text)
                output = io.StringIO()
                with redirect_stdout(output):
                    evidence, _ = h.deployment_evidence(['SECRET-CANARY'], h.d.Refused('SECRET-CANARY'))
                self.assertNotIn('SECRET-CANARY', output.getvalue())
                self.assertEqual(evidence['stage'], 'none-or-unknown')
                self.assertEqual(evidence['services'], {'inspection':'unavailable'})
                self.assertEqual(evidence['failure']['invariant'], 'unlisted refusal')

    def test_all_scenarios_real_helper_storage_and_recovery_contract(self):
        for scenario in h.SCENARIOS:
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
                root = Path(tmp).resolve()
                pipeline = LocalPipeline(root, stack, scenario)
                # Windows chmod cannot model group-write bits; exercise run_case's
                # negative ownership preflight via the existing dedicated guard test.
                stack.enter_context(patch.object(Path, 'chmod'))
                preflight = pipeline.preflight
                negative = [True]
                def local_preflight():
                    if negative[0]:
                        negative[0] = False
                        raise h.d.Refused('unsafe runtime ownership or permissions')
                    preflight()
                stack.enter_context(patch.object(h.d, 'preflight', side_effect=local_preflight))
                with redirect_stdout(io.StringIO()): h.run_case(scenario)
                report = json.loads(h.REPORT.read_text())
                self.assertEqual(report['deployment_evidence']['admission_calls'], h.ADMISSION)
                self.assertEqual(pipeline.fetches, 2)
                self.assertEqual(pipeline.events[:4], ['fetch', 'smoke', 'build', 'build'])
                self.assertLess(pipeline.events.index('stop-frontend'), pipeline.events.index('stop-backend'))
                if scenario == 'success':
                    self.assertEqual(report['journal']['stage'], 'healthy')
                    self.assertEqual(h.d.migration_state(), ['001_fixture', '002_fixture'])
                    self.assertEqual(report['recovery'], 'not-needed')
                else:
                    self.assertNotIn('up-frontend', pipeline.events)
                    with self.assertRaisesRegex(RuntimeError, 'not approved'): h.main(['verify'])
                    original_pair = (h.d.storage.digest(h.d.DB), h.d.storage.inventory(h.d.UPLOADS))
                    h.main(['recover', '--approve-fixture-recovery'])
                    self.assertEqual(original_pair, (h.d.storage.digest(h.d.DB), h.d.storage.inventory(h.d.UPLOADS)))
                    self.assertTrue(all(c['image'].startswith('old-image-') for c in pipeline.live.values()))
                    if scenario == 'migration-failure':
                        restored = root/'carserviceapp-restore-test-recovery'
                        self.assertTrue((restored/'RESTORE_VERIFIED.json').exists())
                        self.assertEqual(h.d.storage.inventory(restored/'uploads'), original_pair[1])
                self.assertFalse((h.d.STATE/'in-progress').exists())
                with redirect_stdout(io.StringIO()): h.main(['verify'])

    def test_early_and_real_deployment_failures_are_not_masked(self):
        for fault, calls, stage in [('fetch', ['local-fetch'], 'none-or-unknown'),
                                    ('smoke', h.ADMISSION[:2], 'none-or-unknown'),
                                    ('build', h.ADMISSION[:2], 'building'),
                                    ('second-admission', h.ADMISSION[:3], 'building'),
                                    ('restore', h.ADMISSION, 'verifying-backup')]:
            for scenario in h.SCENARIOS:
                if scenario == 'backup-failure' and fault == 'restore': continue
                with self.subTest(fault=fault, scenario=scenario), tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
                    pipeline = LocalPipeline(Path(tmp).resolve(), stack, scenario, fault)
                    output = io.StringIO()
                    with redirect_stdout(output), self.assertRaises(Exception) as caught:
                        h.exercise_deployment(scenario, pipeline.sha, copy.deepcopy(pipeline.live))
                    if fault == 'second-admission':
                        self.assertIsInstance(caught.exception, h.d.Refused)
                        self.assertEqual(str(caught.exception), 'revision is not the current test-deploy tip')
                    else: self.assertIs(caught.exception, pipeline.failure)
                    report = json.loads(h.REPORT.read_text())
                    self.assertEqual(report['deployment_evidence']['admission_calls'], calls)
                    self.assertEqual(report['deployment_evidence']['stage'], stage)
                    self.assertNotIn('SECRET-CANARY', output.getvalue() + h.REPORT.read_text())
                    self.assertEqual(report['recovery'], 'unexpected-failure')
                    self.assertNotIn('up-backend', pipeline.events)
                    if fault != 'restore': self.assertNotIn('stop-backend', pipeline.events)
                    with self.assertRaises(RuntimeError): h.main(['verify'])

    def test_recovery_requires_approval_and_rejects_rollback_drift(self):
        with patch.object(h, 'recover') as recovery:
            for args in (['recover'], ['recover', '--approve'], ['recover', '--approve-fixture-recovery', 'extra']):
                with self.assertRaises(SystemExit): h.main(args)
            recovery.assert_not_called()
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            pipeline = LocalPipeline(Path(tmp).resolve(), stack, 'backup-failure')
            with redirect_stdout(io.StringIO()):
                h.exercise_deployment('backup-failure', pipeline.sha, copy.deepcopy(pipeline.live))
            report_before = h.REPORT.read_text()
            pipeline.tags = {k:'drifted' for k in pipeline.tags}
            with self.assertRaisesRegex(RuntimeError, 'rollback tag drift'): h.main(['recover', '--approve-fixture-recovery'])
            self.assertEqual(h.REPORT.read_text(), report_before)
            self.assertTrue((h.d.STATE/'in-progress').exists())
            self.assertNotIn('start-backend', pipeline.events)

    def test_recovery_validation_failure_keeps_pending_evidence_and_marker(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            pipeline = LocalPipeline(Path(tmp).resolve(), stack, 'backup-failure')
            with redirect_stdout(io.StringIO()):
                h.exercise_deployment('backup-failure', pipeline.sha, copy.deepcopy(pipeline.live))
            before = h.REPORT.read_text()
            with patch.object(h.d, 'preflight', side_effect=h.d.Refused('unhealthy baseline')):
                with self.assertRaises(h.d.Refused): h.main(['recover', '--approve-fixture-recovery'])
            self.assertEqual(h.REPORT.read_text(), before)
            self.assertTrue((h.d.STATE/'in-progress').exists())

    def test_compose_adapter_removes_only_null_image_defaults(self):
        model = {'services': {'backend': {'command': None, 'entrypoint': None,
                                          'unknown': None, 'privileged': True},
                              'frontend': {'command': [], 'entrypoint': ['override']}}}
        self.assertEqual(compat.normalize(model), {'services': {
            'backend': {'unknown': None, 'privileged': True},
            'frontend': {'command': [], 'entrypoint': ['override']}}})

    def test_strict_guard_still_rejects_explicit_overrides_and_unknowns(self):
        # A minimal valid model from the reviewed template, with fictional interpolation.
        import re
        text = (ROOT/'ops/test-deploy/docker-compose.test.yml').read_text()
        values = {'APP_IMAGE_TAG':'preflight', 'TEST_BACKEND_IP':'172.29.80.2',
                  'TEST_FRONTEND_IP':'172.29.80.3', 'TEST_SUBNET':'172.29.80.0/24'}
        text = re.sub(r'\$\{([A-Z_]+):\?[^}]+\}', lambda m: values.get(m[1], 'fictional'), text)
        model = json.loads(text)
        # validate_model compares to native Path strings; normalize test paths on Windows.
        model['services']['backend']['volumes'][0]['source'] = str(h.d.DATA)
        model['services']['backend']['volumes'][1]['source'] = str(h.d.UPLOADS)
        for mount in model['services']['backend']['volumes']:
            mount['bind'] = {}  # Real Compose JSON omits the false boolean.
        model['services']['backend'].update(command=None, entrypoint=None)
        with self.assertRaisesRegex(h.d.Refused, 'unreviewed service option'): h.d.validate_model(model, 'preflight')
        compat.normalize(model)
        h.d.validate_model(model, 'preflight')
        for key, value in [('command', []), ('entrypoint', ''), ('command', ['sh']),
                           ('privileged', True), ('unknown', None)]:
            model['services']['backend'][key] = value
            with self.assertRaisesRegex(h.d.Refused, 'unreviewed service option'):
                h.d.validate_model(compat.normalize(model), 'preflight')
            del model['services']['backend'][key]
        model['services']['backend']['volumes'][0]['bind']['create_host_path'] = True
        with self.assertRaisesRegex(h.d.Refused, 'unexpected TEST mounts'):
            h.d.validate_model(compat.normalize(model), 'preflight')

    def test_compose_adapter_preserves_config_failure(self):
        with patch.object(compat.subprocess, 'run', return_value=subprocess.CompletedProcess([], 7, b'not-json')):
            self.assertEqual(compat.main(['config', '--format', 'json']), 7)

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
