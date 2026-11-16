"""Read-only, fixed-path metadata diagnosis; never read environment contents."""
import json
import os
from pathlib import Path
import stat

REVIEW = Path('/root/carservice-test-install-6f2/review')


def inspect_path(path, directory=False, private=False, optional=False):
    """Walk root first so links/non-directories are never traversed."""
    rows = []
    for item in (*reversed(path.parents), path):
        leaf = item == path
        row = {'path': str(item), 'reasons': []}
        try:
            info = item.lstat()
        except FileNotFoundError:
            row['reasons'] = ['absent-allowed' if leaf and optional else 'missing-path']
            rows.append(row)
            break
        except OSError:
            row['reasons'] = ['metadata-unavailable']
            rows.append(row)
            break
        row.update(uid=info.st_uid, gid=info.st_gid,
                   mode=format(stat.S_IMODE(info.st_mode), '04o'))
        if stat.S_ISLNK(info.st_mode):
            row['reasons'].append('linked-path')
        if info.st_uid != 0:
            row['reasons'].append('owner-not-root')
        if info.st_mode & 0o020:
            row['reasons'].append('group-writable')
        if info.st_mode & 0o002:
            row['reasons'].append('other-writable')
        wanted_dir = not leaf or directory
        if not (stat.S_ISDIR(info.st_mode) if wanted_dir else stat.S_ISREG(info.st_mode)):
            row['reasons'].append('wrong-path-type')
        if leaf and private and info.st_mode & 0o077:
            row['reasons'].append('not-private')
        rows.append(row)
        if stat.S_ISLNK(info.st_mode) or (not leaf and not stat.S_ISDIR(info.st_mode)):
            break
    return rows


def main():
    if os.geteuid() != 0:
        print(json.dumps({'status': 'STOP', 'stage': 'path-trust', 'code': 'root-required'}))
        return 1
    if os.path.lexists('/etc/carservice-test-deploy'):
        print(json.dumps({'status': 'STOP', 'stage': 'path-trust', 'code': 'runtime-or-gate-present'}))
        return 1
    checks = [
        ('prepare-env', REVIEW / 'ops/test-deploy/docker-compose.test.yml', {}),
        ('prepare-env', Path('/opt/carserviceapp/.env.test'), {'private': True}),
        ('prepare-env', REVIEW, {'directory': True}),
        ('prepare-env', REVIEW / 'env.compat-test', {'private': True, 'optional': True}),
        ('check', Path('/root/carservice-test-install-6f2/home'), {'directory': True}),
    ]
    failed = False
    for stage, path, options in checks:
        rows = inspect_path(path, **options)
        failed |= any(set(row['reasons']) - {'absent-allowed'} for row in rows)
        print(json.dumps({'stage': 'path-trust', 'used_by': stage,
                          'checked_path': str(path), 'metadata': rows}))
    print(json.dumps({'status': 'STOP' if failed else 'PASS', 'stage': 'path-trust'}))
    return int(failed)


if __name__ == '__main__':
    raise SystemExit(main())
