"""Verify the pinned review snapshot and emit default-deny Actions evidence."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath
import tarfile

SHA256 = '7928a63a75a943f15acd8d1a4962ef0a3f711632acf9f8009cbf16e16b692d88'
SCENARIOS = ('success', 'before-cutover', 'interrupted-cutover', 'failed-startup')


def verify(archive, destination):
    if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
        raise ValueError('package digest mismatch')
    if destination.exists():
        raise ValueError('fresh extraction directory required')
    files = {}
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            path = PurePosixPath(member.name)
            if (not member.isfile() or path.is_absolute() or '..' in path.parts
                    or str(path) != member.name or '\\' in member.name
                    or member.name in files or member.size > 2_000_000):
                raise ValueError('unsafe archive member')
            files[member.name] = tar.extractfile(member).read()
    checks = {}
    for line in files['SHA256SUMS'].decode('ascii').splitlines():
        digest, name = line.split('  ', 1)
        if name in checks: raise ValueError('duplicate manifest entry')
        checks[name] = digest
    if set(checks) != set(files) - {'SHA256SUMS'}:
        raise ValueError('manifest inventory mismatch')
    for name, digest in checks.items():
        if hashlib.sha256(files[name]).hexdigest() != digest:
            raise ValueError('internal digest mismatch')
    for manifest in ('INSTALL_ARTIFACTS.sha256', 'CUTOVER_DIAGNOSTIC.sha256'):
        for line in files['review/ops/test-deploy/' + manifest].decode().splitlines():
            digest, name = line.split('  ', 1)
            if hashlib.sha256(files['review/' + name]).hexdigest() != digest:
                raise ValueError('artifact digest mismatch')
    # Only verified regular bytes are written; no tar permissions/links are applied.
    destination.mkdir(parents=True)
    for name, data in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream: stream.write(data)
    return {'status': 'PASS', 'stage': 'package-integrity', 'sha256': SHA256}


def read_json(path):
    try:
        if path.stat().st_size > 65536: return {}
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def evidence(scenario, outcome, log, report, journal):
    native = False
    version = None
    rejected = set()
    try:
        if log.stat().st_size <= 1_000_000:
            for line in log.read_text(errors='replace').splitlines():
                try: row = json.loads(line)
                except ValueError: continue
                if not isinstance(row, dict): continue
                if row.get('stage') == 'native-compose':
                    native = row.get('status') == 'PASS'
                    candidate = row.get('version')
                    if isinstance(candidate, str) and re.fullmatch(r'v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]{1,40})?', candidate):
                        version = candidate
                    keys = row.get('unexpected_service_keys', {})
                    if isinstance(keys, dict):
                        for values in keys.values():
                            if isinstance(values, list):
                                rejected.update(v for v in values if isinstance(v, str) and v in {'command','entrypoint','develop','attach'})
    except OSError: pass
    result, recovery = read_json(report), read_json(journal)
    checks = {key: result.get(key) is True for key in
              ('native_compose','same_images','paired_data_verified','fictional_prod_unchanged')}
    requires_recovery = scenario in ('interrupted-cutover','failed-startup')
    recovered = recovery.get('stage') == 'recovered'
    passed = (outcome == 'success' and native and result.get('status') == 'PASS'
              and result.get('scenario') == scenario and result.get('real_vps_tested') is False
              and all(checks.values()) and (recovered or not requires_recovery))
    return {'status': 'PASS' if passed else 'FAIL', 'scenario': scenario,
            'package_sha256': SHA256, 'native_validation_passed': native,
            'native_compose_version': version,
            'known_rejected_keys': sorted(rejected), **checks,
            'recovery': 'verified' if requires_recovery and recovered else ('missing' if requires_recovery else 'not-required'),
            'real_vps_tested': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='mode', required=True)
    check = sub.add_parser('verify')
    check.add_argument('--archive', type=Path, required=True)
    check.add_argument('--destination', type=Path, required=True)
    report = sub.add_parser('report')
    report.add_argument('--scenario', choices=SCENARIOS, required=True)
    report.add_argument('--outcome', choices=('success','failure','cancelled','skipped'), required=True)
    for name in ('log','report','journal','output'):
        report.add_argument('--'+name, type=Path, required=True)
    args = parser.parse_args()
    if args.mode == 'verify':
        print(json.dumps(verify(args.archive, args.destination)))
    else:
        result = evidence(args.scenario,args.outcome,args.log,args.report,args.journal)
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result,sort_keys=True,indent=2)+'\n')
        print(json.dumps(result,sort_keys=True))
        raise SystemExit(0 if result['status']=='PASS' else 1)
