#!/usr/bin/python3
"""Gate C only: exact-ID stop, paired backup, scratch restore; explicit recovery.
Run through isolated Python and the fingerprint-verifying operator launcher.
Never performs cutover, compose up/down/build/pull, source restore or ingress edits.
Custody is an operator-enforced continuous exclusion, not proved by this script.
"""
import argparse
from contextlib import contextmanager
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import subprocess
import sys
import time
import types

PROJECT = 'carserviceapp-test'
NETWORK = 'carserviceapp-test_workshop'
NETID = '6e4eaf575df61b771a31e7cadae785dd345a3f3ebae9b999e7c51c7524be9469'
IDENTITIES = {
    'backend': ('54711d72a221cc11f51621e5729cd97944885b83309059a6fc6fac9cafe8223a',
                'sha256:352a129e796973753451b7eaa86b7acaf85c93f33e41b3ade5607b79bf534d05'),
    'frontend': ('1d43ef14056134965e33f95153d0cec5de45f4b5c25380c08a5ae06d8a134696',
                 'sha256:baa2fe08115174dce95caba06ab391e6d6b153a2babf5829a545698c3847f761'),
}
PARENT = Path('/opt/carserviceapp')
DATA, UPLOADS = PARENT / 'test-data', PARENT / 'test-uploads'
DB = DATA / 'app.db'
TARGET = Path('/srv/carserviceapp-test')
BACKUPS = TARGET / 'backups'
SCRATCH_PARENT = Path('/var/tmp/carservice-gate-c')
SCRATCH = SCRATCH_PARENT / 'carserviceapp-restore-test-gate-c'
RECORD = Path('/var/lib/carservice-test-deploy/gate-c')
HELPER = Path('/usr/local/sbin/ops_storage.py')
HELPER_HASH = '90ddda01a6aba871c10441900506889d819571069d03f2d764c867ca9940f2dc'
DOCKER = ['/usr/bin/docker', '--host', 'unix:///var/run/docker.sock']
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root', 'LC_ALL': 'C'}
SUBNET, GATEWAY = '172.30.91.0/24', '172.30.91.1'
ADDRESSES = {'backend': '172.30.91.2', 'frontend': '172.30.91.3'}
FRONTEND_PORT = '5174'


def need(ok, code):
    if not ok:
        raise RuntimeError(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_object(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, 'duplicate-json-key')
        result[key] = value
    return result


def decode_json(raw):
    return json.loads(raw, object_pairs_hook=json_object)


def authenticated_json(path, expected):
    need(isinstance(expected, str) and re.fullmatch('[0-9a-f]{64}', expected), 'approval-fingerprint-required')
    raw = read_file(path, trusted_parent=False, max_bytes=65536)
    need(sha(raw) == expected, 'approval-hash-mismatch')
    result = decode_json(raw)
    need(isinstance(result, dict), 'approval-object-required')
    return result


def require_text(a, keys):
    for key in keys:
        need(isinstance(a.get(key), str) and a[key].strip() and
             'UNRESOLVED' not in a[key], 'unresolved-approval-field')


def verified_reference(a, key):
    require_text(a, (key, key + '_sha256'))
    p = Path(a[key])
    need(p.is_absolute() and '..' not in p.parts and not p.is_relative_to(PARENT), 'unsafe-reference-path')
    raw = read_file(p, private=True)
    need(re.fullmatch('[0-9a-f]{64}', a[key + '_sha256']) and sha(raw) == a[key + '_sha256'],
         'reviewed-reference-hash-mismatch')
    return raw


@contextmanager
def operation_lock():
    path = RECORD.parent / 'gate-c-operation.lock'
    trusted(path.parent, 0o700)
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    try:
        s = os.fstat(fd)
        need(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_uid == s.st_gid == 0
             and stat.S_IMODE(s.st_mode) == 0o600, 'untrusted-operation-lock')
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally:
        os.close(fd)


def trusted(path, exact_mode=None, temp=False):
    for p in reversed((path, *path.parents)):
        s = p.lstat()
        sticky_temp = temp and p == Path('/var/tmp') and stat.S_IMODE(s.st_mode) == 0o1777
        need(stat.S_ISDIR(s.st_mode) and s.st_uid == s.st_gid == 0 and
             (sticky_temp or not s.st_mode & 0o022), 'untrusted-directory')
    if exact_mode is not None:
        need(stat.S_IMODE(path.lstat().st_mode) == exact_mode, 'directory-mode')


def read_file(path, private=False, trusted_parent=True, max_bytes=16 * 1024**2):
    if trusted_parent:
        trusted(path.parent)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as f:
        s = os.fstat(f.fileno())
        need(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_size <= max_bytes, 'file-type-size-or-hardlink')
        if trusted_parent:
            need(s.st_uid == s.st_gid == 0 and not s.st_mode & 0o022, 'untrusted-file')
        if private:
            need(stat.S_IMODE(s.st_mode) == 0o600 and s.st_uid == s.st_gid == 0, 'private-file')
        data = f.read(max_bytes + 1)
        need(len(data) <= max_bytes, 'control-file-too-large')
        return data


def absent(path):
    need(not os.path.lexists(path), 'destination-or-marker-present')


def write_new(path, value):
    content = json.dumps(value, sort_keys=True, indent=2).encode() + b'\n'
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(content)
        f.flush()
        os.fchmod(f.fileno(), 0o600)
        os.fsync(f.fileno())
    fd = os.open(path.parent, os.O_DIRECTORY | os.O_RDONLY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def confirm(text, token):
    with open('/dev/tty', 'r+') as terminal:
        terminal.write(text + '\nType exactly: ' + token + '\n> ')
        terminal.flush()
        need(terminal.readline().strip() == token, 'operator-refused')


def command(arguments, timeout=60):
    result = subprocess.run(DOCKER + arguments, env=ENV, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    need(result.returncode == 0, 'docker-command-failed')
    return result.stdout.decode()


def inspect(service):
    cid, image = IDENTITIES[service]
    # Selected metadata only: never request Config.Env, health logs or command args.
    expressions = ['.Id', '.Image', '.Config.Labels', '.State.Status', '.State.Running']
    tail = ['.Mounts', '.NetworkSettings.Networks', '.HostConfig.PortBindings',
            '.HostConfig.AutoRemove', '.HostConfig.RestartPolicy', '.HostConfig.NetworkMode',
            '.State.Restarting', '.State.Paused', '.State.Dead', '.State.StartedAt', '.State.FinishedAt']
    health = '{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}}'
    format_string = '[' + ','.join(['{{json ' + e + '}}' for e in expressions] +
                                 [health] + ['{{json ' + e + '}}' for e in tail]) + ']'
    v = json.loads(command(['inspect', '--format', format_string, cid]))
    need(v[0] == cid and v[1] == image and v[2].get('com.docker.compose.project') == PROJECT
         and v[2].get('com.docker.compose.service') == service, 'container-identity-changed')
    need(v[9] is False, 'autoremove-container')
    need(v[11] in (NETWORK, NETID) and not any(v[12:15]), 'ambiguous-container-state')
    need((v[3] == 'running' and v[4] is True) or (v[3] == 'exited' and v[4] is False),
         'ambiguous-container-state')
    expected_mounts = [] if service == 'frontend' else [
        ('bind', str(DATA), '/app/data', True), ('bind', str(UPLOADS), '/app/uploads', True)]
    mounts = sorted((m['Type'], m['Source'], m['Destination'], m['RW']) for m in v[6])
    need(mounts == sorted(expected_mounts), 'legacy-mounts-changed')
    ports = {'8080/tcp': [{'HostIp': '127.0.0.1', 'HostPort': FRONTEND_PORT}]} if service == 'frontend' else {}
    need((v[8] or {}) == ports, 'published-ports-changed')
    need(set(v[7]) == {NETWORK}, 'container-network-changed')
    endpoint = v[7][NETWORK]
    # Configured endpoint intent persists while active endpoint fields may be
    # cleared at stop. Always bind intent to the independently inspected network.
    ipam = endpoint.get('IPAMConfig') or {}
    need(ipam.get('IPv4Address') == ADDRESSES[service], 'configured-address-changed')
    if v[4]:
        need(endpoint.get('NetworkID') == NETID and endpoint.get('IPAddress') == ADDRESSES[service]
             and endpoint.get('Gateway') == GATEWAY, 'network-address-changed')
    else:
        need(endpoint.get('NetworkID', '') in ('', NETID) and
             endpoint.get('IPAddress', '') in ('', ADDRESSES[service]) and
             endpoint.get('Gateway', '') in ('', GATEWAY), 'stopped-network-metadata-changed')
    return {'id': v[0], 'image': v[1], 'status': v[3], 'running': v[4], 'health': v[5],
            'mounts': sorted(v[6], key=lambda m: m['Destination']),
            'networks': v[7], 'ports': v[8], 'restart': v[10],
            'started_at': v[15], 'finished_at': v[16]}


def check_network():
    values = json.loads(command(['network', 'inspect', '--format',
        '[{{json .Id}},{{json .IPAM.Config}},{{json .Containers}}]', NETWORK]))
    need(values[0] == NETID and values[1] == [{'Subnet': SUBNET, 'Gateway': GATEWAY}],
         'network-changed')
    need(set(values[2] or {}) <= {v[0] for v in IDENTITIES.values()}, 'unexpected-network-peer')


def check_pair(healthy=False, stopped=False):
    ids = command(['ps', '-aq', '--no-trunc', '--filter',
                   'label=com.docker.compose.project=' + PROJECT]).split()
    need(set(ids) == {v[0] for v in IDENTITIES.values()} and len(ids) == 2, 'test-service-set-changed')
    check_network()
    states = {service: inspect(service) for service in IDENTITIES}
    if healthy:
        need(all(s['running'] and s['status'] == 'running' and s['health'] == 'healthy'
                 for s in states.values()), 'test-not-healthy')
    if stopped:
        need(all(not s['running'] and s['status'] == 'exited' for s in states.values()), 'writers-not-stopped')
    return states


def no_alias_mounts():
    roots = (DATA, UPLOADS, TARGET, SCRATCH_PARENT, RECORD)
    with open('/proc/self/mountinfo', encoding='ascii') as f:
        for line in f:
            mount = line.split()[4]
            for a, b in (('\\040', ' '), ('\\011', '\t'), ('\\012', '\n'), ('\\134', '\\')):
                mount = mount.replace(a, b)
            p = Path(mount)
            need(not any(p == r or r in p.parents for r in roots), 'scoped-submount')


def source_metadata():
    trusted(Path('/opt'))
    parent = PARENT.lstat()
    need(stat.S_ISDIR(parent.st_mode) and parent.st_uid == parent.st_gid == 1000
         and stat.S_IMODE(parent.st_mode) == 0o750, 'legacy-parent-changed')
    result, sizes = {}, {'data': 0, 'uploads': 0}
    for label, root in (('data', DATA), ('uploads', UPLOADS)):
        root_s = root.lstat()
        need(stat.S_ISDIR(root_s.st_mode) and root_s.st_uid == root_s.st_gid == 1654
             and stat.S_IMODE(root_s.st_mode) == 0o700, 'source-root-changed')
        entries = [(root, root_s)]
        def walk_error(error):
            raise RuntimeError('source-walk-failed')
        for base, dirs, names in os.walk(root, followlinks=False, onerror=walk_error):
            for name in dirs + names:
                p = Path(base) / name
                entries.append((p, p.lstat()))
        for p, s in entries:
            sqlite_sidecar = p in (Path(str(DB) + '-wal'), Path(str(DB) + '-shm'))
            owner_ok = s.st_uid == s.st_gid == 1654 or (sqlite_sidecar and s.st_uid == s.st_gid == 0)
            need(s.st_dev == root_s.st_dev and owner_ok
                 and not s.st_mode & 0o022 and
                 (stat.S_ISDIR(s.st_mode) or (stat.S_ISREG(s.st_mode) and s.st_nlink == 1)),
                 'unsafe-source-entry')
            if stat.S_ISREG(s.st_mode):
                sizes[label] += s.st_size
            # Names retained only in private record; never included in exceptions.
            result[str(p)] = [s.st_dev, s.st_ino, s.st_mode, s.st_uid, s.st_gid, s.st_nlink]
    need(stat.S_ISREG(DB.lstat().st_mode), 'missing-db')
    result['legacy-parent'] = [parent.st_dev, parent.st_ino, parent.st_mode, parent.st_uid, parent.st_gid]
    return result, sizes


def source_compare(before, after, quiesced=False):
    # SQLite read-only WAL access may create sidecars (migration approval covers this).
    # Root-created SQLite sidecars can be root-owned; handled separately below.
    skip = {str(DB) + '-wal', str(DB) + '-shm'}
    need({k: v for k, v in before.items() if k not in skip} ==
         {k: v for k, v in after.items() if k not in skip}, 'source-identity-changed')
    if quiesced:
        need(all(after.get(k) == v for k, v in before.items() if k in skip),
             'existing-sqlite-sidecar-identity-changed')


def common():
    need(sys.version_info >= (3, 12) and os.geteuid() == os.getegid() == 0, 'root-python312-required')
    for p in ('/etc/carservice-test-deploy/actions-enabled', '/etc/carservice-test-deploy/approved.json',
              '/var/lib/carservice-test-deploy/in-progress', '/var/lib/carservice-test-deploy/deploy.lock',
              '/srv/carserviceapp-test/data',
              '/srv/carserviceapp-test/uploads'):
        absent(Path(p))
    trusted(Path('/etc/carservice-test-deploy'), 0o711)
    trusted(Path('/var/lib/carservice-test-deploy'), 0o700)
    trusted(Path('/srv'))
    trusted(Path('/var/tmp'), temp=True)
    no_alias_mounts()


def approval(path, expected):
    a = authenticated_json(path, expected)
    require_text(a, ('maintenance_reference', 'custody_operator', 'recovery_decision_maker',
              'window_start_utc', 'window_end_utc', 'old_path_baseline', 'old_path_baseline_sha256',
              'ingress_close_procedure', 'ingress_closed_verification', 'ingress_reopen_procedure',
              'writer_exclusion_and_custody_plan', 'decision_deadline_utc'))
    need(a.get('gate') == 'C-only' and a.get('gate_c_approved') is True
         and a.get('github_gate_disabled_confirmed') is True, 'gate-c-not-approved')
    bound = a.get('max_upload_restore_bytes')
    need(type(bound) is int and bound > 0, 'unreviewed-restore-bound')
    check_window(a)
    decision = utc(a['decision_deadline_utc'])
    need(utc(a['window_start_utc']) < decision < utc(a['window_end_utc']) and
         now() < decision, 'invalid-or-expired-decision-deadline')
    for key in ('gate_d_procedure', 'old_path_recovery_procedure'):
        verified_reference(a, key)
    need(a.get('gate_d_ready') is True and a.get('old_path_recovery_verified') is True,
         'cutover-and-recovery-not-ready')
    evidence = decode_json(verified_reference(a, 'stopped_docker_test_evidence'))
    need(a.get('stopped_docker_tests_verified') is True and evidence.get('status') == 'PASS'
         and evidence.get('script_sha256') == execution_fingerprint()
         and isinstance(evidence.get('docker_engine_version'), str)
         and set(evidence.get('checks', [])) >= {'running', 'frontend-stopped', 'both-stopped',
             'recover-frontend', 'recover-both', 'reject-wrong-network', 'reject-wrong-image'},
         'disposable-stopped-tests-not-verified')
    data = verified_reference(a, 'old_path_baseline')
    # Require a self-contained JSON recovery baseline. It is never executed here.
    baseline = json.loads(data)
    need(set(baseline.get('services', {})) == set(IDENTITIES), 'baseline-service-set')
    for service, (_, image) in IDENTITIES.items():
        need(baseline['services'][service].get('image') == image and
             not any(k in baseline['services'][service] for k in ('build', 'env_file', 'extends')),
             'baseline-not-same-image-self-contained')
    return a


def storage_module():
    code = read_file(HELPER)
    need(sha(code) == HELPER_HASH, 'storage-helper-hash-mismatch')
    m = types.ModuleType('gate_c_reviewed_storage')
    m.__file__ = str(HELPER)
    exec(compile(code, str(HELPER), 'exec'), m.__dict__)
    return m


def migration_history(db):
    c = sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=10)
    try:
        return [list(row) for row in c.execute(
            'SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory ORDER BY MigrationId')]
    finally:
        c.close()


def fingerprint(db):
    values = {}
    for p in (db, Path(str(db) + '-wal')):
        if p.exists() and (p == db or p.stat().st_size):
            with p.open('rb') as f:
                values[p.name] = hashlib.file_digest(f, 'sha256').hexdigest()
    return values


def now():
    return dt.datetime.now(dt.timezone.utc)


def utc(text):
    value = dt.datetime.fromisoformat(text.replace('Z', '+00:00'))
    need(value.utcoffset() == dt.timedelta(0), 'utc-window-required')
    return value


def check_window(a):
    need(utc(a['window_start_utc']) <= now() < utc(a['window_end_utc']), 'outside-approved-window')
    if a.get('gate') == 'C-only':
        need(now() < utc(a['decision_deadline_utc']), 'decision-deadline-reached')


def execution_fingerprint():
    pinned = globals().get('__verified_script_sha256__')
    return pinned if pinned else sha(Path(__file__).read_bytes())


def event(name, data):
    write_new(RECORD / (name + '.json'), data)


def new_dir(p, temp=False):
    trusted(p.parent, temp=temp)
    os.mkdir(p, 0o700)
    os.chmod(p, 0o700, follow_symlinks=False)
    trusted(p, 0o700, temp=temp)


def capture_source(storage):
    """Stable, offline integrity evidence; never run against a running backend."""
    states = check_pair(stopped=True)
    metadata, _ = source_metadata()
    hashes = fingerprint(DB)
    history = migration_history(DB)
    need(bool(history), 'missing-migration-history')
    counts = storage.database_info(DB)
    uploads = storage.inventory(UPLOADS)
    need(fingerprint(DB) == hashes and migration_history(DB) == history and
         storage.database_info(DB) == counts and storage.inventory(UPLOADS) == uploads,
         'source-not-stable')
    current, _ = source_metadata()
    source_compare(metadata, current, quiesced=True)
    finished = check_pair(stopped=True)
    need(all((states[s]['started_at'], states[s]['finished_at']) ==
             (finished[s]['started_at'], finished[s]['finished_at']) for s in IDENTITIES),
         'source-writer-state-changed')
    return {'history': history, 'counts': counts, 'uploads': uploads,
            'database_hashes': hashes, 'metadata': current}


def source_matches(storage, snap):
    current = capture_source(storage)
    source_compare(snap['metadata'], current['metadata'], quiesced=True)
    need(all(current[k] == snap[k] for k in ('history', 'counts', 'uploads', 'database_hashes')),
         'old-source-integrity-not-established')
    return current


def stop_exact(service, authorization, log):
    check_window(authorization)
    states = check_pair()
    need(states[service]['running'], 'service-not-running-before-stop')
    log('stop-request-' + service, {'id': IDENTITIES[service][0], 'time': now().isoformat()})
    try:
        command(['stop', '--time', '60', IDENTITIES[service][0]], timeout=90)
        s = inspect(service)
        need(not s['running'] and s['status'] == 'exited', 'stop-not-confirmed')
    except Exception:
        log('stop-ambiguous-' + service, {'time': now().isoformat(), 'requires_fresh_recovery_approval': True})
        raise
    log('stopped-' + service, s)


def run(a, a_hash):
    common()
    for p in (RECORD, TARGET, SCRATCH_PARENT):
        absent(p)
    states = check_pair(healthy=True)
    storage = storage_module()
    confirm('Execute the reviewed TEST-only ingress closure now in the operator session.\n'
            'Verify the reviewed external and local ingress tests deny access, exclude existing\n'
            'connections, host/container jobs and direct backend clients. Do not edit shared routes.\n'
            'Maintain exclusion of deploy/UID1000, UID1654, root/Docker administrators,\n'
            'timers, private namespaces and external writers throughout capture.\n'
            'Confirm the named custody plan and both deployment gates disabled.',
            'INGRESS-CLOSED CUSTODY-HELD GATE-C-ONLY')
    common()
    check_window(a)
    check_pair(healthy=True)
    metadata, sizes = source_metadata()
    need(sizes['uploads'] <= a['max_upload_restore_bytes'], 'restore-bound-too-small')
    # Accepted runbook aggregate, same filesystem: Docker 10 GiB + build 2 GiB;
    # paired backup and scratch each 2*S+1 GiB; future destination S. Existing
    # source retained in place is already allocated. No compression credit.
    source_bytes = sum(sizes.values())
    reserve = 14 * 1024**3 + 5 * source_bytes
    devices = {p.stat().st_dev for p in (Path('/srv'), Path('/var/tmp'), Path('/var/lib/carservice-test-deploy'))}
    need(len(devices) == 1, 'separate-filesystem-design-required')
    fs = os.statvfs('/srv')
    need(fs.f_bavail * fs.f_frsize >= reserve, 'execution-time-space-shortfall')
    new_dir(RECORD)
    event('approval', {'approval': a, 'approval_sha256': a_hash, 'container_metadata': states,
                       'source_metadata': metadata, 'source_bytes': source_bytes, 'reserve_bytes': reserve,
                       'script_sha256': execution_fingerprint()})
    new_dir(TARGET)
    new_dir(BACKUPS)
    new_dir(SCRATCH_PARENT, temp=True)
    confirm('Approve downtime now: stop the pinned frontend, then the pinned backend.\n'
            'No cutover or automatic recovery will occur.', 'STOP-EXACT-TEST-IDS')
    for service in ('frontend', 'backend'):
        common()
        check_window(a)
        need(now() < utc(a['decision_deadline_utc']), 'decision-deadline-reached')
        pair_states = check_pair()  # revalidate BOTH identities before every disruptive command
        if service == 'backend':
            need(not pair_states['frontend']['running'], 'frontend-restarted-before-backend-stop')
        current = inspect(service)
        need(current['running'] and current['health'] == 'healthy', 'service-state-changed-before-stop')
        stop_exact(service, a, event)
    check_pair(stopped=True)
    after_stop, stopped_sizes = source_metadata()
    source_compare(metadata, after_stop)
    need(stopped_sizes['uploads'] <= a['max_upload_restore_bytes'], 'restore-bound-too-small')
    fs = os.statvfs('/srv')
    need(fs.f_bavail * fs.f_frsize >= 14 * 1024**3 + 5 * sum(stopped_sizes.values()),
         'stopped-source-space-shortfall')
    confirm('Both exact TEST containers are stopped. Confirm continuous exclusive source custody.\n'
            'Approve source SQLite read-only access (which may create sidecars), paired backup\n'
            'and isolated restore, including private integrity/count/migration/upload checks.',
            'WRITERS-STOPPED CUSTODY-HELD CAPTURE-PAIR')
    check_window(a)
    check_pair(stopped=True)
    event('source-capture-intent', {'time': now().isoformat()})
    snap = capture_source(storage)
    history, counts, uploads = snap['history'], snap['counts'], snap['uploads']
    event('source-capture', snap)
    check_window(a)
    check_pair(stopped=True)
    pair = storage.backup(DB, UPLOADS, BACKUPS, quiesced=True)
    event('paired-backup', {'path': str(pair)})
    check_window(a)
    check_pair(stopped=True)
    storage.restore_test(pair, SCRATCH, max_upload_bytes=a['max_upload_restore_bytes'])
    check_window(a)
    need(migration_history(pair / 'database.sqlite') == history == migration_history(SCRATCH / 'data/app.db'),
         'migration-history-mismatch')
    need(storage.database_info(SCRATCH / 'data/app.db') == counts and
         storage.inventory(SCRATCH / 'uploads') == uploads, 'restored-source-mismatch')
    check_window(a)
    source_matches(storage, snap)
    common()
    check_pair(stopped=True)
    confirm('Confirm custody remained continuous, ingress remains closed and Gate D is NOT approved.',
            'CUSTODY-CONTINUOUS GATE-D-NOT-APPROVED')
    check_window(a)
    need(now() < utc(a['decision_deadline_utc']), 'decision-deadline-reached')
    event('gate-c-pass', {'time': dt.datetime.now(dt.timezone.utc).isoformat(),
                          'pair': str(pair), 'scratch': str(SCRATCH), 'gate_d': 'NOT_APPROVED'})
    print('PASS Gate C: pair and scratch verified; original TEST containers remain stopped; ingress stays closed.')


def recovery_authorization(path, expected, record):
    a = authenticated_json(path, expected)
    require_text(a, ('recovery_id', 'approval_reference', 'decision_maker', 'decision_maker_authority', 'custody_operator',
                     'window_start_utc', 'window_end_utc', 'reason', 'custody_and_stop_settlement_evidence'))
    need(re.fullmatch('[a-z0-9][a-z0-9-]{7,63}', a['recovery_id']), 'invalid-recovery-id')
    need(a.get('gate') == 'C-recovery-only' and a.get('recovery_approved') is True,
         'recovery-not-approved')
    need(a.get('gate_c_approval_sha256') == record['approval_sha256'], 'recovery-wrong-gate-c-record')
    for key in ('custody_continuous', 'ingress_closed', 'github_gate_disabled_confirmed',
                'original_source_authoritative', 'no_gate_d_or_source_overwrite', 'stop_requests_settled',
                'backend_startup_approved'):
        need(a.get(key) is True, 'recovery-safety-not-approved')
    need(a.get('mode') in ('frontend-only', 'existing-capture', 'fresh-quiesced'), 'invalid-recovery-mode')
    need(type(a.get('quiesce_if_required')) is bool, 'quiesce-approval-required')
    if a['mode'] == 'fresh-quiesced':
        need(a.get('fresh_source_verification_approved') is True, 'fresh-integrity-verification-not-approved')
        history = decode_json(verified_reference(a, 'expected_migration_history'))
        need(isinstance(history, list) and history and all(isinstance(row, list) and len(row) == 2
             and all(isinstance(v, str) for v in row) for row in history), 'invalid-expected-migration-history')
    check_window(a)  # Deliberately this authorization, NEVER the original window.
    return a


def record_json(path):
    return decode_json(read_file(path, private=True))


def recover(a, expected, record):
    common()
    trusted(RECORD, 0o700)
    original = record['approval']
    verified_reference(original, 'old_path_baseline')
    verified_reference(original, 'old_path_recovery_procedure')
    check_window(a)
    states = check_pair()
    for service, state in states.items():
        need(state['image'] == record['container_metadata'][service]['image']
             and state['restart'] == record['container_metadata'][service]['restart'], 'recovery-config-changed')
    backend_attempted = os.path.lexists(RECORD / 'stop-request-backend.json')
    if a['mode'] == 'frontend-only':
        need(not backend_attempted and states['backend']['running'] and states['backend']['health'] == 'healthy'
             and states['backend']['started_at'] == record['container_metadata']['backend']['started_at']
             and not a['quiesce_if_required'], 'frontend-only-not-safe')
    else:
        need(backend_attempted, 'unrecorded-backend-stop')
        need(not states['backend']['running'] or
             (a['mode'] == 'fresh-quiesced' and a['quiesce_if_required']), 'backend-still-running')
    confirm('SEPARATE RECOVERY APPROVAL: ' + a['decision_maker'] + '\n'
            'Approve ONLY the retained original TEST IDs, original source still authoritative,\n'
            'settled Docker stop requests, continuous custody, closed ingress and this NEW window.\n'
            'Fresh mode verifies the stopped source anew; it does not certify historical equality.\n'
            'If explicitly selected, quiescing may stop remaining original TEST writers first.\n'
            'No source restore, cutover or automatic ingress reopening is permitted.',
            'APPROVE-RECOVERY-ORIGINAL-TEST-ONLY')
    check_window(a)
    attempt = RECORD / ('recovery-' + a['recovery_id'])
    new_dir(attempt)

    def log(name, value):
        write_new(attempt / (name + '.json'), value)

    log('authorization', {'authorization': a, 'sha256': expected,
                           'gate_c_approval_sha256': record['approval_sha256'], 'time': now().isoformat()})
    storage = None
    if a['mode'] != 'frontend-only':
        storage = storage_module()
        if a['quiesce_if_required']:
            need(a['mode'] == 'fresh-quiesced', 'quiesce-requires-fresh-mode')
            for service in ('frontend', 'backend'):
                common()
                check_window(a)
                if check_pair()[service]['running']:
                    stop_exact(service, a, log)
        check_pair(stopped=True)
        # An earlier Docker request must have settled. Two stable exited snapshots
        # supplement (do not replace) the decision-maker's explicit settlement evidence.
        first = check_pair(stopped=True)
        time.sleep(2)
        second = check_pair(stopped=True)
        if first != second:
            # Fixed field names only: never emit paths, IDs, data or environment.
            fields = ('id', 'image', 'status', 'running', 'health', 'mounts',
                      'networks', 'ports', 'restart', 'started_at', 'finished_at')
            changed = [s + '-' + k.replace('_', '-') for s in ('backend', 'frontend')
                       for k in fields if first[s].get(k) != second[s].get(k)]
            raise RuntimeError('stop-state-not-stable-' + '-'.join(changed or ['unknown-field']))
        check_window(a)
        if a['mode'] == 'existing-capture':
            snap = record_json(RECORD / 'source-capture.json')
            verified = source_matches(storage, snap)
        else:
            verified = capture_source(storage)
            history = decode_json(verified_reference(a, 'expected_migration_history'))
            need(verified['history'] == history, 'unexpected-source-migrations')
            # If a complete original snapshot exists, fresh mode cannot bypass it.
            prior = RECORD / 'source-capture.json'
            if os.path.lexists(prior):
                snap = record_json(prior)
                source_compare(snap['metadata'], verified['metadata'], quiesced=True)
                need(all(verified[k] == snap[k] for k in ('history', 'counts', 'uploads', 'database_hashes')),
                     'original-snapshot-mismatch')
        log('source-verified', verified)
    for service in ('backend', 'frontend'):
        common()
        check_window(a)
        current = check_pair()
        s = current[service]
        if service == 'frontend':
            need(current['backend']['running'] and current['backend']['health'] == 'healthy', 'backend-not-ready')
        if not s['running']:
            need(os.path.lexists(RECORD / ('stop-request-' + service + '.json')) or
                 os.path.lexists(attempt / ('stop-request-' + service + '.json')), 'unrecorded-stop')
            if service == 'backend':
                source_matches(storage, verified)
            check_window(a)
            log('restart-request-' + service, {'id': IDENTITIES[service][0], 'time': now().isoformat()})
            command(['start', IDENTITIES[service][0]], timeout=90)
        deadline = time.monotonic() + 180
        while True:
            check_window(a)
            s = inspect(service)
            need(s['running'], 'recovery-service-exited')
            if s['health'] == 'healthy':
                break
            need(s['health'] != 'unhealthy' and time.monotonic() < deadline, 'recovery-health-failed')
            time.sleep(2)
        log('healthy-' + service, s)
    common()
    check_window(a)
    check_pair(healthy=True)
    log('recovered-original-containers', {'time': now().isoformat()})
    print('PASS retained original TEST containers healthy. Ingress remains closed pending separate acceptance/reopen.')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='mode', required=True)
    r = sub.add_parser('run')
    r.add_argument('--approval', type=Path, required=True)
    r.add_argument('--approval-sha256', required=True)
    recovery = sub.add_parser('recover')
    recovery.add_argument('--authorization', type=Path, required=True)
    recovery.add_argument('--authorization-sha256', required=True)
    args = p.parse_args()
    os.umask(0o077)
    try:
        common()
        if args.mode == 'run':
            a = approval(args.approval, args.approval_sha256)
            with operation_lock():
                run(a, args.approval_sha256)
        else:
            trusted(RECORD, 0o700)
            record = record_json(RECORD / 'approval.json')
            a = recovery_authorization(args.authorization, args.authorization_sha256, record)
            with operation_lock():
                recover(a, args.authorization_sha256, record)
        return 0
    except Exception as error:
        code = str(error) if isinstance(error, RuntimeError) and re.fullmatch('[a-z0-9-]+', str(error)) else type(error).__name__
        print('STOP Gate C: ' + code, file=sys.stderr)
        print('No automatic restart, ingress reopening, cleanup or Gate D. Preserve private evidence.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
