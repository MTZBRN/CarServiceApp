"""Disposable-only read-only preflight diagnosis; no changes to installed guards."""
import ast
import importlib.machinery
import importlib.util
import json
from pathlib import Path
import sys


def result(module):
    # Only literal require() messages from the reviewed helper may be published.
    tree = ast.parse(Path(module.__file__).read_text())
    allowed = {node.args[1].value for node in ast.walk(tree)
               if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
               and node.func.id == 'require' and len(node.args) == 2
               and isinstance(node.args[1], ast.Constant) and isinstance(node.args[1].value, str)}
    try:
        module.preflight()
        return {'status': 'passed'}
    except module.Refused as error:
        message = str(error)
        return {'status': 'refused', 'invariant': message if message in allowed else 'unlisted refusal'}
    except Exception as error:
        # No exception message, repr, args, stdout, stderr, paths or config values.
        kinds = {FileNotFoundError: 'missing-file', PermissionError: 'permissions',
                 KeyError: 'missing-key', ValueError: 'invalid-value'}
        return {'status': 'error', 'kind': kinds.get(type(error), 'unexpected-error')}


def main(variant):
    if (sys.platform != 'linux' or not Path('/.dockerenv').is_file() or
            Path('/run/phase6e-container').read_text() != 'phase6e-disposable\n'):
        raise RuntimeError('disposable diagnostics only')
    paths = {'installed': Path('/usr/local/sbin/carservice-test-deploy'),
             'source': Path(__file__).resolve().parents[3] / 'scripts/test_deploy.py'}
    loader = importlib.machinery.SourceFileLoader('test_deploy', str(paths[variant]))
    try:
        spec = importlib.util.spec_from_loader(loader.name, loader)
        module = importlib.util.module_from_spec(spec)
        loader.exec_module(module)
    except Exception:
        report = {'status': 'load-error'}
    else:
        report = result(module)
    print(json.dumps({'preflight_variant': variant, **report}), flush=True)


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ('installed', 'source'):
        raise SystemExit('expected installed or source')
    main(sys.argv[1])
