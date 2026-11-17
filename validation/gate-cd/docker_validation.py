"""Selected candidate functions on fictional GitHub-hosted resources.

Not a Gate C/D CLI execution or standalone Gate C acceptance suite. Candidate
functions are never replaced: only fixture resource/path/identity constants change.
"""
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


HERE = Path(__file__).resolve().parent
CANDIDATE = load(HERE / 'verify_candidate.py', 'candidate_verifier').verify()
RUN = os.environ.get('FIXTURE_ID', '')
if (os.environ.get('GITHUB_ACTIONS') != 'true' or not re.fullmatch(r'[0-9]+-[0-9]+', RUN)
        or os.geteuid() != 0):
    raise SystemExit('requires explicit GitHub-hosted fictional root fixture context')
PROJECT = 'gate-cd-fixture-' + RUN
NETWORK = PROJECT + '-workshop'
LABEL = 'gate-cd.fixture=' + RUN
ROOT = Path('/var/lib') / PROJECT
DOCKER = ['/usr/bin/docker', '--host', 'unix:///var/run/docker.sock']
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root', 'LC_ALL': 'C'}


def docker(*args):
    result = subprocess.run(DOCKER + list(args), env=ENV, stdin=subprocess.DEVNULL,
                            capture_output=True, text=True, timeout=240)
    if result.returncode:
        raise RuntimeError('fictional Docker fixture command failed: ' + args[0])
    return result.stdout.strip()


def cleanup():
    # No prune, Compose down, or removal of unlabelled/shared resources.
    for cid in docker('ps', '-aq', '--no-trunc', '--filter', 'label=' + LABEL).split():
        labels = json.loads(docker('inspect', '--format', '{{json .Config.Labels}}', cid))
        if labels.get('gate-cd.fixture') != RUN or labels.get('com.docker.compose.project') != PROJECT:
            raise RuntimeError('cleanup container identity mismatch')
        docker('rm', '-f', cid)
    for nid in docker('network', 'ls', '-q', '--no-trunc', '--filter', 'label=' + LABEL).split():
        labels = json.loads(docker('network', 'inspect', '--format', '{{json .Labels}}', nid))
        if labels.get('gate-cd.fixture') != RUN:
            raise RuntimeError('cleanup network identity mismatch')
        docker('network', 'rm', nid)


def refused(operation):
    try:
        operation()
    except RuntimeError:
        return
    raise AssertionError('candidate accepted invalid fictional fixture')


def main():
    os.umask(0o077)
    d = load(CANDIDATE / 'gate-d.py', 'candidate_d')
    d.C = c = d.load_c()  # Candidate enforces its own Gate C dependency hash.
    storage = load(CANDIDATE / 'ops_storage.fixture.py', 'candidate_storage')
    image = docker('image', 'inspect', '--format', '{{.Id}}', 'python:3.12-slim-bookworm')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', image):
        raise RuntimeError('fixture image must resolve to a local immutable ID')
    ROOT.mkdir(mode=0o700)  # Existing/partial runs are never overwritten.
    c.PROJECT, c.NETWORK = PROJECT, NETWORK
    c.PARENT = ROOT / 'legacy'
    c.PARENT.mkdir(mode=0o700)
    c.DATA, c.UPLOADS = c.PARENT / 'data', c.PARENT / 'uploads'
    c.DB = c.DATA / 'app.db'
    c.TARGET = d.TARGET = ROOT / 'target'
    c.BACKUPS = c.TARGET / 'backups'
    c.SCRATCH_PARENT = ROOT / 'scratch'
    c.SCRATCH = c.SCRATCH_PARENT / 'carserviceapp-restore-test-fictional'
    c.RECORD = ROOT / 'state' / 'gate-c'
    d.STATE = ROOT / 'state' / 'gate-d'
    d.OLD_DATA, d.OLD_UPLOADS = c.DATA, c.UPLOADS
    for path in (c.DATA, c.UPLOADS, c.TARGET, c.SCRATCH_PARENT,
                 c.RECORD.parent, c.RECORD.parent / 'home', c.RECORD, d.STATE):
        path.mkdir(mode=0o700)
    # Addresses retain candidate values; network is newly created and internal.
    c.NETID = docker('network', 'create', '--internal', '--label', LABEL,
                     '--subnet', c.SUBNET, '--gateway', c.GATEWAY, NETWORK)
    c.IDENTITIES = {s: ('0' * 64, image) for s in ('backend', 'frontend')}
    with sqlite3.connect(c.DB) as db:
        db.execute('CREATE TABLE __EFMigrationsHistory (MigrationId TEXT PRIMARY KEY, ProductVersion TEXT)')
        db.execute("INSERT INTO __EFMigrationsHistory VALUES ('fictional_001','8.0.0')")
        db.execute('CREATE TABLE Users (Id INTEGER PRIMARY KEY)')
        db.execute('INSERT INTO Users VALUES (1)')
    (c.UPLOADS / 'fictional.txt').write_bytes(b'fictional payload')
    for leaf in (c.DATA, c.UPLOADS):
        os.chown(leaf, *d.OWNER)
        for child in leaf.iterdir():
            child.chmod(0o600)
            os.chown(child, *d.OWNER)
    # Runs inside the backend as UID 1654, against only fixture binds.
    backend = (
        "import os,sqlite3,time; "
        "assert os.getuid()==1654; "
        "db=sqlite3.connect('file:/app/data/app.db?mode=ro',uri=True); "
        "assert db.execute('SELECT Id FROM Users').fetchall()==[(1,)]; db.close(); "
        "assert open('/app/uploads/fictional.txt','rb').read()==b'fictional payload'; "
        "open('/tmp/ready','w').close(); time.sleep(3600)"
    )
    old = {'name': PROJECT,
           'networks': {'workshop': {'name': NETWORK, 'external': True}},
           'services': {}}
    for service in ('backend', 'frontend'):
        spec = {'image': image, 'user': '1654:1654',
                'labels': {'gate-cd.fixture': RUN},
                'networks': {'workshop': {'ipv4_address': c.ADDRESSES[service]}},
                'command': ['python3', '-c', backend if service == 'backend' else
                            "import time; open('/tmp/ready','w').close(); time.sleep(3600)"],
                'healthcheck': {'test': ['CMD', 'python3', '-c',
                                        "from pathlib import Path; assert Path('/tmp/ready').is_file()"],
                                'interval': '1s', 'timeout': '2s', 'retries': 10}}
        if service == 'backend':
            spec['volumes'] = [{'type': 'bind', 'source': str(source), 'target': target,
                                'bind': {'create_host_path': False}}
                               for source, target in ((c.DATA, '/app/data'), (c.UPLOADS, '/app/uploads'))]
        else:
            spec['ports'] = [{'target': 8080, 'published': '5174',
                              'host_ip': '127.0.0.1', 'protocol': 'tcp'}]
        old['services'][service] = spec
    new = copy.deepcopy(old)
    for volume in new['services']['backend']['volumes']:
        volume['source'] = str(d.TARGET / ('data' if volume['target'] == '/app/data' else 'uploads'))
    a = {'window_start_utc': (dt.datetime.now(dt.UTC) - dt.timedelta(minutes=1)).isoformat(),
         'window_end_utc': (dt.datetime.now(dt.UTC) + dt.timedelta(minutes=10)).isoformat()}
    for key, value in (('old_model', json.dumps(old).encode()),
                       ('new_model', json.dumps(new).encode()), ('runtime_environment', b'')):
        path = ROOT / (key + '.json')
        path.write_bytes(value)
        a[key], a[key + '_sha256'] = str(path), hashlib.sha256(value).hexdigest()
    checks = []

    def passed(name):
        checks.append(name)
        print('PASS selected fixture check: ' + name, flush=True)

    d.native_models(a)  # Real Compose config + unchanged candidate validation.
    passed('native-compose-models')
    d.compose(a, 'old_model', ['up', '-d', '--no-build', '--pull', 'never', '--wait'])
    ids = {s: docker('ps', '-aq', '--no-trunc', '--filter',
                    'label=com.docker.compose.project=' + PROJECT,
                    '--filter', 'label=com.docker.compose.service=' + s)
           for s in c.IDENTITIES}
    c.IDENTITIES = {s: (ids[s], image) for s in ids}
    c.check_pair(healthy=True)
    passed('running')
    original = c.IDENTITIES
    c.IDENTITIES = {s: (cid, 'sha256:' + '0' * 64) for s, (cid, _) in original.items()}
    refused(c.check_pair)
    c.IDENTITIES = original
    passed('reject-wrong-image')
    original_net = c.NETID
    c.NETID = '0' * 64
    refused(c.check_pair)
    c.NETID = original_net
    passed('reject-wrong-network')
    c.stop_exact('frontend', a, lambda name, value: c.write_new(c.RECORD / (name + '.json'), value))
    states = c.check_pair()
    assert states['backend']['running'] and not states['frontend']['running']
    passed('frontend-stopped')
    c.command(['start', ids['frontend']])
    d.wait_pair(ids, 'old', a)
    passed('frontend-restarted-via-candidate-command')
    journal = d.STATE / 'initial-stop'
    journal.mkdir(mode=0o700)
    d.stop_pair(ids, 'old', a, journal)
    c.check_pair(stopped=True)
    passed('both-stopped')
    expected = d.data_view(c.DATA, c.UPLOADS, storage)
    pair = storage.backup(c.DB, c.UPLOADS, c.BACKUPS, quiesced=True)
    storage.restore_test(pair, c.SCRATCH, max_upload_bytes=1024)
    d.materialize(c.SCRATCH, d.TARGET, expected, storage, 'fictional-fixture')
    d.verify_data(d.TARGET / 'data', d.TARGET / 'uploads', expected, storage, standalone=True)
    passed('real-backup-restore-materialize-owner-reader-1654')
    journal = d.STATE / 'startup'
    journal.mkdir(mode=0o700)
    d.startup(a, 'new_model', ids, journal, 'new', 'old')
    passed('compose-new-layout-backend-first-with-health')
    journal = d.STATE / 'verification-stop'
    journal.mkdir(mode=0o700)
    d.stop_pair(ids, 'new', a, journal)
    d.verify_data(d.TARGET / 'data', d.TARGET / 'uploads', expected, storage)
    passed('stable-new-data-after-startup')
    journal = d.STATE / 'resume'
    journal.mkdir(mode=0o700)
    d.resume_pair(ids, 'new', a, journal)
    passed('resume-new-backend-first-with-health')
    c.write_new(d.STATE / 'accepted-authority.json', {'fictional': True})
    refused(d.old_authority_admission)
    passed('accepted-authority-blocks-old-recovery')
    print(json.dumps({'scope': 'selected candidate functions only', 'checks': checks,
                      'full_gate_c_d_validation': 'INCOMPLETE - standalone Gate C package missing',
                      'fixture_image': image,
                      'engine': docker('version', '--format', '{{.Server.Version}}'),
                      'compose': docker('compose', 'version', '--short')}, indent=2))


if __name__ == '__main__':
    if sys.argv[1:] == ['--cleanup']:
        cleanup()
    elif not sys.argv[1:]:
        try:
            main()
        finally:
            cleanup()
    else:
        raise SystemExit('unexpected arguments')
