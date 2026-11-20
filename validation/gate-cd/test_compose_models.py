"""Portable candidate model regression, optionally using a real Compose binary."""
import copy
import importlib.util
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest

HERE = Path(__file__).resolve().parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def subject():
    d = load(HERE.parent / 'carservice-gate-d/gate-d.py', 'candidate_d')
    # Pure model validators need only these fictional identity constants.
    d.C = SimpleNamespace(PROJECT='gate-d-normalization-fixture', NETWORK='fictional-network',
                          IDENTITIES={s: ('a'*64, 'sha256:'+'b'*64) for s in ('backend', 'frontend')},
                          ADDRESSES={'backend': '172.30.91.2', 'frontend': '172.30.91.3'})
    d.C.decode_json = json.loads
    # Keep the Linux candidate paths unchanged in cross-platform model tests.
    d.OLD_DATA = PurePosixPath('/opt/carserviceapp/test-data')
    d.OLD_UPLOADS = PurePosixPath('/opt/carserviceapp/test-uploads')
    d.TARGET = PurePosixPath('/srv/carserviceapp-test')
    support = load(HERE.parent / 'carservice-gate-d/test_gate_d.py', 'candidate_test_support')
    return d, support.model(d), support.model(d, 'new')


class ModelRegression(unittest.TestCase):
    def test_actual_2382_network_shape(self):
        d, old, new = subject()
        for model in (old, new):
            # Actual `config --format json` network output from Compose 2.38.2.
            model['networks'] = {'workshop': {
                'name': 'fictional-network', 'ipam': {}, 'external': True}}
        d.validate_models(old, new)

    def test_source_shape_remains_valid(self):
        d, old, new = subject()
        d.validate_models(old, new)

    def test_creation_options_wrong_names_and_nonboolean_external_refused(self):
        d, old, _ = subject()
        for key, value in [('ipam', {'driver': 'default'}), ('ipam', {'config': []}),
                           ('ipam', None), ('ipam', []), ('external', False), ('external', 1),
                           ('external', 'true'), ('name', 'wrong'), ('driver', 'bridge'),
                           ('internal', True), ('labels', {})]:
            model = copy.deepcopy(old)
            model['networks']['workshop'][key] = value
            with self.subTest(key=key, value=value), self.assertRaisesRegex(RuntimeError, '^external-network-required$'):
                d.validate_model(model, 'old')

    def test_missing_extra_and_malformed_networks_refused(self):
        d, old, _ = subject()
        for networks in (None, [], {}, {'workshop': None},
                         {'workshop': {'name': d.C.NETWORK}},
                         dict(old['networks'], extra={})):
            model = copy.deepcopy(old); model['networks'] = networks
            with self.subTest(networks=networks), self.assertRaisesRegex(RuntimeError, '^external-network-required$'):
                d.validate_model(model, 'old')

    def test_image_storage_and_baseline_guards_remain(self):
        d, old, new = subject()
        for model in (old, new): model['networks']['workshop']['ipam'] = {}
        wrong = copy.deepcopy(old); wrong['services']['backend']['image'] = 'mutable:latest'
        with self.assertRaisesRegex(RuntimeError, 'exact-image-required'): d.validate_model(wrong, 'old')
        wrong = copy.deepcopy(old); wrong['services']['backend']['volumes'][0]['source'] = '/wrong'
        with self.assertRaisesRegex(RuntimeError, 'compose-storage-layout'): d.validate_model(wrong, 'old')
        wrong = copy.deepcopy(new); wrong['services']['backend']['environment'] = {'FICTIONAL': 'changed'}
        with self.assertRaisesRegex(RuntimeError, 'baseline-drift-beyond-storage'): d.validate_models(old, wrong)

    def test_native_omission_requires_explicit_safe_authored_baseline(self):
        d, old, new = subject()
        source = {'old_model': old, 'new_model': new}
        normalized = copy.deepcopy(source)
        for model in normalized.values():
            model['networks']['workshop']['ipam'] = {}
            for volume in model['services']['backend']['volumes']: volume['bind'] = {}
        d.reference = lambda a, key: json.dumps(source[key]).encode()
        d.compose = lambda a, key, tail: json.dumps(normalized[key])
        d.native_models({})
        normalized['old_model']['services']['backend']['volumes'][0]['bind']['create_host_path'] = True
        with self.assertRaisesRegex(RuntimeError, 'unsafe-bind'): d.native_models({})
        normalized['old_model']['services']['backend']['volumes'][0]['bind'] = {}
        source['old_model']['services']['backend']['volumes'][0]['bind'] = {}
        with self.assertRaisesRegex(RuntimeError, 'unsafe-bind'): d.native_models({})


def real_compose(executable):
    version = subprocess.check_output([executable, 'version', '--short'], text=True).strip()
    if version.lstrip('v') != '2.38.2':
        raise RuntimeError('requires-compose-2-38-2')
    d, old, new = subject()
    with tempfile.TemporaryDirectory(prefix='gate-d-compose-fictional-') as tmp:
        root = Path(tmp)
        (root / 'empty.env').write_bytes(b'')
        normalized = []
        for name, model in (('old', old), ('new', new)):
            path = root / (name + '.json')
            path.write_text(json.dumps(model), encoding='utf-8')
            # Keep Linux bind paths lexical on Windows. Network normalization is
            # identical with/without this flag (also reproduced on a minimal model).
            result = subprocess.run([executable, '--project-directory', str(root),
                                     '--env-file', str(root / 'empty.env'), '-f', str(path),
                                     'config', '--no-path-resolution', '--format', 'json'],
                                    capture_output=True, text=True, timeout=30)
            if result.returncode: raise RuntimeError('fictional-compose-config-failed')
            normalized.append(json.loads(result.stdout))
        for model in normalized:
            if model['networks'] != {'workshop': {'name': d.C.NETWORK, 'external': True, 'ipam': {}}}:
                raise RuntimeError('unexpected-compose-network-normalization')
        source = {'old_model': old, 'new_model': new}
        native = dict(zip(('old_model', 'new_model'), normalized))
        d.reference = lambda a, key: json.dumps(source[key]).encode()
        d.compose = lambda a, key, tail: json.dumps(native[key])
        d.native_models({})
        print('PASS real Compose 2.38.2 old/new normalization and candidate validation (no daemon)')


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--compose': real_compose(sys.argv[2])
    else: unittest.main()
