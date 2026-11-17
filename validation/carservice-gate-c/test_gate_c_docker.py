#!/usr/bin/python3
"""Opt-in real Docker metadata/recovery test on an EMPTY dedicated daemon only.
Never uses the default socket/context, existing app images, or existing data.
Requires a preloaded Python fixture image by immutable SHA; never pulls an image.
Source/custody checks in recover are mocked: this tests real Docker lifecycle only.
"""
import argparse
import datetime as dt
import hashlib
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile
import time
import uuid
from unittest.mock import Mock

HERE = Path(__file__).resolve().parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--disposable-socket', type=Path, required=True)
    p.add_argument('--fixture-image', required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--i-confirm-disposable-daemon', action='store_true', required=True)
    a = p.parse_args()
    sock = a.disposable_socket
    if not (sock.is_absolute() and sock.name == 'docker.sock' and sock == sock.resolve()
            and str(sock.parent).startswith('/tmp/carservice-gate-c-docker-')
            and sock.parent.stat().st_uid == os.getuid()
            and stat.S_IMODE(sock.parent.stat().st_mode) == 0o700
            and stat.S_ISSOCK(sock.lstat().st_mode)
            and sock.lstat().st_uid == os.getuid()
            and re.fullmatch('sha256:[0-9a-f]{64}', a.fixture_image)
            and not os.path.lexists(a.output)):
        raise SystemExit('STOP: invalid disposable socket, image or output')
    docker = ['/usr/bin/docker', '--host', 'unix://' + str(sock)]
    env = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': str(sock.parent), 'LC_ALL': 'C'}

    def run(*args, timeout=90):
        r = subprocess.run(docker + list(args), env=env, stdin=subprocess.DEVNULL,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        if r.returncode:
            raise RuntimeError('fixture-docker-command-failed')
        return r.stdout.decode().strip()

    # These are read-only checks against the explicitly selected test daemon.
    # No write is allowed until it proves isolated and empty.
    info = json.loads(run('info', '--format', '{{json .}}'))
    if ('carservice.gate-c.fixture=true' not in (info.get('Labels') or [])
            or Path(info['DockerRootDir']).resolve() != sock.parent / 'data'
            or run('ps', '-aq')
            or set(run('network', 'ls', '--format', '{{.Name}}').splitlines()) - {'bridge', 'host', 'none'}):
        raise SystemExit('STOP: daemon is not labelled, isolated and empty')
    if run('image', 'inspect', '--format', '{{.Id}}', a.fixture_image) != a.fixture_image:
        raise SystemExit('STOP: fixture image not already loaded by exact ID')
    m = load(HERE / 'gate-c.py', 'gate_c_disposable_subject')
    adapter = load(HERE.parent / 'gate-cd' / 'internal_fixture.py', 'internal_fixture')
    adapter.bind_internal_inspect(m)
    unit = load(HERE / 'test_gate_c.py', 'gate_c_disposable_support')
    tag = 'gate-c-disposable-' + uuid.uuid4().hex[:12]
    temp = Path(tempfile.mkdtemp(prefix='gate-c-fictional-'))
    ids, network_created = {}, False
    report = {'status': 'FAIL', 'script_sha256': hashlib.sha256((HERE / 'gate-c.py').read_bytes()).hexdigest(),
              'docker_engine_version': info['ServerVersion'], 'fixture_image': a.fixture_image,
              'checks': [], 'observations': {},
              'scope': 'real isolated Docker lifecycle; recovery source/custody validation mocked'}
    try:
        m.PROJECT = tag
        m.NETWORK = tag
        m.SUBNET, m.GATEWAY = '172.29.198.0/24', '172.29.198.1'
        m.ADDRESSES = {'backend': '172.29.198.2', 'frontend': '172.29.198.3'}
        m.NETID = run('network', 'create', '--internal', '--label', tag + '=true',
                      '--subnet', m.SUBNET, '--gateway', m.GATEWAY, m.NETWORK)
        network_created = True
        m.DATA, m.UPLOADS = temp / 'data', temp / 'uploads'
        m.DATA.mkdir();m.UPLOADS.mkdir()
        health = "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080').close()\""
        for service in ('backend', 'frontend'):
            args = ['run', '--detach', '--pull', 'never', '--name', tag + '-' + service,
                    '--label', tag + '=true', '--label', 'com.docker.compose.project=' + tag,
                    '--label', 'com.docker.compose.service=' + service,
                    '--network', m.NETWORK, '--ip', m.ADDRESSES[service],
                    '--health-cmd', health, '--health-interval', '1s', '--health-timeout', '2s',
                    '--health-retries', '30']
            if service == 'backend':
                args += ['--mount', 'type=bind,source=' + str(m.DATA) + ',target=/app/data',
                         '--mount', 'type=bind,source=' + str(m.UPLOADS) + ',target=/app/uploads']
            else:
                args += ['--publish', '127.0.0.1::8080']
            args += [a.fixture_image, 'python', '-m', 'http.server', '8080']
            cid = run(*args)
            if not re.fullmatch('[0-9a-f]{64}', cid):
                raise RuntimeError('unexpected-fixture-id')
            ids[service] = cid
        m.IDENTITIES = {s: (cid, a.fixture_image) for s, cid in ids.items()}
        port = json.loads(run('inspect', '--format', '{{json .HostConfig.PortBindings}}', ids['frontend']))
        # HostConfig can retain requested port 0/empty on some versions. Use the
        # actual requested binding value for the fixture admission expectation.
        m.FRONTEND_PORT = port['8080/tcp'][0]['HostPort']
        m.DOCKER = docker
        m.ENV = env
        deadline = time.monotonic() + 60
        while True:
            states = m.check_pair()
            if all(s['health'] == 'healthy' for s in states.values()):
                break
            if time.monotonic() >= deadline:
                raise RuntimeError('fixture-health-timeout')
            time.sleep(1)
        m.check_pair(healthy=True)
        report['checks'].append('running')
        report['observations']['running'] = states
        # Only non-Docker preconditions are mocked. Actual inspect, check_pair,
        # check_network, stop_exact and recover start/health paths are exercised.
        m.common = Mock()
        m.trusted = Mock()
        m.confirm = Mock()
        m.storage_module = Mock(return_value=object())
        m.verified_reference = Mock(return_value=json.dumps(unit.SNAP['history']).encode())
        m.capture_source = Mock(side_effect=lambda storage: json.loads(json.dumps(unit.SNAP)))
        m.record_json = lambda path: m.decode_json(path.read_bytes())
        for case, services, mode in [('frontend', ('frontend',), 'frontend-only'),
                                     ('both', ('frontend', 'backend'), 'existing-capture')]:
            m.RECORD = temp / ('journal-' + case)
            m.RECORD.mkdir(mode=0o700)
            record = {'approval_sha256': 'a' * 64, 'approval': {},
                      'container_metadata': m.check_pair(healthy=True)}
            for service in services:
                m.stop_exact(service, unit.window(), m.event)
            state = m.check_pair(stopped=True) if case == 'both' else m.check_pair()
            report['observations'][case + '-stopped'] = state
            report['checks'].append(case + '-stopped')
            if case == 'both':
                m.write_new(m.RECORD / 'source-capture.json', unit.SNAP)
            authorization = unit.recovery_doc(mode)
            authorization['recovery_id'] = 'disposable-recovery-' + case
            m.recover(authorization, 'b' * 64, record)
            m.check_pair(healthy=True)
            report['checks'].append('recover-' + case)
        # Exercise negative identity/network checks against REAL exited metadata,
        # rather than only against the recovered running fixtures.
        for service in ('frontend', 'backend'):
            m.command(['stop', '--time', '60', ids[service]], timeout=90)
        report['observations']['negative-tests-both-stopped'] = m.check_pair(stopped=True)
        saved = m.NETID
        m.NETID = '0' * 64
        try:
            m.check_network()
            raise AssertionError('wrong network accepted')
        except RuntimeError:
            report['checks'].append('reject-wrong-network')
        finally:
            m.NETID = saved
        old = m.IDENTITIES['backend']
        m.IDENTITIES['backend'] = (old[0], 'sha256:' + '0' * 64)
        try:
            m.inspect('backend')
            raise AssertionError('wrong image accepted')
        except RuntimeError:
            report['checks'].append('reject-wrong-image')
        finally:
            m.IDENTITIES['backend'] = old
        m.IDENTITIES['backend'] = (ids['frontend'], a.fixture_image)
        try:
            m.inspect('backend')
            raise AssertionError('wrong container identity accepted')
        except RuntimeError:
            report['checks'].append('reject-wrong-id')
        finally:
            m.IDENTITIES['backend'] = old
        report['status'] = 'PASS'
    except Exception as error:
        report['failure_class'] = type(error).__name__
        # Only fixed candidate refusal codes, never arbitrary exception content.
        if isinstance(error, RuntimeError) and re.fullmatch('[a-z0-9-]+', str(error)):
            report['failure_code'] = str(error)
    finally:
        try:
            for cid in ids.values():
                if run('inspect', '--format', '{{index .Config.Labels "' + tag + '"}}', cid) != 'true':
                    raise RuntimeError('cleanup-label-mismatch')
                run('rm', '--force', cid)
            if network_created:
                if run('network', 'inspect', '--format', '{{index .Labels "' + tag + '"}}', m.NETWORK) != 'true':
                    raise RuntimeError('cleanup-network-label-mismatch')
                run('network', 'rm', m.NETWORK)
        except Exception as error:
            report['status'] = 'FAIL'
            report['cleanup_failure_class'] = type(error).__name__
        # These are freshly created fictional files only.
        shutil.rmtree(temp)
    with a.output.open('x', encoding='utf-8') as f:
        json.dump(report, f, sort_keys=True, indent=2)
        f.write('\n')
    print(report['status'] + ': disposable Docker metadata and recovery lifecycle tests')
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
