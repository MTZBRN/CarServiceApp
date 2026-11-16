"""Staged TEST Compose preparation and native read-only diagnosis. No deployment."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_deploy as d


class Stop(Exception):
    pass


def require(value, code):
    if not value:
        raise Stop(code)


def candidate(raw, subnet, backend, frontend):
    raw = json.loads(json.dumps(raw))
    require(set(raw) == {'name', 'services', 'networks'}, 'template-shape')
    require(set(raw['services']) == set(d.SERVICES), 'template-services')
    net = ipaddress.ip_network(subnet)
    addresses = [ipaddress.ip_address(v) for v in (backend, frontend)]
    require(net.version == 4 and len(set(addresses)) == 2 and all(
        a in net and a not in (net.network_address, net.broadcast_address) for a in addresses), 'network-input')
    fields = [(raw['networks']['workshop']['ipam']['config'][0], 'subnet', 'TEST_SUBNET', subnet),
              (raw['services']['backend']['networks']['workshop'], 'ipv4_address', 'TEST_BACKEND_IP', backend),
              (raw['services']['frontend']['networks']['workshop'], 'ipv4_address', 'TEST_FRONTEND_IP', frontend),
              (raw['services']['backend']['environment'], 'ReverseProxy__KnownProxies__0', 'TEST_FRONTEND_IP', frontend)]
    for node, key, variable, value in fields:
        require(node[key] == value or re.fullmatch(r'\$\{' + variable + r':\?[^}]+\}', node[key]), 'template-network-field')
        node[key] = value
    return raw


def trusted(path, directory=False):
    require(path.is_absolute(), 'absolute-path-required')
    for p in (path, *path.parents):
        require(not p.is_symlink(), 'linked-path')
        s = p.stat()
        require(s.st_uid == 0 and not s.st_mode & 0o022, 'untrusted-path')
    require(path.is_dir() if directory else path.is_file(), 'wrong-path-type')


def prepare_env(source, target):
    original = source.read_bytes()
    text = original.decode('utf-8')
    keys = set(re.findall(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', text, re.M))
    require({'JWT_KEY', 'JWT_ISSUER', 'JWT_AUDIENCE'} <= keys, 'missing-jwt-keys')
    require(not keys.intersection({'TEST_SUBNET','TEST_BACKEND_IP','TEST_FRONTEND_IP'}), 'network-keys-already-present')
    content = original + b'\nTEST_SUBNET=172.30.91.0/24\nTEST_BACKEND_IP=172.30.91.2\nTEST_FRONTEND_IP=172.30.91.3\n'
    if os.path.lexists(target):
        require(not target.is_symlink() and target.is_file(), 'unsafe-existing-candidate')
        require(target.read_bytes() == content, 'candidate-content-mismatch')
    else:
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as f:
            f.write(content)
    require(source.read_bytes() == original, 'live-env-changed')


def check(compose, envfile, project, runner):
    for p in (compose, envfile):
        require(p.is_file(), 'missing-input-file')
    require(project.is_dir(), 'missing-project-directory')
    raw = json.loads(compose.read_text())
    require(set(raw) == {'name', 'services', 'networks'}, 'template-shape')
    require(set(raw['services']) == set(d.SERVICES), 'template-services')
    # Only the reviewed template structure may reach Compose; reject directives
    # before Compose can read external inputs. Actual resolved values remain private.
    reviewed = json.loads((Path(__file__).resolve().parents[1]/'ops/test-deploy/docker-compose.test.yml').read_text())
    for name in d.SERVICES:
        require(set(raw['services'][name]) == set(reviewed['services'][name]), 'template-service-keys')
    require(raw == reviewed or raw == candidate(reviewed,
        raw['networks']['workshop']['ipam']['config'][0]['subnet'],
        raw['services']['backend']['networks']['workshop']['ipv4_address'],
        raw['services']['frontend']['networks']['workshop']['ipv4_address']), 'unreviewed-template')
    text = envfile.read_text()
    keys = set(re.findall(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', text, re.M))
    require({'JWT_KEY', 'JWT_ISSUER', 'JWT_AUDIENCE'} <= keys, 'missing-jwt-keys')
    if raw == reviewed:
        require({'TEST_SUBNET','TEST_BACKEND_IP','TEST_FRONTEND_IP'} <= keys, 'missing-network-keys')
    require('--wait' in runner('docker','compose','up','--help'), 'compose-wait-unsupported')
    model = json.loads(runner('docker','compose','--project-name',d.PROJECT,
        '--project-directory',str(project),'--env-file',str(envfile),'-f',str(compose),'config','--format','json'))
    try:
        d.validate_model(model, 'preflight')
    except (d.Refused, KeyError, TypeError):
        raise Stop('strict-model-refused') from None
    ipam = json.loads(runner('docker','network','inspect','-f','{{json .IPAM.Config}}',d.NETWORK))
    try:
        d.validate_network(model, ipam)
    except (d.Refused, KeyError, TypeError, ValueError):
        raise Stop('strict-network-refused') from None


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='mode', required=True)
    sub.add_parser('prepare-env')
    prep = sub.add_parser('prepare')
    prep.add_argument('--output', type=Path, required=True)
    for key in ('subnet','backend','frontend'):
        prep.add_argument('--'+key, required=True)
    test = sub.add_parser('check')
    test.add_argument('--compose', type=Path, required=True)
    test.add_argument('--env-file', type=Path, required=True)
    test.add_argument('--project-directory', type=Path, required=True)
    a = p.parse_args(argv)
    stage = a.mode
    try:
        require(os.geteuid() == 0, 'root-required')
        require(not any(os.environ.get(k) for k in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')), 'daemon-override')
        require(not os.path.lexists('/etc/carservice-test-deploy/actions-enabled'), 'server-gate-present')
        source=Path(__file__).resolve().parents[1]/'ops/test-deploy/docker-compose.test.yml'
        trusted(source)
        if a.mode == 'prepare-env':
            live = d.ENV_FILE
            target = Path('/root/carservice-test-install-6f2/review/env.compat-test')
            trusted(live)
            require(not live.stat().st_mode & 0o077, 'env-not-private')
            trusted(target.parent, directory=True)
            if os.path.lexists(target):
                trusted(target)
                require(not target.stat().st_mode & 0o077, 'candidate-not-private')
            prepare_env(live, target)
        elif a.mode == 'prepare':
            trusted(a.output.parent, directory=True)
            require(a.output.parent == Path('/root/carservice-test-install-6f2/review'), 'output-outside-staging')
            model=candidate(json.loads(source.read_text()), a.subnet, a.backend, a.frontend)
            with a.output.open('x', encoding='utf-8') as f:
                os.chmod(a.output, 0o600)
                f.write(json.dumps(model, indent=2)+'\n')
        else:
            for path in (a.compose, a.env_file):
                require(path.is_file(), 'missing-input-file'); trusted(path)
            trusted(a.project_directory, directory=True)
            require(not a.env_file.stat().st_mode & 0o077, 'env-not-private')
            clean={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','HOME':str(a.project_directory),
                   'LC_ALL':'C','GIT_TERMINAL_PROMPT':'0','APP_IMAGE_TAG':'preflight'}
            def run(*args):
                nonlocal stage
                stage = 'compose-config' if 'config' in args else ('network-inspect' if 'network' in args else 'compose-help')
                return subprocess.run(args, env=clean, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE, check=True, timeout=120).stdout.decode()
            check(a.compose, a.env_file, a.project_directory, run)
        print(json.dumps({'status':'PASS', 'stage':a.mode}))
        return 0
    except Exception as error:
        code = str(error) if isinstance(error, Stop) else {
            FileNotFoundError:'missing-path-or-command', FileExistsError:'destination-exists',
            PermissionError:'permissions', subprocess.CalledProcessError:'command-failed',
            subprocess.TimeoutExpired:'command-timeout', json.JSONDecodeError:'invalid-json',
            ValueError:'invalid-input'}.get(type(error), 'unexpected-error')
        print(json.dumps({'status':'STOP','stage':stage,'code':code}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
