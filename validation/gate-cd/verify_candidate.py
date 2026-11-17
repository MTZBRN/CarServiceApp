"""Verify the delivered inventory before importing any candidate code."""
import hashlib
from pathlib import Path
import re

CANDIDATE = Path(__file__).resolve().parents[1] / 'carservice-gate-d'
MANIFEST_SHA256 = 'a4516d46f00cf53fe75367d42279b95241a0a5ffcc9fc886bfdc8a84f1c8afcd'


def verify():
    raw = (CANDIDATE / 'FILE-FINGERPRINTS.txt').read_bytes()
    if hashlib.sha256(raw).hexdigest() != MANIFEST_SHA256:
        raise RuntimeError('candidate manifest fingerprint mismatch')
    expected = {'FILE-FINGERPRINTS.txt'}
    lines = raw.decode('ascii').splitlines()
    if lines[0] != 'SHA256  BYTES  FILE' or len(lines) != 12:
        raise RuntimeError('candidate inventory shape mismatch')
    for line in lines[1:]:
        match = re.fullmatch(r'([0-9a-f]{64})  ([0-9]+)  ([A-Za-z0-9_.-]+)', line)
        if not match:
            raise RuntimeError('invalid fingerprint entry')
        digest, size, name = match.groups()
        if name in expected:
            raise RuntimeError('duplicate fingerprint entry')
        expected.add(name)
        path = CANDIDATE / name
        if path.is_symlink() or not path.is_file():
            raise RuntimeError('missing or linked candidate file: ' + name)
        content = path.read_bytes()
        if len(content) != int(size) or hashlib.sha256(content).hexdigest() != digest:
            raise RuntimeError('candidate fingerprint mismatch: ' + name)
    actual = {p.name for p in CANDIDATE.iterdir()}
    if actual != expected:
        raise RuntimeError('unexpected candidate inventory')
    return CANDIDATE


if __name__ == '__main__':
    verify()
    print('Verified all 11 candidate files, sizes and pinned manifest SHA-256.')
