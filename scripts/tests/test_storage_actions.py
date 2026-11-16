import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('storage_actions_tool', ROOT/'scripts/storage_actions.py')
a = importlib.util.module_from_spec(spec); spec.loader.exec_module(a)
ARCHIVE = ROOT/'ops/test-deploy/review-artifacts/phase6f3-storage-review.tar.gz'


class StorageActionsTests(unittest.TestCase):
    def test_exact_snapshot_verifies_and_extracts_native_package(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'unpacked'
            result=a.verify(ARCHIVE,target)
            self.assertEqual(result['sha256'],a.SHA256)
            manifest = 'ops/test-deploy/INSTALL_ARTIFACTS.sha256'
            self.assertEqual((ROOT/manifest).read_bytes(), (target/'review'/manifest).read_bytes())
            for line in (ROOT/manifest).read_text().splitlines():
                digest, name = line.split('  ', 1)
                self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(), digest, name)
            self.assertNotIn('compose_compat',(target/'Dockerfile').read_text())
            self.assertIn('d.validate_model(model', (target/'review/ops/test-deploy/rehearsal/storage_cutover.py').read_text())
            with self.assertRaises(ValueError): a.verify(ARCHIVE,target)

    def test_changed_archive_is_rejected_before_extraction(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive=Path(tmp)/'bad.tar.gz'; archive.write_bytes(ARCHIVE.read_bytes()+b'changed')
            target=Path(tmp)/'out'
            with self.assertRaisesRegex(ValueError,'digest mismatch'): a.verify(archive,target)
            self.assertFalse(target.exists())

    def test_internal_mismatch_and_unsafe_members_rejected_before_writes(self):
        for bad_name in ('../escape','valid.txt'):
            with self.subTest(name=bad_name), tempfile.TemporaryDirectory() as tmp:
                archive=Path(tmp)/'bad.tar'
                with tarfile.open(archive,'w') as tar:
                    for name,data in ((bad_name,b'changed'),('SHA256SUMS',('0'*64+'  '+bad_name+'\n').encode())):
                        info=tarfile.TarInfo(name); info.size=len(data);tar.addfile(info,io.BytesIO(data))
                with patch.object(a,'SHA256',hashlib.sha256(archive.read_bytes()).hexdigest()):
                    with self.assertRaises(ValueError): a.verify(archive,Path(tmp)/'out')
                self.assertFalse((Path(tmp)/'out').exists())

    def test_all_scenarios_need_native_success_and_recovery_where_applicable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); log=root/'log'; report=root/'report'; journal=root/'journal'
            log.write_text('{"status":"PASS","stage":"native-compose"}\n')
            for scenario in a.SCENARIOS:
                record=dict(status='PASS',scenario=scenario,real_vps_tested=False,native_compose=True,
                            same_images=True,paired_data_verified=True,fictional_prod_unchanged=True)
                report.write_text(json.dumps(record));journal.write_text('{"stage":"recovered"}')
                self.assertEqual(a.evidence(scenario,'success',log,report,journal)['status'],'PASS')
                for key in ('native_compose','same_images','paired_data_verified','fictional_prod_unchanged'):
                    report.write_text(json.dumps({**record,key:False}))
                    self.assertEqual(a.evidence(scenario,'success',log,report,journal)['status'],'FAIL')
                report.write_text(json.dumps(record));journal.write_text('{}')
                if scenario in ('interrupted-cutover','failed-startup'):
                    self.assertEqual(a.evidence(scenario,'success',log,report,journal)['status'],'FAIL')
                self.assertEqual(a.evidence(scenario,'failure',log,report,journal)['status'],'FAIL')

    def test_missing_or_hostile_evidence_cannot_pass_or_leak(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);log=root/'log';report=root/'report';journal=root/'journal'
            self.assertEqual(a.evidence('success','skipped',log,report,journal)['status'],'FAIL')
            log.write_text('SECRET\n'+json.dumps({'stage':'native-compose','status':'STOP',
                'unexpected_service_keys':{'backend':['command','SECRET']},'message':'SECRET'}))
            report.write_text('{"status":"SECRET"}');journal.write_text('{"stage":"SECRET"}')
            result=a.evidence('success','failure',log,report,journal)
            self.assertNotIn('SECRET',json.dumps(result))
            self.assertEqual(result['known_rejected_keys'],['command'])

    def test_manual_hosted_matrix_has_no_deployment_credentials(self):
        text=(ROOT/'.github/workflows/rehearse-test-storage.yml').read_text()
        for token in ('workflow_dispatch:','runs-on: ubuntu-24.04','fail-fast: false','contents: read',
                      'persist-credentials: false','--network none --cgroupns private',a.SHA256):
            self.assertIn(token,text)
        for forbidden in ('secrets.', 'environment:', 'self-hosted', 'pull_request:', '\n  push:',
                          'ssh ', 'TEST_DEPLOY_ENABLED', 'continue-on-error:'):
            self.assertNotIn(forbidden,text)
        for scenario in a.SCENARIOS: self.assertIn(scenario,text)
        self.assertIn('path: sanitized/${{ matrix.scenario }}.json',text)
        self.assertNotIn('path: ${{ runner.temp }}',text)
