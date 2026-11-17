"""Focused unprivileged unit tests. No Docker daemon or application data access."""
import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import sqlite3
import stat
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parent


def load():
    spec = importlib.util.spec_from_file_location('gate_c_test_subject', ROOT / 'gate-c.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def window():
    now = dt.datetime.now(dt.timezone.utc)
    return {'window_start_utc': (now - dt.timedelta(minutes=1)).isoformat(),
            'window_end_utc': (now + dt.timedelta(hours=1)).isoformat()}


SNAP = {'history': [['20200101_fixture', '8.0.0']], 'counts': {'Users': 1},
        'uploads': [{'name': 'fictional.txt', 'size': 3, 'sha256': 'fixture'}],
        'database_hashes': {'app.db': 'unchanged'}, 'metadata': {'source': [1, 2, 3]}}


class FakeDocker:
    """Explicit variants, NOT captured Docker evidence. Real harness is separate."""
    def __init__(self, m):
        self.m = m
        self.running = dict(backend=True, frontend=True)
        self.health = dict(backend='healthy', frontend='healthy')
        self.started = dict(backend='initial', frontend='initial')
        self.commands = []
        self.overrides = {}
        self.timeout_stop = None
        self.extra_peer = False

    def row(self, service):
        m = self.m
        running = self.running[service]
        endpoint = dict(NetworkID=m.NETID if running else '',
                        IPAddress=m.ADDRESSES[service] if running else '',
                        Gateway=m.GATEWAY if running else '',
                        IPAMConfig={'IPv4Address': m.ADDRESSES[service]}, EndpointID='' if not running else 'endpoint')
        mounts = [] if service == 'frontend' else [
            dict(Type='bind', Source=str(m.DATA), Destination='/app/data', RW=True),
            dict(Type='bind', Source=str(m.UPLOADS), Destination='/app/uploads', RW=True)]
        ports = {'8080/tcp': [{'HostIp': '127.0.0.1', 'HostPort': m.FRONTEND_PORT}]} if service == 'frontend' else {}
        row = [*m.IDENTITIES[service], {'com.docker.compose.project': m.PROJECT,
               'com.docker.compose.service': service}, 'running' if running else 'exited', running,
               self.health[service] if running else None, mounts, {m.NETWORK: endpoint}, ports,
               False, {'Name': 'unless-stopped', 'MaximumRetryCount': 0}, m.NETWORK,
               False, False, False, self.started[service], 'zero' if running else 'finished']
        for index, value in self.overrides.get(service, {}).items():
            row[index] = value
        return row

    def __call__(self, args, timeout=60):
        m = self.m
        self.commands.append(args)
        if args[0] == 'ps':
            return '\n'.join(v[0] for v in m.IDENTITIES.values())
        if args[:2] == ['network', 'inspect']:
            peers = {m.IDENTITIES[s][0]: {} for s in m.IDENTITIES if self.running[s]}
            if self.extra_peer:
                peers['unexpected'] = {}
            return json.dumps([m.NETID, [{'Subnet': m.SUBNET, 'Gateway': m.GATEWAY}], peers])
        service = next(s for s, identity in m.IDENTITIES.items() if identity[0] == args[-1])
        if args[0] == 'inspect':
            return json.dumps(self.row(service))
        if args[0] == 'stop':
            self.running[service] = False
            if self.timeout_stop == service:
                raise subprocess.TimeoutExpired('fictional-docker', timeout)
            return args[-1]
        if args[0] == 'start':
            self.running[service] = True
            self.started[service] = 'restarted'
            return args[-1]
        raise AssertionError(args)


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.m = load()
        self.d = FakeDocker(self.m)
        self.m.command = self.d

    def test_running_frontend_stopped_and_both_stopped(self):
        self.m.check_pair(healthy=True)
        self.d.running['frontend'] = False
        self.m.check_pair()
        self.d.running['backend'] = False
        self.m.check_pair(stopped=True)
        self.assertIsNone(self.m.inspect('backend')['health'])

    def test_stopped_retained_active_fields_also_accepted(self):
        self.d.running = dict(backend=False, frontend=False)
        for s in self.d.running:
            self.d.overrides[s] = {7: {self.m.NETWORK: dict(NetworkID=self.m.NETID,
                IPAddress=self.m.ADDRESSES[s], Gateway=self.m.GATEWAY,
                IPAMConfig={'IPv4Address': self.m.ADDRESSES[s]})}, 5: 'unhealthy'}
        self.m.check_pair(stopped=True)  # stale health is not liveness

    def test_stopped_wrong_identity_image_network_and_static_ip_refused(self):
        self.d.running['backend'] = False
        for index, value in ((0, 'wrong'), (1, 'sha256:wrong'), (11, 'other-network'),
                             (7, {self.m.NETWORK: {'NetworkID': 'wrong',
                               'IPAMConfig': {'IPv4Address': self.m.ADDRESSES['backend']}}}),
                             (7, {self.m.NETWORK: {'NetworkID': '', 'IPAMConfig': {'IPv4Address': 'wrong'}}})):
            with self.subTest(index=index, value=value):
                self.d.overrides['backend'] = {index: value}
                with self.assertRaises(RuntimeError):
                    self.m.inspect('backend')

    def test_missing_running_health_and_empty_active_endpoint_refused(self):
        for override in ({5: None}, {7: {self.m.NETWORK: dict(NetworkID='', IPAddress='',
                           Gateway='', IPAMConfig={'IPv4Address': self.m.ADDRESSES['backend']})}}):
            self.d.overrides['backend'] = override
            with self.assertRaises(RuntimeError):
                self.m.check_pair(healthy=True)

    def test_extra_peer_autoremove_public_port_and_transition_refused(self):
        self.d.extra_peer = True
        with self.assertRaises(RuntimeError):
            self.m.check_network()
        self.d.extra_peer = False
        for override in ({9: True}, {12: True}, {13: True}, {14: True},
                         {8: {'8080/tcp': [{'HostIp': '0.0.0.0', 'HostPort': '5174'}]}}):
            self.d.overrides['frontend'] = override
            with self.assertRaises(RuntimeError):
                self.m.inspect('frontend')

    def test_stop_timeout_records_ambiguity_and_never_starts(self):
        self.d.timeout_stop = 'frontend'
        log = Mock()
        with self.assertRaises(subprocess.TimeoutExpired):
            self.m.stop_exact('frontend', window(), log)
        self.assertEqual([c.args[0] for c in log.call_args_list],
                         ['stop-request-frontend', 'stop-ambiguous-frontend'])
        self.assertFalse(any(c[0] == 'start' for c in self.d.commands))


class ApprovalTests(unittest.TestCase):
    def setUp(self):
        self.m = load()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'approval.json'

    def authenticate(self, value):
        raw = json.dumps(value).encode()
        self.path.write_bytes(raw)
        return self.m.authenticated_json(self.path, self.m.sha(raw))

    def test_hash_and_duplicate_key_refusal(self):
        self.path.write_bytes(b'{"gate":"C-only","gate":"C-recovery-only"}')
        with self.assertRaisesRegex(RuntimeError, 'duplicate-json-key'):
            self.m.authenticated_json(self.path, self.m.sha(self.path.read_bytes()))
        with self.assertRaisesRegex(RuntimeError, 'approval-hash-mismatch'):
            self.m.authenticated_json(self.path, '0' * 64)

    def test_recovery_has_independent_window_and_binds_original_hash(self):
        a = recovery_doc()
        record = {'approval_sha256': 'a' * 64, 'approval': {'recovery_decision_maker': 'fixture-decider',
                 'window_start_utc': '2000-01-01T00:00:00Z', 'window_end_utc': '2000-01-02T00:00:00Z'}}
        self.m.verified_reference = Mock(return_value=json.dumps(SNAP['history']).encode())
        self.path.write_text(json.dumps(a))
        self.m.recovery_authorization(self.path, self.m.sha(self.path.read_bytes()), record)
        a['window_end_utc'] = '2000-01-01T00:00:00Z'
        self.path.write_text(json.dumps(a))
        with self.assertRaisesRegex(RuntimeError, 'outside-approved-window'):
            self.m.recovery_authorization(self.path, self.m.sha(self.path.read_bytes()), record)
        a.update(window());a['gate_c_approval_sha256'] = 'b' * 64
        self.path.write_text(json.dumps(a))
        with self.assertRaisesRegex(RuntimeError, 'recovery-wrong-gate-c-record'):
            self.m.recovery_authorization(self.path, self.m.sha(self.path.read_bytes()), record)

    def test_templates_cannot_authorize(self):
        for filename, func in (('gate-c-approval.template.json', self.m.approval),
                               ('gate-c-recovery.template.json', lambda p, h: self.m.recovery_authorization(p, h, {}))):
            self.path.write_bytes((ROOT / filename).read_bytes())
            with self.assertRaises(RuntimeError):
                func(self.path, self.m.sha(self.path.read_bytes()))

    def test_private_journal_is_exclusive(self):
        p = Path(self.temp.name) / 'event.json'
        self.m.write_new(p, {'fixture': True})
        self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o600)
        with self.assertRaises(FileExistsError):
            self.m.write_new(p, {'fixture': False})

    def test_gate_c_decision_deadline_does_not_apply_to_recovery(self):
        a = dict(window(), gate='C-only', decision_deadline_utc='2000-01-01T00:00:00Z')
        with self.assertRaisesRegex(RuntimeError, 'decision-deadline-reached'):
            self.m.check_window(a)
        a['gate'] = 'C-recovery-only'
        self.m.check_window(a)

    def test_gate_d_and_verified_recovery_dependencies_are_mandatory(self):
        a = dict(window(), gate='C-only', gate_c_approved=True, github_gate_disabled_confirmed=True,
                 max_upload_restore_bytes=1, decision_deadline_utc=(dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=10)).isoformat())
        for k in ('maintenance_reference', 'custody_operator', 'recovery_decision_maker', 'old_path_baseline',
                  'old_path_baseline_sha256', 'ingress_close_procedure', 'ingress_closed_verification',
                  'ingress_reopen_procedure', 'writer_exclusion_and_custody_plan'):
            a[k] = 'fixture'
        self.m.verified_reference = Mock(return_value=b'{}')
        self.path.write_text(json.dumps(a))
        with self.assertRaisesRegex(RuntimeError, 'cutover-and-recovery-not-ready'):
            self.m.approval(self.path, self.m.sha(self.path.read_bytes()))

    def test_ready_reference_hashes_and_exact_script_evidence_binding(self):
        a = dict(window(), gate='C-only', gate_c_approved=True, github_gate_disabled_confirmed=True,
                 max_upload_restore_bytes=1, gate_d_ready=True, old_path_recovery_verified=True,
                 stopped_docker_tests_verified=True,
                 decision_deadline_utc=(dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=10)).isoformat())
        for k in ('maintenance_reference', 'custody_operator', 'recovery_decision_maker',
                  'ingress_close_procedure', 'ingress_closed_verification', 'ingress_reopen_procedure',
                  'writer_exclusion_and_custody_plan'):
            a[k] = 'fictional-unit-input'
        def reference(key, raw):
            p = Path(self.temp.name) / (key + '.fixture')
            p.write_bytes(raw);p.chmod(0o600)
            a[key], a[key + '_sha256'] = str(p), self.m.sha(raw)
        reference('old_path_baseline', json.dumps({'services': {
            s: {'image': image} for s, (_, image) in self.m.IDENTITIES.items()}}).encode())
        reference('gate_d_procedure', b'fictional ready procedure')
        reference('old_path_recovery_procedure', b'fictional verified recovery')
        report = {'status':'PASS', 'script_sha256': self.m.execution_fingerprint(),
                  'docker_engine_version':'fictional-unit-version', 'checks': [
                  'running','frontend-stopped','both-stopped','recover-frontend','recover-both',
                  'reject-wrong-network','reject-wrong-image']}
        reference('stopped_docker_test_evidence', json.dumps(report).encode())
        # Only root ownership enforcement is adapted for these unprivileged
        # fictional files. Actual bytes/path/hashes/schema/readiness are checked.
        original = self.m.read_file
        self.m.read_file = lambda p, **kw: original(p, trusted_parent=False,
                                                  max_bytes=kw.get('max_bytes',16*1024**2))
        self.path.write_text(json.dumps(a))
        self.assertEqual(self.m.approval(self.path, self.m.sha(self.path.read_bytes())), a)
        report['script_sha256'] = '0' * 64
        reference('stopped_docker_test_evidence', json.dumps(report).encode())
        self.path.write_text(json.dumps(a))
        with self.assertRaisesRegex(RuntimeError, 'disposable-stopped-tests-not-verified'):
            self.m.approval(self.path, self.m.sha(self.path.read_bytes()))


def recovery_doc(mode='fresh-quiesced'):
    a = dict(window(), gate='C-recovery-only', recovery_id='fixture-attempt-001',
        approval_reference='fixture-approval', gate_c_approval_sha256='a' * 64,
        decision_maker='fixture-decider', decision_maker_authority='fixture approved recovery authority',
        custody_operator='fixture-custodian', reason='fixture failure',
        custody_and_stop_settlement_evidence='fixture no pending stop and continuous exclusion',
        mode=mode, quiesce_if_required=False, fresh_source_verification_approved=True)
    for flag in ('recovery_approved', 'custody_continuous', 'ingress_closed', 'github_gate_disabled_confirmed',
                 'original_source_authoritative', 'no_gate_d_or_source_overwrite', 'stop_requests_settled',
                 'backend_startup_approved'):
        a[flag] = True
    return a


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.m = load()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.m.RECORD = Path(self.temp.name) / 'journal'
        self.m.RECORD.mkdir()
        self.d = FakeDocker(self.m)
        self.m.command = self.d
        self.m.common = Mock()
        self.m.trusted = Mock()
        self.m.confirm = Mock()
        self.m.verified_reference = Mock(return_value=json.dumps(SNAP['history']).encode())
        self.m.storage_module = Mock(return_value=object())
        self.m.capture_source = Mock(side_effect=lambda storage: copy.deepcopy(SNAP))
        self.m.record_json = lambda p: self.m.decode_json(p.read_bytes())
        self.m.time = Mock(monotonic=__import__('time').monotonic, sleep=Mock())
        self.record = {'approval_sha256': 'a' * 64, 'approval': {'recovery_decision_maker': 'fixture-decider'},
                       'container_metadata': self.m.check_pair(healthy=True)}
        self.a = recovery_doc()
        self.a['mode'] = 'existing-capture'

    def stop(self, backend=True, capture=True):
        self.d.running['frontend'] = False
        (self.m.RECORD / 'stop-request-frontend.json').write_text('{}')
        if backend:
            self.d.running['backend'] = False
            (self.m.RECORD / 'stop-request-backend.json').write_text('{}')
        if capture:
            (self.m.RECORD / 'source-capture.json').write_text(json.dumps(SNAP))

    def starts(self):
        return [c[-1] for c in self.d.commands if c[0] == 'start']

    def recover(self):
        self.m.recover(self.a, 'b' * 64, self.record)

    def test_frontend_only_never_reads_source(self):
        self.stop(backend=False, capture=False)
        self.a['mode'] = 'frontend-only'
        self.recover()
        self.m.capture_source.assert_not_called()
        self.assertEqual(self.starts(), [self.m.IDENTITIES['frontend'][0]])

    def test_backend_stopped_before_capture_uses_approved_fresh_evidence(self):
        self.stop(capture=False)
        self.a['mode'] = 'fresh-quiesced'
        self.recover()
        self.assertEqual(self.starts(), [self.m.IDENTITIES[s][0] for s in ('backend', 'frontend')])
        attempt = self.m.RECORD / ('recovery-' + self.a['recovery_id'])
        self.assertTrue((attempt / 'source-verified.json').exists())

    def test_backup_or_restore_failure_existing_capture_recovers(self):
        self.stop()
        (self.m.RECORD / 'paired-backup.json').write_text('{"path":"fixture"}')
        self.recover()
        self.assertEqual(len(self.starts()), 2)

    def test_original_window_expired_does_not_expire_new_recovery(self):
        self.stop()
        self.record['approval'].update(window_start_utc='2000-01-01T00:00:00Z', window_end_utc='2000-01-02T00:00:00Z')
        self.recover()
        self.assertEqual(len(self.starts()), 2)

    def test_expired_recovery_window_starts_nothing(self):
        self.stop()
        self.a['window_end_utc'] = '2000-01-01T00:00:00Z'
        with self.assertRaisesRegex(RuntimeError, 'outside-approved-window'):
            self.recover()
        self.assertEqual(self.starts(), [])

    def test_missing_capture_in_existing_mode_starts_nothing(self):
        self.stop(capture=False)
        with self.assertRaises(FileNotFoundError):
            self.recover()
        self.assertEqual(self.starts(), [])

    def test_integrity_mismatch_and_fresh_mode_cannot_bypass_existing_capture(self):
        self.stop()
        self.a['mode'] = 'fresh-quiesced'
        changed = copy.deepcopy(SNAP);changed['database_hashes']['app.db'] = 'changed'
        self.m.capture_source = Mock(return_value=changed)
        with self.assertRaisesRegex(RuntimeError, 'original-snapshot-mismatch'):
            self.recover()
        self.assertEqual(self.starts(), [])

    def test_running_backend_after_stop_request_requires_explicit_quiesce(self):
        self.stop()
        self.d.running['backend'] = True
        with self.assertRaisesRegex(RuntimeError, 'backend-still-running'):
            self.recover()
        self.assertEqual(self.starts(), [])

    def test_approved_ambiguous_stop_quiesces_before_fresh_checks(self):
        self.stop(capture=False)
        self.d.running = dict(frontend=True, backend=True)
        self.a.update(mode='fresh-quiesced', quiesce_if_required=True)
        self.recover()
        actions = [c for c in self.d.commands if c[0] in ('stop', 'start')]
        self.assertEqual([(c[0], c[-1]) for c in actions],
                         [(op, self.m.IDENTITIES[s][0]) for op, s in
                          [('stop','frontend'),('stop','backend'),('start','backend'),('start','frontend')]])

    def test_expiration_after_backend_start_prevents_frontend_start(self):
        self.stop()
        actual = self.m.check_window
        def expires(a):
            if self.starts():
                raise RuntimeError('outside-approved-window')
            actual(a)
        self.m.check_window = expires
        with self.assertRaises(RuntimeError):
            self.recover()
        self.assertEqual(self.starts(), [self.m.IDENTITIES['backend'][0]])

    def test_recovery_attempt_cannot_be_reused(self):
        self.stop()
        (self.m.RECORD / ('recovery-' + self.a['recovery_id'])).mkdir()
        with self.assertRaises(FileExistsError):
            self.recover()
        self.assertEqual(self.starts(), [])

    def test_frontend_only_rejects_backend_restart(self):
        self.stop(backend=False, capture=False)
        self.a['mode'] = 'frontend-only';self.d.started['backend'] = 'unexpected'
        with self.assertRaisesRegex(RuntimeError, 'frontend-only-not-safe'):
            self.recover()
        self.assertEqual(self.starts(), [])


class SQLiteFixtureTests(unittest.TestCase):
    def test_real_sqlite_history_and_fingerprint_on_fictional_fixture(self):
        m = load()
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / 'app.db'
            c = sqlite3.connect(p)
            c.execute('CREATE TABLE __EFMigrationsHistory (MigrationId TEXT, ProductVersion TEXT)')
            c.execute("INSERT INTO __EFMigrationsHistory VALUES ('fixture-migration', '8.0.0')")
            c.commit();c.close()
            before = m.fingerprint(p)
            self.assertEqual(m.migration_history(p), [['fixture-migration', '8.0.0']])
            self.assertEqual(m.fingerprint(p), before)

    def test_capture_checks_actual_fictional_sqlite_and_upload_stability(self):
        m = load()
        docker = FakeDocker(m);docker.running = dict(backend=False, frontend=False)
        m.command = docker
        with tempfile.TemporaryDirectory() as t:
            m.DB = Path(t) / 'app.db'
            upload = Path(t) / 'fictional.txt';upload.write_bytes(b'fictional')
            c = sqlite3.connect(m.DB)
            c.execute('CREATE TABLE __EFMigrationsHistory (MigrationId TEXT, ProductVersion TEXT)')
            c.execute("INSERT INTO __EFMigrationsHistory VALUES ('fixture', '8.0.0')")
            c.execute('CREATE TABLE Users (Id INTEGER)')
            c.execute('INSERT INTO Users VALUES (1)');c.commit();c.close()
            m.source_metadata = lambda: ({'fixture-root': [1, 2, 3]}, {'data': 4096, 'uploads': 9})
            def db_info(path):
                c = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
                try:
                    self.assertEqual(c.execute('PRAGMA integrity_check').fetchall(), [('ok',)])
                    self.assertEqual(c.execute('PRAGMA foreign_key_check').fetchall(), [])
                    return {'Users': c.execute('SELECT count(*) FROM Users').fetchone()[0]}
                finally:
                    c.close()
            def inventory(root):
                raw = upload.read_bytes()
                return [{'name': upload.name, 'size': len(raw), 'sha256': m.sha(raw)}]
            storage = SimpleNamespace(database_info=db_info, inventory=inventory)
            snap = m.capture_source(storage)
            m.source_matches(storage, snap)
            upload.write_bytes(b'changed')
            with self.assertRaisesRegex(RuntimeError, 'old-source-integrity-not-established'):
                m.source_matches(storage, snap)


class RunBoundaryTests(unittest.TestCase):
    def scenario(self, failure):
        m = load()
        temp = tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        m.RECORD = root / 'journal';m.TARGET = root / 'target';m.BACKUPS = m.TARGET / 'backups'
        m.SCRATCH_PARENT = root / 'scratch';m.SCRATCH = m.SCRATCH_PARENT / 'carserviceapp-restore-test-fixture'
        docker = FakeDocker(m);m.command = docker
        m.common = Mock();m.trusted = Mock();m.confirm = Mock()
        m.source_metadata = lambda: ({'fixture-root': [1, 2, 3]}, {'data': 126976, 'uploads': 0})
        m.capture_source = Mock(return_value=copy.deepcopy(SNAP))
        m.migration_history = lambda p: SNAP['history']
        pair = root / 'pair'
        storage = SimpleNamespace(backup=Mock(return_value=pair), restore_test=Mock(),
                                  database_info=lambda p: SNAP['counts'], inventory=lambda p: SNAP['uploads'])
        if failure == 'backup':
            storage.backup.side_effect = RuntimeError('fixture-backup-failure')
        if failure == 'restore':
            storage.restore_test.side_effect = RuntimeError('fixture-restore-failure')
        m.storage_module = Mock(return_value=storage)
        a = dict(window(), max_upload_restore_bytes=1024,
                 decision_deadline_utc=(dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=30)).isoformat())
        if failure in ('expire-backup', 'expire-verify'):
            expires_after = storage.backup if failure == 'expire-backup' else storage.restore_test
            def after_phase(*args, **kwargs):
                a['window_end_utc'] = '2000-01-01T00:00:00Z'
                return pair
            expires_after.side_effect = after_phase
        actual_stat = Path.stat
        def device(path, *args, **kwargs):
            if path in (Path('/srv'), Path('/var/tmp'), Path('/var/lib/carservice-test-deploy'), m.RECORD.parent):
                return SimpleNamespace(st_dev=1)
            return actual_stat(path, *args, **kwargs)
        with patch.object(Path, 'stat', device), patch.object(m.os, 'statvfs',
                return_value=SimpleNamespace(f_bavail=30*1024**3, f_frsize=1)):
            if failure:
                with self.assertRaises(RuntimeError):
                    m.run(a, 'a' * 64)
            else:
                m.run(a, 'a' * 64)
        self.assertEqual([c[-1] for c in docker.commands if c[0] == 'stop'],
                         [m.IDENTITIES[s][0] for s in ('frontend', 'backend')])
        self.assertFalse(any(c[0] == 'start' for c in docker.commands))
        self.assertEqual((m.RECORD / 'gate-c-pass.json').exists(), not bool(failure))
        self.assertTrue((m.RECORD / 'source-capture.json').exists())
        if failure in ('backup', 'expire-backup'):
            storage.restore_test.assert_not_called()

    def test_success_keeps_containers_stopped(self):
        self.scenario(None)

    def test_backup_failure_never_restores_or_restarts(self):
        self.scenario('backup')

    def test_restore_failure_preserves_source_and_stopped_state(self):
        self.scenario('restore')

    def test_window_expires_during_backup(self):
        self.scenario('expire-backup')

    def test_window_expires_during_verification(self):
        self.scenario('expire-verify')


if __name__ == '__main__':
    unittest.main()
