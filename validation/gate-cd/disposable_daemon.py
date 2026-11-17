"""Own one short-lived daemon for the original C suite and D Compose checks."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('verify', HERE / 'verify_candidate.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
verifier.verify()
RUN = os.environ.get('FIXTURE_ID', '')
if os.environ.get('GITHUB_ACTIONS') != 'true' or not re.fullmatch(r'[0-9]+-[0-9]+', RUN) or os.geteuid() != 0:
    raise SystemExit('GitHub-hosted root fixture context required')
ROOT = Path('/tmp') / ('carservice-gate-c-docker-' + RUN)
SOCKET = ROOT / 'docker.sock'
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': str(ROOT), 'LC_ALL': 'C',
       'GITHUB_ACTIONS': 'true', 'FIXTURE_ID': RUN, 'FIXTURE_SOCKET': str(SOCKET)}
DOCKER = ['/usr/bin/docker', '--host', 'unix://' + str(SOCKET)]


def stop():
    pidfile = ROOT / 'dockerd.pid'
    if not pidfile.exists():
        return
    pid = int(pidfile.read_text().strip())
    proc = Path('/proc') / str(pid)
    if not proc.exists():
        return
    args = (proc / 'cmdline').read_bytes().split(b'\0')
    # Refuse to signal any runner/shared daemon, even if a PID has been reused.
    if str(SOCKET).encode() not in b' '.join(args) or str(ROOT / 'data').encode() not in args:
        raise RuntimeError('disposable daemon PID identity mismatch')
    os.kill(pid, 15)
    for _ in range(30):
        if not proc.exists() or (proc / 'stat').read_text().split()[2] == 'Z':
            return
        time.sleep(1)
    # No broad process kill: only the still-matching PID.
    args = (proc / 'cmdline').read_bytes().split(b'\0')
    if str(ROOT / 'data').encode() not in args:
        raise RuntimeError('daemon PID changed during shutdown')
    os.kill(pid, 9)


def main(archive):
    os.umask(0o077)
    ROOT.mkdir(mode=0o700)  # Never reuse previous daemon state.
    daemon = None
    try:
        with (ROOT / 'dockerd.log').open('xb') as log:
            daemon = subprocess.Popen([
                '/usr/bin/dockerd', '--host', 'unix://' + str(SOCKET),
                '--data-root', str(ROOT / 'data'), '--exec-root', str(ROOT / 'exec'),
                '--pidfile', str(ROOT / 'dockerd.pid'), '--storage-driver', 'vfs',
                '--bridge=none', '--iptables=false', '--ip6tables=false',
                '--ip-forward=false', '--ip-masq=false', '--userland-proxy=true',
                '--label', 'carservice.gate-c.fixture=true'],
                env=ENV, stdin=subprocess.DEVNULL, stdout=log, stderr=log)
        for _ in range(60):
            if daemon.poll() is not None:
                raise RuntimeError('private dockerd failed to start; inspect fictional daemon log')
            ready = subprocess.run(DOCKER + ['info'], env=ENV, capture_output=True, timeout=10)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('private daemon readiness timeout')
        subprocess.run(DOCKER + ['load', '--input', str(archive)], env=ENV, check=True, timeout=180)
        image = subprocess.check_output(DOCKER + ['image', 'inspect', '--format', '{{.Id}}',
                                                 'python:3.12-slim-bookworm'], env=ENV, text=True).strip()
        report = ROOT / 'gate-c-docker-report.json'
        completed = subprocess.run(['/usr/bin/python3', '-I', '-B',
                        str(HERE.parent / 'carservice-gate-c' / 'test_gate_c_docker.py'),
                        '--disposable-socket', str(SOCKET), '--fixture-image', image,
                        '--output', str(report), '--i-confirm-disposable-daemon'],
                       env=ENV, check=False, timeout=600)
        result = json.loads(report.read_text())
        print(json.dumps({k: result[k] for k in (
            'status', 'checks', 'scope', 'script_sha256', 'failure_class',
            'failure_code', 'cleanup_failure_class') if k in result}), flush=True)
        completed.check_returncode()
        if result.get('status') != 'PASS':
            raise RuntimeError('gate-c-report-not-pass')
        subprocess.run(['/usr/bin/python3', '-I', '-B', str(HERE / 'docker_validation.py')],
                       env=ENV, check=True, timeout=600)
    finally:
        stop()
        if daemon is not None:
            try:
                daemon.wait(timeout=10)
            except subprocess.TimeoutExpired:
                daemon.kill()
                daemon.wait(timeout=10)


if __name__ == '__main__':
    if sys.argv[1:] == ['--cleanup']:
        stop()
    elif len(sys.argv) == 2:
        main(Path(sys.argv[1]).resolve(strict=True))
    else:
        raise SystemExit('expected fixture image archive or --cleanup')
