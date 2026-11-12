#!/usr/bin/python3 -I
"""Rehearsal-only Compose JSON compatibility; explicit overrides stay rejectable."""
import json
import os
import subprocess
import sys

REAL_COMPOSE = '/usr/libexec/docker/cli-plugins/docker-compose-real'


def normalize(model):
    for service in model.get('services', {}).values():
        for key in ('command', 'entrypoint'):
            if key in service and service[key] is None:
                del service[key]
        # Compose's JSON serializer omits false; the guard requires explicit false.
        for mount in service.get('volumes', []):
            if mount.get('type') == 'bind' and isinstance(mount.get('bind'), dict):
                mount['bind'].setdefault('create_host_path', False)
    return model


def main(args):
    if 'config' in args and any(args[i:i+2] == ['--format', 'json'] for i in range(len(args))):
        result = subprocess.run([REAL_COMPOSE, *args], stdout=subprocess.PIPE)
        if result.returncode:
            return result.returncode
        print(json.dumps(normalize(json.loads(result.stdout))))
        return 0
    os.execv(REAL_COMPOSE, [REAL_COMPOSE, *args])


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
