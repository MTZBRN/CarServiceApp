"""Real root -> 1654 reader regression; temporary fictional files, no Docker."""
import importlib.util
import os
from pathlib import Path
import signal
import sqlite3
import stat
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class OwnerReaderTests(unittest.TestCase):
    def setUp(self):
        candidate = HERE.parent / 'carservice-gate-d'
        self.d = load(candidate / 'gate-d.py', 'owner_reader_candidate')
        self.d.C = self.d.load_c()
        self.storage = load(candidate / 'ops_storage.fixture.py', 'owner_reader_storage')
        self.temp = tempfile.TemporaryDirectory(prefix='gate-d-owner-fictional-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.root.chmod(0o700)
        self.data = self.root / 'data'; self.data.mkdir(mode=0o700)
        self.uploads = self.root / 'uploads'; self.uploads.mkdir(mode=0o700)
        (self.uploads / 'nested').mkdir(mode=0o700)
        (self.uploads / 'nested/fictional.txt').write_bytes(b'fictional upload')
        self.db = self.data / 'app.db'
        with sqlite3.connect(self.db) as connection:
            connection.execute('CREATE TABLE __EFMigrationsHistory (MigrationId TEXT, ProductVersion TEXT)')
            connection.execute("INSERT INTO __EFMigrationsHistory VALUES ('fictional_001', '8.0.0')")
            connection.execute('CREATE TABLE Users (Id INTEGER PRIMARY KEY)')
            connection.execute('INSERT INTO Users VALUES (1)')
        connection.close()
        for directory in (self.data, self.uploads):
            for path in [directory, *directory.rglob('*')]:
                os.chown(path, 1654, 1654)
                path.chmod(0o700 if path.is_dir() else 0o600)

    def view(self):
        return self.d.data_view(self.data, self.uploads, self.storage)

    def test_fixture_scratch_passes_real_restore_and_cleans_up(self):
        fixture = load(HERE / 'restore_fixture.py', 'restore_fixture')
        pair = self.storage.backup(self.db, self.uploads, self.root / 'backups', quiesced=True)
        with fixture.restore_target() as scratch:
            self.assertEqual(scratch.parent.parent, Path('/tmp'))
            self.assertEqual(stat.S_IMODE(scratch.parent.stat().st_mode), 0o700)
            self.assertFalse(scratch.exists())
            self.storage.restore_test(pair, scratch, max_upload_bytes=1024)
            self.assertEqual((scratch / 'uploads/nested/fictional.txt').read_bytes(), b'fictional upload')
            with self.assertRaisesRegex(RuntimeError, '^fictional materialization failure$'):
                with fixture.restore_target() as other:
                    self.assertNotEqual(other.parent, scratch.parent)
                    self.storage.restore_test(pair, other, max_upload_bytes=1024)
                    raise RuntimeError('fictional materialization failure')
            self.assertFalse(other.parent.exists())
            self.assertTrue(scratch.is_dir())
        self.assertFalse(scratch.parent.exists())

    def test_private_ancestor_and_real_irreversible_credential_drop(self):
        original = self.storage.database_info

        def checked(db):
            assert os.getresuid() == (1654, 1654, 1654)
            assert os.getresgid() == (1654, 1654, 1654)
            assert os.getgroups() == []
            return original(db)

        self.storage.database_info = checked
        result = self.view()
        self.assertEqual(result['counts']['Users'], 1)
        self.assertEqual(result['history'], [['fictional_001', '8.0.0']])
        self.assertEqual([item['name'] for item in result['uploads']], ['nested/fictional.txt'])
        self.assertEqual(len(result['logical_sha256']), 64)
        self.assertEqual(self.root.stat().st_uid, 0)
        self.assertEqual(stat.S_IMODE(self.root.stat().st_mode), 0o700)
        self.assertEqual(os.geteuid(), 0)

    def test_committed_wal_is_read_and_sidecars_remain_owner_owned(self):
        # Keep the writer alive so a committed row exists only in WAL.
        connection = sqlite3.connect(self.db)
        self.addCleanup(connection.close)
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('PRAGMA wal_autocheckpoint=0')
        connection.execute('INSERT INTO Users VALUES (2)'); connection.commit()
        for suffix in ('-wal', '-shm'):
            os.chown(str(self.db) + suffix, 1654, 1654)
            os.chmod(str(self.db) + suffix, 0o600)
        before = (self.db.read_bytes(), Path(str(self.db) + '-wal').read_bytes())
        self.assertEqual(self.view()['counts']['Users'], 2)
        self.assertEqual(before, (self.db.read_bytes(), Path(str(self.db) + '-wal').read_bytes()))
        for suffix in ('', '-wal', '-shm'):
            value = Path(str(self.db) + suffix).stat()
            self.assertEqual((value.st_uid, value.st_gid), (1654, 1654))

    def test_unreadable_database_reports_migration_stage(self):
        self.db.chmod(0)
        with self.assertRaisesRegex(RuntimeError, '^owner-reader-migration-history-failed$'):
            self.view()

    def test_missing_shm_is_recreated_by_owner_without_losing_committed_wal(self):
        pid = os.fork()
        if pid == 0:
            try:
                os.chdir(self.data); os.chroot('.'); os.chdir('/')
                os.setgroups([]); os.setgid(1654); os.setuid(1654)
                connection = sqlite3.connect('/app.db')
                connection.execute('PRAGMA journal_mode=WAL')
                connection.execute('PRAGMA wal_autocheckpoint=0')
                connection.execute('INSERT INTO Users VALUES (2)'); connection.commit()
                # Simulate a stopped process with committed, uncheckpointed WAL.
                os._exit(0)
            except BaseException:
                os._exit(1)
        self.assertEqual(os.waitpid(pid, 0)[1], 0)
        Path(str(self.db) + '-shm').unlink()
        before = (self.db.read_bytes(), Path(str(self.db) + '-wal').read_bytes())
        self.assertEqual(self.view()['counts']['Users'], 2)
        self.assertEqual(before, (self.db.read_bytes(), Path(str(self.db) + '-wal').read_bytes()))
        info = Path(str(self.db) + '-shm').stat()
        self.assertEqual((info.st_uid, info.st_gid), (1654, 1654))

    def test_unreadable_upload_directory_is_not_silently_omitted(self):
        (self.uploads / 'nested').chmod(0)
        with self.assertRaisesRegex(RuntimeError, '^owner-reader-uploads-failed$'):
            self.view()

    def test_unreadable_upload_file_reports_upload_stage(self):
        (self.uploads / 'nested/fictional.txt').chmod(0)
        with self.assertRaisesRegex(RuntimeError, '^owner-reader-uploads-failed$'):
            self.view()

    def test_owner_mismatch_remains_rejected(self):
        os.chown(self.uploads, 1654, 1655)
        with self.assertRaisesRegex(RuntimeError, '^storage-owner-mismatch$'):
            self.view()

    def test_stage_errors_never_echo_exception_content(self):
        def fail(*args):
            raise RuntimeError('fictional-private-path environment=DO_NOT_PRINT row=DO_NOT_PRINT')

        for target, name, stage in ((self.d.C, 'migration_history', 'migration-history'),
                                    (self.storage, 'database_info', 'database-integrity'),
                                    (self.storage, 'inventory', 'uploads')):
            with self.subTest(stage=stage):
                original = getattr(target, name)
                setattr(target, name, fail)
                try:
                    with self.assertRaisesRegex(RuntimeError, '^owner-reader-' + stage + '-failed$'):
                        self.view()
                finally:
                    setattr(target, name, original)

    def test_signal_exit_is_sanitized(self):
        def terminate(db):
            os.kill(os.getpid(), signal.SIGKILL)
        self.d.C.migration_history = terminate
        with self.assertRaisesRegex(RuntimeError, '^owner-reader-signal-failed$'):
            self.view()

    def test_namespace_credentials_digest_and_report_failures_are_sanitized(self):
        class BrokenDump(sqlite3.Connection):
            def iterdump(self):
                raise RuntimeError('DO_NOT_PRINT fictional row')

        connect = sqlite3.connect
        for target, name, stage, replacement in (
                (self.d.os, 'chroot', 'namespace', {'side_effect': PermissionError('DO_NOT_PRINT path')}),
                (self.d.os, 'setuid', 'credentials', {'side_effect': PermissionError('DO_NOT_PRINT uid')}),
                (self.d.sqlite3, 'connect', 'logical-digest',
                 {'new': lambda *args, **kw: connect(*args, factory=BrokenDump, **kw)}),
                (self.d.json, 'dumps', 'report', {'side_effect': ValueError('DO_NOT_PRINT data')})):
            with self.subTest(stage=stage), patch.object(target, name, **replacement):
                with self.assertRaisesRegex(RuntimeError, '^owner-reader-' + stage + '-failed$'):
                    self.view()


if __name__ == '__main__':
    if not hasattr(os, 'geteuid') or os.geteuid() != 0:
        raise SystemExit('requires Linux root in a disposable test environment')
    unittest.main()
