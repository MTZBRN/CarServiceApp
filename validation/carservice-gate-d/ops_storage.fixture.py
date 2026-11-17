"""Offline-pair backup and isolated restore test. Python 3.12+, standard library only.

SQLite backup() captures committed WAL state safely. Pair consistency with uploads
additionally REQUIRES stopped application/file writers; --quiesced acknowledges this.
No production restore, pruning, network transfer or container control is performed.
"""
import argparse
from contextlib import closing
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import stat
import sys
import tarfile
import tempfile
import time
import uuid

TABLES = {"Customers", "Vehicles", "Appointments", "ServiceJobs", "JobParts", "Parts", "Users", "GlobalSettings", "AuditEvents", "__EFMigrationsHistory"}
ARTIFACTS = {"database.sqlite", "uploads.tar.gz", "manifest.json"}
MAX_MANIFEST = 1024 * 1024


def safe_path(value):
    path = Path(value)
    if not path.is_absolute() or ".." in path.parts:
        raise ValueError("Use explicit absolute paths without parent traversal")
    for part in (path, *path.parents):
        if part.is_symlink() or (hasattr(part, "is_junction") and part.is_junction()):
            raise ValueError("Linked paths are not accepted")
    return path.resolve()


def overlaps(a, b):
    return a == b or a.is_relative_to(b) or b.is_relative_to(a)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def readonly(path):
    return sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=10)


def database_info(path):
    with closing(readonly(path)) as connection:
        if connection.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise ValueError("Database integrity check failed")
        if connection.execute("PRAGMA foreign_key_check").fetchone() is not None:
            raise ValueError("Database foreign-key check failed")
        present = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        # Only constant table names enter SQL, never manifest/request-controlled identifiers.
        return {name: connection.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0] for name in sorted(TABLES & present)}


def relative_name(name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or any(p in {".", ".."} for p in path.parts) or "\\" in name or ":" in name or any(ord(c) < 32 for c in name):
        raise ValueError("Unsafe archive path")
    if str(path) != name:
        raise ValueError("Noncanonical archive path")
    return path


def inventory(root):
    result = []
    for current, directories, files in os.walk(root, followlinks=False):
        for name in sorted(directories + files):
            path = Path(current) / name
            mode = path.lstat().st_mode
            if stat.S_ISLNK(mode) or (hasattr(path, "is_junction") and path.is_junction()):
                raise ValueError("Upload links are not backed up")
            if stat.S_ISDIR(mode):
                continue
            if not stat.S_ISREG(mode):
                raise ValueError("Special upload files are not backed up")
            relative = path.relative_to(root).as_posix()
            relative_name(relative)
            result.append({"name": relative, "size": path.stat().st_size, "sha256": digest(path)})
    return sorted(result, key=lambda item: item["name"])


def source_stamp(db):
    result = []
    for path in (db, Path(str(db) + "-wal")):
        info = path.stat() if path.exists() else None
        # A read-only WAL connection may create an empty sidecar; it contains no committed pages.
        result.append(None if info is None or (path != db and info.st_size == 0) else (info.st_size, info.st_mtime_ns, info.st_ino))
    return result


def backup(db, uploads, output, quiesced=False):
    if not quiesced:
        raise ValueError("Stop all application/file writers and explicitly acknowledge --quiesced")
    db, uploads, output = map(safe_path, (db, uploads, output))
    if not db.is_file() or not uploads.is_dir() or db == Path(db.anchor):
        raise ValueError("Expected existing database and upload directory")
    if overlaps(db.parent, uploads) or overlaps(output, db.parent) or overlaps(output, uploads):
        raise ValueError("Database, uploads and backup output must be separated")
    output.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name == "posix" and (output.stat().st_mode & 0o077 or output.stat().st_uid != os.geteuid()):
        raise ValueError("Backup output must be owned by the operator with mode 0700")
    lock = output / ".backup.lock"
    fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(fd)
    try:
        stamp = source_stamp(db)
        files = inventory(uploads)
        label = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:12]
        partial = output / (".partial-" + label)
        partial.mkdir(mode=0o700)
        started = time.monotonic()

        def progress(_status, _remaining, _total):
            if time.monotonic() - started > 300:
                raise TimeoutError("SQLite backup exceeded five minutes")

        destination = partial / "database.sqlite"
        with closing(readonly(db)) as source, closing(sqlite3.connect(destination)) as target:
            source.backup(target, pages=256, progress=progress, sleep=0.05)
            target.execute("PRAGMA journal_mode=DELETE")
            target.commit()
        destination.chmod(0o600)
        counts = database_info(destination)
        with tarfile.open(partial / "uploads.tar.gz", "w:gz", dereference=False) as archive:
            for item in files:
                archive.add(uploads / item["name"], arcname=item["name"], recursive=False)
        if files != inventory(uploads) or stamp != source_stamp(db):
            raise ValueError("Source changed: paired backup requires quiesced writers")
        manifest = {"format": 1, "timestampUtc": dt.datetime.now(dt.UTC).isoformat(), "databaseTables": counts, "uploadBytes": sum(item["size"] for item in files), "uploads": files}
        text = json.dumps(manifest, sort_keys=True, indent=2)
        if len(text.encode()) > MAX_MANIFEST:
            raise ValueError("Manifest too large for this operator tool")
        (partial / "manifest.json").write_text(text + "\n", encoding="utf-8")
        (partial / "SHA256SUMS").write_text("".join(f"{digest(partial / name)}  {name}\n" for name in sorted(ARTIFACTS)), encoding="ascii")
        # Flush artifacts before publication. A hardware-level durability/restore test remains operational work.
        for path in partial.iterdir():
            path.chmod(0o600)
            with path.open("r+b") as stream:
                os.fsync(stream.fileno())
        if os.name == "posix":
            directory_fd = os.open(partial, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        final = output / ("backup-" + label)
        partial.rename(final)
        if os.name == "posix":
            directory_fd = os.open(output, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        return final
    finally:
        lock.unlink()


def restore_test(backup_dir, target, max_upload_bytes=1024 * 1024 * 1024):
    backup_dir, target = map(safe_path, (backup_dir, target))
    # Fixed Linux temp roots, never production paths or TMPDIR-selected data locations.
    roots = [Path("/tmp"), Path("/var/tmp")] if os.name == "posix" else [Path(tempfile.gettempdir()).resolve()]
    if not target.name.startswith("carserviceapp-restore-test-") or not any(target.is_relative_to(root) for root in roots):
        raise ValueError("Restore test target must be a new carserviceapp-restore-test-* directory under a system temp root")
    if target.exists() or overlaps(target, backup_dir):
        raise ValueError("Restore target must not exist or overlap backup")
    if not target.parent.is_dir():
        raise ValueError("Restore target needs an existing trusted parent")
    if os.name == "posix":
        temp_root = next(root for root in roots if target.is_relative_to(root))
        for parent in target.parents:
            if parent == temp_root:
                break
            info = parent.stat()
            if info.st_uid != os.geteuid() or info.st_mode & 0o022:
                raise ValueError("Restore parent must be operator-owned and not writable by other accounts")
    checksum_path = safe_path(backup_dir / "SHA256SUMS")
    if not backup_dir.is_dir() or checksum_path.stat().st_size > 4096:
        raise ValueError("Invalid backup/checksum set")
    checks = {}
    for line in checksum_path.read_text(encoding="ascii").splitlines():
        checksum, name = line.split("  ", 1)
        if name not in ARTIFACTS or name in checks or len(checksum) != 64:
            raise ValueError("Invalid checksum manifest")
        checks[name] = checksum
    if checks.keys() != ARTIFACTS:
        raise ValueError("Incomplete checksum set")
    for name, checksum in checks.items():
        path = safe_path(backup_dir / name)
        if not path.is_file() or digest(path) != checksum:
            raise ValueError("Artifact checksum verification failed")
    manifest_path = backup_dir / "manifest.json"
    if manifest_path.stat().st_size > MAX_MANIFEST:
        raise ValueError("Manifest too large")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("format") != 1 or not isinstance(manifest.get("uploads"), list):
        raise ValueError("Unsupported manifest")
    expected = {}
    for item in manifest["uploads"]:
        relative_name(item["name"])
        if item["name"] in expected or not isinstance(item["size"], int) or item["size"] < 0:
            raise ValueError("Invalid upload inventory")
        expected[item["name"]] = item
    total = sum(item["size"] for item in expected.values())
    if total != manifest.get("uploadBytes") or total > max_upload_bytes or max_upload_bytes <= 0:
        raise ValueError("Upload restore bound exceeded or invalid inventory")
    existing_parent = next(parent for parent in target.parents if parent.exists())
    if shutil.disk_usage(existing_parent).free < total + (backup_dir / "database.sqlite").stat().st_size + 16 * 1024 * 1024:
        raise ValueError("Insufficient space for restore test")
    target.mkdir(mode=0o700)
    data = target / "data"
    uploads = target / "uploads"
    data.mkdir(mode=0o700)
    uploads.mkdir(mode=0o700)
    shutil.copyfile(backup_dir / "database.sqlite", data / "app.db")
    (data / "app.db").chmod(0o600)
    seen = set()
    # Streaming extraction: never applies tar owners/modes or follows links; no extractall().
    with tarfile.open(backup_dir / "uploads.tar.gz", "r|gz") as archive:
        for member in archive:
            name = relative_name(member.name).as_posix()
            if not member.isfile() or name not in expected or name in seen or member.size != expected[name]["size"]:
                raise ValueError("Unexpected/linked/special archive member")
            seen.add(name)
            path = uploads / name
            path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            source = archive.extractfile(member)
            with path.open("xb") as out:
                shutil.copyfileobj(source, out, length=1024 * 1024)
            path.chmod(0o600)
            if path.stat().st_size != member.size or digest(path) != expected[name]["sha256"]:
                raise ValueError("Restored upload verification failed")
    if seen != expected.keys() or database_info(data / "app.db") != manifest["databaseTables"] or inventory(uploads) != manifest["uploads"]:
        raise ValueError("Restore verification failed")
    (target / "RESTORE_VERIFIED.json").write_text(json.dumps({"format": 1, "verifiedUtc": dt.datetime.now(dt.UTC).isoformat(), "uploadFiles": len(seen), "databaseTables": manifest["databaseTables"]}, indent=2) + "\n", encoding="utf-8")
    return target


def main():
    if sys.version_info < (3, 12):
        raise SystemExit("Python 3.12+ is required")
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    save = commands.add_parser("backup")
    save.add_argument("--db", required=True)
    save.add_argument("--uploads", required=True)
    save.add_argument("--output", required=True)
    save.add_argument("--quiesced", action="store_true")
    restore = commands.add_parser("restore-test")
    restore.add_argument("--backup", required=True)
    restore.add_argument("--target", required=True)
    restore.add_argument("--max-upload-bytes", type=int, default=1024 * 1024 * 1024)
    args = parser.parse_args()
    try:
        if args.command == "backup":
            result = backup(args.db, args.uploads, args.output, args.quiesced)
        else:
            result = restore_test(args.backup, args.target, args.max_upload_bytes)
    except (OSError, ValueError, RuntimeError, sqlite3.Error, tarfile.TarError, EOFError, KeyError, TypeError) as error:
        # No customer names, file contents, credentials or exception detail in logs.
        print(f"Operation failed ({type(error).__name__}). Inspect protected artifacts; source business records were not modified.", file=sys.stderr)
        return 1
    print(f"Operation verified: {result.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
