"""Offline layout dry-run using fictional interpolation; no Docker or host inspection."""
import argparse
import json
from pathlib import Path, PurePosixPath
import re
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_deploy as d


def validate_plan():
    expected = {'BASE': '/srv/carserviceapp-test', 'DATA': '/srv/carserviceapp-test/data',
                'UPLOADS': '/srv/carserviceapp-test/uploads', 'BACKUPS': '/srv/carserviceapp-test/backups',
                'ENV_FILE': '/etc/carservice-test-deploy/environment',
                'LIVE_COMPOSE': '/etc/carservice-test-deploy/baseline/compose.json'}
    for name, value in expected.items():
        d.require(getattr(d, name).as_posix() == value, 'unexpected planned path')
    source = (Path(__file__).resolve().parents[1] / 'ops/test-deploy/docker-compose.test.yml').read_text()
    values = {'APP_IMAGE_TAG': 'plan', 'JWT_KEY': 'FICTIONAL-NOT-FOR-USE',
              'JWT_ISSUER': 'fictional', 'JWT_AUDIENCE': 'fictional',
              'TEST_SUBNET': '172.30.91.0/24', 'TEST_BACKEND_IP': '172.30.91.2',
              'TEST_FRONTEND_IP': '172.30.91.3'}
    model = json.loads(re.sub(r'\$\{([A-Z_]+):\?[^}]*\}', lambda m: values[m[1]], source))
    # Linux paths must compare identically during Windows offline validation.
    previous = d.DATA, d.UPLOADS
    try:
        d.DATA, d.UPLOADS = PurePosixPath(expected['DATA']), PurePosixPath(expected['UPLOADS'])
        d.validate_model(model, 'plan')
        d.validate_network(model, [{'Subnet': values['TEST_SUBNET'], 'Gateway': '172.30.91.1'}])
    finally:
        d.DATA, d.UPLOADS = previous
    return {'status': 'PASS', 'scope': 'offline-layout-only', 'storage_layout': d.STORAGE_LAYOUT,
            'paths': expected, 'migration_authorized': False,
            'pending': ['native-compose', 'source-custody', 'paired-backup-restore',
                        'maintenance-approval', 'post-cutover-preflight', 'recovery-approval']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', required=True, action='store_true')
    parser.parse_args()
    print(json.dumps(validate_plan(), indent=2))
