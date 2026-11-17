"""Verify the delivered inventory before importing any candidate code."""
import hashlib
from pathlib import Path
import re

CANDIDATE = Path(__file__).resolve().parents[1] / 'carservice-gate-d'
MANIFEST_SHA256 = 'a4516d46f00cf53fe75367d42279b95241a0a5ffcc9fc886bfdc8a84f1c8afcd'


def verify_package(directory, manifest_sha256, count):
    raw = (directory / 'FILE-FINGERPRINTS.txt').read_bytes()
    if hashlib.sha256(raw).hexdigest() != manifest_sha256:
        raise RuntimeError('candidate manifest fingerprint mismatch')
    expected = {'FILE-FINGERPRINTS.txt'}
    lines = raw.decode('ascii').splitlines()
    if lines[0] != 'SHA256  BYTES  FILE' or len(lines) != count + 1:
        raise RuntimeError('candidate inventory shape mismatch')
    for line in lines[1:]:
        match = re.fullmatch(r'([0-9a-f]{64})  ([0-9]+)  ([A-Za-z0-9_.-]+)', line)
        if not match:
            raise RuntimeError('invalid fingerprint entry')
        digest, size, name = match.groups()
        if name in expected:
            raise RuntimeError('duplicate fingerprint entry')
        expected.add(name)
        path = directory / name
        if path.is_symlink() or not path.is_file():
            raise RuntimeError('missing or linked candidate file: ' + name)
        content = path.read_bytes()
        if len(content) != int(size) or hashlib.sha256(content).hexdigest() != digest:
            raise RuntimeError('candidate fingerprint mismatch: ' + name)
    actual = {p.name for p in directory.iterdir()}
    if actual != expected:
        raise RuntimeError('unexpected candidate inventory')


def verify():
    verify_package(CANDIDATE, MANIFEST_SHA256, 11)
    original = CANDIDATE.parent / 'carservice-gate-c'
    verify_package(original, '6815f456f198d9c14123ef57b32e9ced4d48e57ece7b0513376196cff2e452ea', 8)
    if (original / 'gate-c.py').read_bytes() != (CANDIDATE / 'gate-c.py').read_bytes():
        raise RuntimeError('original Gate C differs from Gate D dependency')
    return CANDIDATE


if __name__ == '__main__':
    verify()
    print('Verified all 19 payload files, sizes, both pinned manifests and identical Gate C copies.')
