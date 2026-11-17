#!/usr/bin/python3
"""Gate D candidate. No action without authenticated operation-specific approval.
Never activates deployment, restores over a source, pulls/builds, or reopens ingress.
"""
import argparse
import copy
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import sqlite3
import stat
import subprocess
import sys
import time
import types

C_HASH = 'a0fae6538c6b64e4160041c274cc4f8662e38e93b677504f867026f0f8208989'
STATE = Path('/var/lib/carservice-test-deploy/gate-d')
TARGET = Path('/srv/carserviceapp-test')
OLD_DATA = Path('/opt/carserviceapp/test-data')
OLD_UPLOADS = Path('/opt/carserviceapp/test-uploads')
OWNER = (1654, 1654)
HERE = Path(__file__).resolve().parent
C = None


def need(ok, code):
    if not ok:
        raise RuntimeError(code)


def load_c():
    raw = (HERE / 'gate-c.py').read_bytes()
    need(hashlib.sha256(raw).hexdigest() == C_HASH, 'gate-c-dependency-hash')
    m = types.ModuleType('reviewed_gate_c')
    m.__file__ = str(HERE / 'gate-c.py')
    exec(compile(raw, m.__file__, 'exec'), m.__dict__)
    return m


def root_checks():
    need(os.geteuid() == os.getegid() == 0 and sys.version_info >= (3, 12), 'root-python312-required')
    for p in ('/etc/carservice-test-deploy/actions-enabled', '/etc/carservice-test-deploy/approved.json',
              '/var/lib/carservice-test-deploy/in-progress', '/var/lib/carservice-test-deploy/deploy.lock'):
        C.absent(Path(p))
    C.trusted(TARGET, 0o700)
    C.trusted(STATE.parent, 0o700)
    C.no_alias_mounts()
    need(Path('/var/tmp').stat().st_dev == TARGET.stat().st_dev, 'scratch-filesystem-design-required')
    with open('/proc/self/mountinfo', encoding='ascii') as stream:
        for line in stream:
            mount = line.split()[4]
            for old,new in (('\\040',' '),('\\011','\t'),('\\012','\n'),('\\134','\\')):
                mount=mount.replace(old,new)
            p=Path(mount)
            need(not (p == STATE or STATE in p.parents), 'journal-submount')


def reference(a, key):
    return C.verified_reference(a, key)


def log(directory, name, value):
    C.write_new(directory / (name + '.json'), value)


def backend_paths(model):
    vols = model['services']['backend'].get('volumes', [])
    need(len(vols) == 2 and all(isinstance(v, dict) for v in vols), 'backend-volume-shape')
    result = {}
    for v in vols:
        need(v.get('type') == 'bind' and v.get('read_only', False) is False and
             v.get('bind', {}).get('create_host_path') is False, 'unsafe-bind')
        need(v.get('target') not in result, 'duplicate-bind')
        result[v['target']] = v['source']
    return result


def validate_model(model, layout):
    need(set(model) <= {'name', 'services', 'networks'} and model.get('name') == C.PROJECT,
         'compose-project-or-directives')
    need(set(model.get('services', {})) == {'backend', 'frontend'}, 'compose-service-set')
    need(model.get('networks') == {'workshop': {'name': C.NETWORK, 'external': True}}, 'external-network-required')
    paths = (OLD_DATA, OLD_UPLOADS) if layout == 'old' else (TARGET / 'data', TARGET / 'uploads')
    need(backend_paths(model) == {'/app/data': str(paths[0]), '/app/uploads': str(paths[1])}, 'compose-storage-layout')
    for service, spec in model['services'].items():
        need(spec.get('image') == C.IDENTITIES[service][1], 'exact-image-required')
        need(not any(k in spec for k in ('build', 'extends', 'env_file', 'include', 'develop', 'profiles',
             'volumes_from', 'network_mode', 'devices', 'configs', 'secrets')) and
             not spec.get('privileged', False), 'unsupported-service-directive')
        need(spec.get('networks') == {'workshop': {'ipv4_address': C.ADDRESSES[service]}}, 'compose-static-network')
        need(spec.get('scale', 1) == 1 and spec.get('deploy', {}).get('replicas', 1) == 1, 'extra-replicas')
    front = model['services']['frontend']
    need(not front.get('volumes') and not model['services']['backend'].get('ports'), 'unexpected-mount-or-port')
    ports = front.get('ports', [])
    need(len(ports) == 1 and isinstance(ports[0], dict), 'frontend-port-shape')
    p = ports[0]
    need(p.get('target') == 8080 and str(p.get('published')) == '5174' and
         p.get('host_ip') == '127.0.0.1' and p.get('protocol', 'tcp') == 'tcp', 'frontend-publication')


def validate_models(old, new):
    validate_model(old, 'old'); validate_model(new, 'new')
    expected = copy.deepcopy(old)
    for v in expected['services']['backend']['volumes']:
        v['source'] = str(TARGET / ('data' if v['target'] == '/app/data' else 'uploads'))
    need(expected == new, 'baseline-drift-beyond-storage')


def authorize(path, digest, mode):
    a = C.authenticated_json(path, digest)
    need(a.get('operation') == mode and a.get('approved') is True, 'operation-not-approved')
    C.require_text(a, ('approval_id', 'decision_maker', 'approval_reference', 'window_start_utc', 'window_end_utc'))
    need(re.fullmatch('[a-z0-9][a-z0-9-]{7,63}', a['approval_id']), 'invalid-approval-id')
    for flag in ('ingress_closed', 'custody_continuous', 'github_gate_disabled', 'no_other_automation'):
        need(a.get(flag) is True, 'safety-not-approved')
    C.check_window(a)
    original = C.record_json(C.RECORD / 'approval.json')
    need(a.get('gate_c_approval_sha256') == original['approval_sha256'], 'wrong-gate-c-record')
    need(original.get('script_sha256') == C_HASH, 'unreviewed-gate-c-implementation')
    old = C.decode_json(reference(a, 'old_model'))
    new = C.decode_json(reference(a, 'new_model'))
    validate_models(old, new)
    need(a['new_model'] == '/etc/carservice-test-deploy/baseline/compose.json' and
         a['runtime_environment'] == '/etc/carservice-test-deploy/environment', 'runtime-config-path-contract')
    reference(a, 'runtime_environment')
    history = C.decode_json(reference(a, 'expected_history'))
    need(isinstance(history, list) and bool(history), 'missing-history')
    need(type(a.get('max_upload_bytes')) is int and a['max_upload_bytes'] > 0, 'unreviewed-upload-bound')
    if mode == 'old-path-recover':
        need(a.get('no_required_new_writes') is True and a.get('discard_validation_writes_approved') is True
             and a.get('ambiguous_operations_settled') is True, 'old-recovery-not-safe')
    if mode in ('old-path-recover', 'forward-capture', 'resume-new', 'accept'):
        ids = a.get('current_ids', {})
        need(set(ids) == {'backend', 'frontend'} and all(re.fullmatch('[0-9a-f]{64}', v) for v in ids.values())
             and len(set(ids.values())) == 2, 'approved-current-ids-required')
    return a


def pair(ids, layout, healthy=False, stopped=False):
    before = C.IDENTITIES, C.DATA, C.UPLOADS
    try:
        C.IDENTITIES = {s: (ids[s], before[0][s][1]) for s in ('backend', 'frontend')}
        C.DATA, C.UPLOADS = (OLD_DATA, OLD_UPLOADS) if layout == 'old' else (TARGET / 'data', TARGET / 'uploads')
        return C.check_pair(healthy=healthy, stopped=stopped)
    finally:
        C.IDENTITIES, C.DATA, C.UPLOADS = before


def command(args, timeout=180):
    return C.command(args, timeout=timeout)


def compose(a, key, tail):
    # Reauthenticate inputs before every native config/start. Never uses checkout dotenv.
    reference(a, key); reference(a, 'runtime_environment')
    C.trusted(STATE.parent / 'home', 0o700)
    return command(['compose', '--project-name', C.PROJECT, '--project-directory', str(STATE.parent / 'home'),
        '--env-file', a['runtime_environment'], '-f', a[key]] + tail)


def native_models(a):
    old = C.decode_json(compose(a, 'old_model', ['config', '--format', 'json']))
    new = C.decode_json(compose(a, 'new_model', ['config', '--format', 'json']))
    validate_models(old, new)


def tree(root):
    s = root.lstat()
    need(stat.S_ISDIR(s.st_mode), 'source-directory-required')
    result = []
    def fail(error):
        raise RuntimeError('tree-walk-failed')
    for base, dirs, files in os.walk(root, followlinks=False, onerror=fail):
        for name in dirs + files:
            p = Path(base) / name
            st = p.lstat()
            need(st.st_dev == s.st_dev and (stat.S_ISDIR(st.st_mode) or
                 (stat.S_ISREG(st.st_mode) and st.st_nlink == 1)), 'linked-special-or-cross-device-entry')
            result.append((p.relative_to(root), st))
    return result


def copy_tree(source, dest):
    entries = tree(source)
    os.mkdir(dest, 0o700)
    for rel, st in sorted(entries, key=lambda item: (len(item[0].parts), str(item[0]))):
        target = dest / rel
        if stat.S_ISDIR(st.st_mode):
            os.mkdir(target, 0o700)
        else:
            fd = os.open(source / rel, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            with os.fdopen(fd, 'rb') as src:
                current = os.fstat(src.fileno())
                need((current.st_dev, current.st_ino, current.st_size, current.st_mtime_ns) ==
                     (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns), 'copy-source-changed')
                outfd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                with os.fdopen(outfd, 'wb') as out:
                    while block := src.read(1024 * 1024):
                        out.write(block)
                    out.flush(); os.fchmod(out.fileno(), 0o600); os.fsync(out.fileno())
                end = os.fstat(src.fileno())
                need((end.st_dev,end.st_ino,end.st_size,end.st_mtime_ns,end.st_ctime_ns) ==
                     (current.st_dev,current.st_ino,current.st_size,current.st_mtime_ns,current.st_ctime_ns), 'copy-source-changed')


def publish_exclusive(source, dest):
    libc = ctypes.CDLL(None, use_errno=True)
    need(hasattr(libc, 'renameat2'), 'exclusive-rename-unavailable')
    fn = libc.renameat2
    fn.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    fn.restype = ctypes.c_int
    if fn(-100, os.fsencode(source), -100, os.fsencode(dest), 1):
        raise OSError(ctypes.get_errno(), 'exclusive-publication-failed')
    fd = os.open(dest.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def data_view(data, uploads, storage):
    """Read application DB as its owner; never create root-owned live WAL/SHM.
    Open trusted directory FDs before dropping credentials, so root-private host
    ancestors need no permission changes. Only this fork reads through proc FDs.
    """
    tree(data); tree(uploads)
    df = os.open(data, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    uf = os.open(uploads, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    uid, gid = os.fstat(df).st_uid, os.fstat(df).st_gid
    need(uid in (0, OWNER[0]), 'unexpected-data-owner')
    need((os.fstat(uf).st_uid, os.fstat(uf).st_gid) == (uid,gid), 'storage-owner-mismatch')
    r, w = os.pipe()
    pid = os.fork()
    if pid == 0:
        try:
            os.close(r); signal.alarm(180)
            if os.geteuid() == 0:
                os.setgroups([]); os.setgid(gid); os.setuid(uid)
            need(os.geteuid() == uid, 'reader-owner-mismatch')
            db = Path('/proc/self/fd') / str(df) / 'app.db'
            up = Path('/proc/self/fd') / str(uf)
            value = {'history':C.migration_history(db), 'counts':storage.database_info(db),
                     'uploads':storage.inventory(up)}
            connection = sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=10)
            try:
                digest = hashlib.sha256()
                for statement in connection.iterdump():
                    digest.update(statement.encode('utf-8')); digest.update(b'\n')
                value['logical_sha256'] = digest.hexdigest()
            finally:
                connection.close()
            raw = json.dumps(value).encode()
            while raw:
                raw = raw[os.write(w, raw):]
            os._exit(0)
        except BaseException:
            os._exit(1)
    os.close(w); os.close(df); os.close(uf)
    content = bytearray()
    try:
        while block := os.read(r, 65536):
            content.extend(block)
            need(len(content) <= 16*1024**2, 'verification-report-too-large')
    finally:
        os.close(r); _, status = os.waitpid(pid, 0)
    need(status == 0, 'owner-reader-integrity-failed')
    return C.decode_json(content)


def verify_data(data, uploads, expected, storage, standalone=False):
    tree(data); tree(uploads)
    if standalone:
        need(set(p.name for p in data.iterdir()) == {'app.db'}, 'standalone-database-sidecars-or-extras')
    actual = data_view(data, uploads, storage)
    need(actual['history'] == expected['history'], 'migration-history-mismatch')
    need(actual['counts'] == expected['counts'], 'database-integrity-or-count-mismatch')
    need(actual['uploads'] == expected['uploads'], 'upload-inventory-mismatch')
    if 'logical_sha256' in expected:
        need(actual['logical_sha256'] == expected['logical_sha256'], 'logical-database-content-mismatch')


def materialize(scratch, target, expected, storage, approval_id):
    C.trusted(target, 0o700)
    C.absent(target / 'data'); C.absent(target / 'uploads')
    verify_data(scratch / 'data', scratch / 'uploads', expected, storage, standalone=True)
    expected = dict(expected, logical_sha256=data_view(scratch/'data',scratch/'uploads',storage)['logical_sha256'])
    def database_digest(path):
        with path.open('rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()
    original_db = database_digest(scratch/'data/app.db')
    total = sum(s.st_size for p in ('data', 'uploads') for _, s in tree(scratch / p) if stat.S_ISREG(s.st_mode))
    fs = os.statvfs(target)
    need(fs.f_bavail * fs.f_frsize >= total + 16*1024**2, 'materialization-space-shortfall')
    stage = target / ('.gate-d-' + approval_id)
    C.new_dir(stage)
    copy_tree(scratch / 'data', stage / 'data'); copy_tree(scratch / 'uploads', stage / 'uploads')
    verify_data(stage / 'data', stage / 'uploads', expected, storage, standalone=True)
    need(database_digest(stage/'data/app.db') == original_db, 'copied-db-byte-mismatch')
    for leaf in ('data', 'uploads'):
        root = stage / leaf
        for rel, st in tree(root):
            os.chown(root / rel, *OWNER, follow_symlinks=False)
            os.chmod(root / rel, 0o700 if stat.S_ISDIR(st.st_mode) else 0o600, follow_symlinks=False)
        os.chown(root, *OWNER, follow_symlinks=False); os.chmod(root, 0o700)
        for p in [root / r for r, _ in tree(root)] + [root]:
            fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            try: os.fsync(fd)
            finally: os.close(fd)
    C.trusted(target, 0o700)
    publish_exclusive(stage / 'data', target / 'data')
    publish_exclusive(stage / 'uploads', target / 'uploads')
    verify_data(target / 'data', target / 'uploads', expected, storage, standalone=True)
    need(database_digest(target/'data/app.db') == original_db, 'published-db-byte-mismatch')
    for leaf in ('data', 'uploads'):
        root = target / leaf
        for p in [root] + [root / r for r, _ in tree(root)]:
            st = p.lstat()
            need((st.st_uid, st.st_gid) == OWNER and stat.S_IMODE(st.st_mode) ==
                 (0o700 if stat.S_ISDIR(st.st_mode) else 0o600), 'published-owner-mode')


def recorded_expected(a):
    raw = C.read_file(C.RECORD / 'source-capture.json', private=True)
    need(C.sha(raw) == a.get('source_capture_sha256'), 'wrong-source-capture')
    expected = C.decode_json(raw)
    need(expected['history'] == C.decode_json(reference(a, 'expected_history')), 'approved-history-mismatch')
    return expected


def stopped_verify(ids, layout, expected, storage):
    first = pair(ids, layout, stopped=True)
    data, uploads = (OLD_DATA, OLD_UPLOADS) if layout == 'old' else (TARGET / 'data', TARGET / 'uploads')
    before = C.fingerprint(data / 'app.db')
    verify_data(data, uploads, expected, storage)
    need(before == C.fingerprint(data / 'app.db'), 'verification-source-changed')
    need(first == pair(ids, layout, stopped=True), 'writer-state-changed')
    if layout == 'old':
        need(before == expected['database_hashes'], 'old-source-content-changed')
        metadata, _ = C.source_metadata()
        C.source_compare(expected['metadata'], metadata, quiesced=True)


def stop_pair(ids, layout, a, directory):
    for service in ('frontend', 'backend'):
        root_checks(); C.check_window(a)
        states = pair(ids, layout)
        if states[service]['running']:
            log(directory, 'stop-intent-' + service, {'id': ids[service], 'time': C.now().isoformat()})
            command(['stop', '--time', '60', ids[service]], timeout=90)
            need(not pair(ids, layout)[service]['running'], 'stop-not-confirmed')
    pair(ids, layout, stopped=True)


def old_authority_admission():
    for name in ('accepted-authority.json','old-authority.json','new-authority-boundary.json'):
        C.absent(STATE / name)


def wait_pair(ids, layout, a):
    deadline = time.monotonic() + 180
    while True:
        C.check_window(a)
        states = pair(ids, layout)
        need(all(s['running'] for s in states.values()), 'startup-exited')
        if all(s['health'] == 'healthy' for s in states.values()):
            return states
        need(time.monotonic() < deadline and all(s['health'] != 'unhealthy' for s in states.values()), 'health-failed')
        time.sleep(2)


def resume_pair(ids, layout, a, directory):
    for service in ('backend','frontend'):
        root_checks(); C.check_window(a)
        states=pair(ids,layout,stopped=service=='backend')
        need(not states[service]['running'], 'resume-target-not-stopped')
        if service=='frontend':
            need(states['backend']['running'] and states['backend']['health']=='healthy', 'backend-not-ready')
        log(directory,'resume-intent-'+service,{'id':ids[service]})
        command(['start',ids[service]],timeout=90)
        deadline=time.monotonic()+180
        while True:
            C.check_window(a)
            state=pair(ids,layout)[service]
            need(state['running'] and state['health']!='unhealthy','resume-health-failed')
            if state['health']=='healthy': break
            need(time.monotonic()<deadline,'resume-health-timeout'); time.sleep(2)
    return wait_pair(ids,layout,a)


def startup(a, key, ids, directory, layout, initial_layout):
    for service in ('backend', 'frontend'):
        root_checks(); C.check_window(a)
        # Backend layout changes at this operation; frontend has no storage.
        pair(ids, initial_layout if service == 'backend' else layout)
        log(directory, 'up-intent-' + service, {'old_id': ids[service], 'time': C.now().isoformat()})
        compose(a, key, ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '180', service])
        found = command(['ps', '-aq', '--no-trunc', '--filter', 'label=com.docker.compose.project=' + C.PROJECT,
                         '--filter', 'label=com.docker.compose.service=' + service]).split()
        need(len(found) == 1 and re.fullmatch('[0-9a-f]{64}', found[0]), 'unexpected-created-service-set')
        ids[service] = found[0]
        states = pair(ids, layout)
        need(states[service]['running'] and states[service]['health'] == 'healthy', 'created-service-not-healthy')
        log(directory, 'up-confirmed-' + service, states[service])
    return wait_pair(ids, layout, a)


def execute(a, digest):
    root_checks(); C.check_window(a)
    mode = a['operation']
    storage = C.storage_module()
    expected = recorded_expected(a) if mode in ('cutover', 'old-path-recover') else None
    if mode == 'cutover':
        C.absent(STATE)
        ids = {s: v[0] for s, v in C.IDENTITIES.items()}
        pair(ids, 'old', stopped=True)
        pass_raw = C.read_file(C.RECORD / 'gate-c-pass.json', private=True)
        need(C.sha(pass_raw) == a.get('gate_c_pass_sha256'), 'gate-c-pass-not-approved')
        passed = C.decode_json(pass_raw)
        pair_record = C.record_json(C.RECORD / 'paired-backup.json')
        need(passed['pair'] == pair_record['path'], 'pair-record-mismatch')
        backup = Path(passed['pair'])
        need(backup.parent == TARGET / 'backups', 'pair-outside-test-backups')
        C.trusted(backup, 0o700)
        need(set(p.name for p in backup.iterdir()) == {'database.sqlite','uploads.tar.gz','manifest.json','SHA256SUMS'}, 'pair-file-set')
        for p in backup.iterdir():
            st = p.lstat()
            need(stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and st.st_uid == st.st_gid == 0
                 and stat.S_IMODE(st.st_mode) == 0o600, 'untrusted-pair-file')
        need(C.sha(C.read_file(backup / 'SHA256SUMS', private=True)) == a.get('pair_checksums_sha256'), 'unapproved-pair-checksums')
        native_models(a)
        stopped_verify(ids, 'old', expected, storage)
        C.confirm('Approve Gate D materialization and same-image startup; startup writes are possible. Ingress stays closed.', 'APPROVE-GATE-D-CUTOVER')
        C.check_window(a)
        C.new_dir(STATE)
        directory = STATE
        log(directory, 'authorization', {'approval': a, 'sha256': digest, 'original_ids': ids.copy()})
        temp = Path('/var/tmp') / ('carservice-gate-d-' + a['approval_id'])
        C.new_dir(temp, temp=True)
        scratch = temp / 'carserviceapp-restore-test-gate-d'
        storage.restore_test(backup, scratch, max_upload_bytes=a['max_upload_bytes'])
        C.check_window(a)
        expected['logical_sha256'] = data_view(scratch/'data',scratch/'uploads',storage)['logical_sha256']
        log(directory,'data-reference',expected)
        stopped_verify(ids,'old',expected,storage)
        materialize(scratch, TARGET, expected, storage, a['approval_id'])
        C.check_window(a)
        stopped_verify(ids, 'old', expected, storage)
        log(directory, 'write-risk-boundary', {'time': C.now().isoformat()})
        startup(a, 'new_model', ids, directory, 'new', 'old')
        log(directory, 'current-ids', ids.copy())
        # Deliberate TEST-only verification stop is included in Gate D approval.
        stop_pair(ids, 'new', a, directory)
        stopped_verify(ids, 'new', expected, storage)
        log(directory, 'stable-verification', {'time': C.now().isoformat(), 'expected_history': expected['history']})
        log(directory, 'cutover-healthy', resume_pair(ids,'new',a,directory))
        print('PASS cutover verification. Ingress CLOSED; acceptance remains separate.')
        return
    C.trusted(STATE, 0o700)
    original = C.record_json(STATE / 'authorization.json')
    need(a.get('gate_d_approval_sha256') == original['sha256'], 'wrong-gate-d-approval')
    ids = a['current_ids'].copy()
    layout = a.get('current_layout')
    need(layout in ('old','new'), 'current-layout-required')
    pair(ids, layout)
    if mode == 'old-path-recover':
        old_authority_admission()
    else:
        need(layout == 'new', 'new-source-required')
        C.absent(STATE / 'old-authority.json')
    C.confirm('Approve ONLY this operation: ' + mode + '. No automatic restore, ingress opening or deployment activation.', 'APPROVE-GATE-D-' + mode.upper())
    C.check_window(a)
    directory = STATE / a['approval_id']; C.new_dir(directory)
    log(directory, 'authorization', {'approval': a, 'sha256': digest})
    if mode == 'old-path-recover':
        stop_pair(ids, layout, a, directory)
        if os.path.lexists(STATE/'data-reference.json'):
            expected['logical_sha256'] = C.record_json(STATE/'data-reference.json')['logical_sha256']
        else:
            C.absent(STATE/'write-risk-boundary.json')
            need(layout == 'old' and ids == {s:v[0] for s,v in C.IDENTITIES.items()},
                 'missing-prewrite-reference-for-replaced-containers')
        # Old authority is checked against immutable Gate C evidence, never overwritten.
        # Network metadata is inspected using current layout; old data verification is separate.
        verify_data(OLD_DATA, OLD_UPLOADS, expected, storage)
        need(C.fingerprint(OLD_DATA / 'app.db') == expected['database_hashes'], 'old-source-changed')
        metadata, _ = C.source_metadata(); C.source_compare(expected['metadata'], metadata, quiesced=True)
        native_models(a)
        startup(a, 'old_model', ids, directory, 'old', layout)
        log(STATE, 'old-authority', {'ids': ids, 'time': C.now().isoformat(), 'approval_sha256': digest})
        print('PASS old-path recovery health. Ingress CLOSED; accept recovery separately.')
    elif mode == 'forward-capture':
        need(a.get('new_source_authoritative') is True, 'new-authority-not-approved')
        reference(a, 'forward_repair_procedure')
        if not os.path.lexists(STATE / 'new-authority-boundary.json'):
            log(STATE, 'new-authority-boundary', {'approval_sha256':digest, 'time':C.now().isoformat()})
        stop_pair(ids, 'new', a, directory)
        # Post-write counts/uploads are intentionally captured anew, never compared to stale Gate C.
        db = TARGET / 'data/app.db'; uploads = TARGET / 'uploads'
        fresh = data_view(TARGET / 'data', uploads, storage)
        need(fresh['history'] == C.decode_json(reference(a, 'expected_history')), 'unexpected-new-schema')
        sidecars = {Path(str(db)+suffix):os.path.lexists(str(db)+suffix) for suffix in ('-wal','-shm')}
        output = TARGET / 'backups' / ('forward-' + a['approval_id']); C.new_dir(output)
        backup = storage.backup(db, uploads, output, quiesced=True)
        log(directory, 'forward-pair-created', {'pair':str(backup)})
        # The root-run pinned backup may create WAL/SHM during read access. Only
        # its newly created sidecars in NEW storage may receive the documented
        # application owner. No old-source permission or source bytes change.
        for p, existed in sidecars.items():
            if not existed and os.path.lexists(p):
                st = p.lstat()
                need(stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and st.st_uid == st.st_gid == 0,
                     'unexpected-backup-sidecar')
                need(p.name.endswith('-shm') or st.st_size == 0, 'unexpected-nonempty-new-wal')
                os.chown(p,*OWNER,follow_symlinks=False); os.chmod(p,0o600,follow_symlinks=False)
        temp = Path('/var/tmp') / ('carservice-forward-' + a['approval_id']); C.new_dir(temp, temp=True)
        scratch = temp / 'carserviceapp-restore-test-forward'
        C.check_window(a); storage.restore_test(backup, scratch, max_upload_bytes=a['max_upload_bytes'])
        verify_data(scratch/'data', scratch/'uploads', fresh, storage, standalone=True)
        verify_data(TARGET/'data', TARGET/'uploads', fresh, storage)
        C.check_window(a); pair(ids, 'new', stopped=True)
        log(directory, 'forward-pair-verified', {'pair':str(backup), 'scratch':str(scratch), 'evidence':fresh})
        print('PASS latest NEW pair verified. TEST stays stopped for separately approved forward repair; NEVER restart old data.')
    elif mode == 'resume-new':
        need(a.get('new_source_authoritative') is True and a.get('repair_completed_and_accepted') is True,
             'forward-resume-not-approved')
        proof = C.decode_json(reference(a,'forward_evidence'))
        need(os.path.lexists(STATE/'new-authority-boundary.json'),'no-forward-authority-record')
        fresh = proof['evidence']
        need(fresh['history'] == C.decode_json(reference(a,'expected_history')), 'forward-history-mismatch')
        backup=Path(proof['pair'])
        need(backup.is_relative_to(TARGET/'backups') and backup!=TARGET/'backups','forward-pair-path')
        C.trusted(backup,0o700)
        temp=Path('/var/tmp')/('carservice-resume-'+a['approval_id']); C.new_dir(temp,temp=True)
        scratch=temp/'carserviceapp-restore-test-resume'
        storage.restore_test(backup,scratch,max_upload_bytes=a['max_upload_bytes'])
        verify_data(scratch/'data',scratch/'uploads',fresh,storage,standalone=True)
        C.check_window(a)
        stopped_verify(ids,'new',fresh,storage)
        log(directory,'resumed-new',resume_pair(ids,'new',a,directory))
        print('PASS NEW storage resumed. Ingress CLOSED; separately accept recovery/reopening. No old data restored.')
    elif mode == 'accept':
        need(a.get('new_source_authoritative') is True and a.get('required_checks_accepted') is True, 'acceptance-not-approved')
        C.record_json(STATE / 'stable-verification.json')
        C.record_json(STATE / 'cutover-healthy.json')
        evidence = C.decode_json(reference(a, 'acceptance_evidence'))
        need(evidence.get('gate_d_approval_sha256') == original['sha256'] and
             evidence.get('current_ids') == ids and evidence.get('smoke_status') == 'PASS' and
             all(evidence.get(k) is True for k in ('startup_migrations_unchanged','prod_metadata_unchanged',
                                                  'new_data_verified','validation_writes_reviewed')),
             'acceptance-evidence-incomplete')
        need(C.record_json(STATE / 'current-ids.json') == ids, 'acceptance-identities-changed')
        pair(ids, 'new', healthy=True)
        preflight = Path('/usr/local/sbin/carservice-test-preflight')
        need(C.sha(C.read_file(preflight)) == '0cfee399665a0c8fcdf4f4f73909ea4f72fd0d7c25a081233ddcb5ed31b53f14'
             and C.sha(C.read_file(Path('/usr/local/sbin/carservice-test-deploy'))) ==
             'b38b9eef01afcf2af92232d178fda6a73f6fbf74d946e228aeb14c066e1a26f9', 'installed-preflight-hash')
        result = subprocess.run(['/usr/bin/python3','-I','-B',str(preflight)], env=C.ENV,
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
        need(result.returncode == 0, 'installed-preflight-refused')
        log(directory, 'preflight-pass', {'stdout_sha256':C.sha(result.stdout)})
        root_checks(); pair(ids, 'new', healthy=True)
        C.check_window(a)
        log(STATE, 'accepted-authority', {'ids':ids, 'time':C.now().isoformat(), 'approval_sha256':digest,
                                       'ingress':'CLOSED; reopening is a separate operator action'})
        print('PASS NEW authority accepted. Reopen TEST only under reviewed ingress approval. Deployment remains disabled.')


def main():
    global C
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('operation', choices=['cutover','old-path-recover','forward-capture','resume-new','accept'])
    p.add_argument('--approval', type=Path, required=True)
    p.add_argument('--approval-sha256', required=True)
    args = p.parse_args()
    os.umask(0o077)
    try:
        C = load_c(); root_checks()
        a = authorize(args.approval, args.approval_sha256, args.operation)
        with C.operation_lock():
            execute(a, args.approval_sha256)
        return 0
    except Exception as error:
        code = str(error) if isinstance(error, RuntimeError) and re.fullmatch('[a-z0-9-]+', str(error)) else type(error).__name__
        print('STOP Gate D: ' + code, file=sys.stderr)
        print('No automatic retry, cleanup, rollback, ingress reopening or activation.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
