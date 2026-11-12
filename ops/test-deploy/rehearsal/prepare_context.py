"""Copy an explicit source allowlist; never ship a checkout, .git or local data."""
from pathlib import Path
import shutil
import sys

FILES = (
    "scripts/test_deploy.py", "scripts/test_deploy_preflight.py", "scripts/ops_storage.py",
    "scripts/tests/test_test_deploy.py", "scripts/tests/test_ops_storage.py",
    "scripts/tests/test_rehearsal.py",
    ".github/workflows/rehearse-test-deploy.yml",
    ".github/workflows/deploy-test.yml", "ops/test-deploy/register-main.patch",
    "ops/test-deploy/ssh-gate", "ops/test-deploy/docker-compose.test.yml",
    "ops/test-deploy/rehearsal/entry.sh", "ops/test-deploy/rehearsal/fixture.py",
    "ops/test-deploy/rehearsal/harness.py",
    "ops/test-deploy/rehearsal/prepare_context.py", "ops/test-deploy/rehearsal/Dockerfile",
    "ops/test-deploy/rehearsal/cgroup_setup.py",
)


def prepare(destination):
    source = Path(__file__).resolve().parents[3]
    destination.mkdir(parents=True, exist_ok=False)
    for name in FILES:
        original = source/name
        if original.is_symlink() or not original.is_file() or not original.resolve().is_relative_to(source):
            raise ValueError("missing or linked rehearsal input")
        target = destination/"review"/name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(original.read_text(), encoding="utf-8", newline="\n")
    shutil.copyfile(Path(__file__).with_name("Dockerfile"), destination/"Dockerfile")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("one NEW build context directory required")
    prepare(Path(sys.argv[1]))
