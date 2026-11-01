import importlib.util
from contextlib import closing
import io
import json
import os
from pathlib import Path
import sqlite3
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("ops_storage", Path(__file__).resolve().parents[1] / "ops_storage.py")
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="carserviceapp-stage4a-unit-")
        self.root = Path(self.temp.name).resolve()
        (self.root / "data").mkdir()
        self.uploads = self.root / "uploads"
        self.uploads.mkdir()
        self.db = self.root / "data" / "app.db"
        self.connection = sqlite3.connect(self.db)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("CREATE TABLE Customers (Id INTEGER PRIMARY KEY, Name TEXT)")
        self.connection.execute("CREATE TABLE AuditEvents (Id INTEGER PRIMARY KEY, Action TEXT)")
        self.connection.execute("INSERT INTO Customers VALUES (1,'SYNTHETIC ONLY')")
        self.connection.execute("INSERT INTO AuditEvents VALUES (1,'Customer.Created')")
        self.connection.commit()
        (self.uploads / "profile_1_synthetic.png").write_bytes(b"synthetic fixture, not real customer data")
        self.output = self.root / "backups"
        self.target = self.root / "carserviceapp-restore-test-unit"

    def tearDown(self):
        self.connection.close()
        self.temp.cleanup()

    def save(self):
        return ops.backup(self.db, self.uploads, self.output, True)

    def rewrite_checks(self, folder):
        (folder / "SHA256SUMS").write_text("".join(f"{ops.digest(folder / name)}  {name}\n" for name in sorted(ops.ARTIFACTS)), encoding="ascii")

    def test_committed_wal_and_upload_pair_restores_into_new_target(self):
        self.assertTrue(Path(str(self.db) + "-wal").exists())
        saved = self.save()
        result = ops.restore_test(saved, self.target)
        self.assertTrue((result / "RESTORE_VERIFIED.json").is_file())
        self.assertEqual((self.uploads / "profile_1_synthetic.png").read_bytes(), (result / "uploads/profile_1_synthetic.png").read_bytes())
        with closing(sqlite3.connect(result / "data/app.db")) as db:
            self.assertEqual("SYNTHETIC ONLY", db.execute("SELECT Name FROM Customers").fetchone()[0])
            self.assertEqual(1, db.execute("SELECT count(*) FROM AuditEvents").fetchone()[0])
        self.assertTrue(self.db.exists())

    def test_closed_wal_database_restores(self):
        self.connection.close()
        saved = self.save()
        ops.restore_test(saved, self.target)

    def test_requires_quiescence_acknowledgement(self):
        with self.assertRaises(ValueError):
            ops.backup(self.db, self.uploads, self.output)
        self.assertFalse(self.output.exists())

    def test_rejects_overlapping_paths(self):
        for output in (self.db.parent / "backup", self.uploads / "backup", self.root):
            with self.subTest(output=output), self.assertRaises(ValueError):
                ops.backup(self.db, self.uploads, output, True)

    def test_existing_or_production_restore_target_never_overwritten(self):
        saved = self.save()
        self.target.mkdir()
        sentinel = self.target / "keep"
        sentinel.write_text("preserve")
        for target in (self.target, Path("/opt/carserviceapp/data")):
            with self.subTest(target=target), self.assertRaises(ValueError):
                ops.restore_test(saved, target)
        self.assertEqual("preserve", sentinel.read_text())

    def test_modified_artifact_is_rejected_before_target_creation(self):
        saved = self.save()
        (saved / "uploads.tar.gz").write_bytes(b"corrupt")
        with self.assertRaises(ValueError):
            ops.restore_test(saved, self.target)
        self.assertFalse(self.target.exists())

    def test_path_traversal_and_links_are_rejected_even_with_updated_checksums(self):
        for name, kind in (("../outside.txt", tarfile.REGTYPE), ("link", tarfile.SYMTYPE)):
            saved = self.save()
            with tarfile.open(saved / "uploads.tar.gz", "w:gz") as archive:
                member = tarfile.TarInfo(name)
                member.type = kind
                member.linkname = "../outside.txt" if kind == tarfile.SYMTYPE else ""
                member.size = 1 if kind == tarfile.REGTYPE else 0
                archive.addfile(member, io.BytesIO(b"x") if member.size else None)
            self.rewrite_checks(saved)
            with self.subTest(name=name), self.assertRaises(ValueError):
                ops.restore_test(saved, self.root / ("carserviceapp-restore-test-" + str(kind)))
            self.assertFalse((self.root / "outside.txt").exists())

    def test_restore_size_limit_is_checked_before_extraction(self):
        saved = self.save()
        with self.assertRaises(ValueError):
            ops.restore_test(saved, self.target, 1)
        self.assertFalse(self.target.exists())

    def test_bad_manifest_count_is_detected(self):
        saved = self.save()
        manifest = json.loads((saved / "manifest.json").read_text())
        manifest["databaseTables"]["Customers"] = 999
        (saved / "manifest.json").write_text(json.dumps(manifest))
        self.rewrite_checks(saved)
        with self.assertRaises(ValueError):
            ops.restore_test(saved, self.target)

    def test_exclusive_backup_lock_prevents_overlap(self):
        self.output.mkdir(mode=0o700)
        (self.output / ".backup.lock").write_text("held")
        with self.assertRaises(FileExistsError):
            self.save()
        self.assertTrue((self.output / ".backup.lock").exists())

    def test_upload_symlink_refused(self):
        link = self.uploads / "profile_1_link.png"
        try:
            link.symlink_to(self.db)
        except OSError:
            self.skipTest("OS does not grant symlink creation for this test account")
        with self.assertRaises(ValueError):
            self.save()


if __name__ == "__main__":
    unittest.main()
