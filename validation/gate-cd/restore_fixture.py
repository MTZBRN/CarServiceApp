"""Scratch space for the disposable Gate D restore check."""
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory


@contextmanager
def restore_target():
    # The helper requires a trusted parent under a fixed Linux temp root and
    # creates the target itself. Scope cleanup to this invocation's parent.
    with TemporaryDirectory(prefix='gate-cd-restore-', dir='/tmp') as parent:
        yield Path(parent) / 'carserviceapp-restore-test-fictional'
