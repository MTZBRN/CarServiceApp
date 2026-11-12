"""Prepare only the disposable container's private cgroup v2 subtree."""
import os
from pathlib import Path
import time

REQUIRED = {"cpu", "memory", "pids"}


def prepare(root=Path("/sys/fs/cgroup")):
    available = set((root / "cgroup.controllers").read_text().split())
    if not REQUIRED <= available:
        raise RuntimeError("required cgroup v2 controllers unavailable")
    # cgroup v2 forbids internal processes when enabling domain controllers.
    # Equivalent to Moby hack/dind's init group, with bounded exec-race retries.
    (root / "init").mkdir(exist_ok=True)
    for _ in range(50):
        for pid in (root / "cgroup.procs").read_text().split():
            if not pid.isdecimal():
                raise RuntimeError("invalid cgroup process identifier")
            try:
                (root / "init/cgroup.procs").write_text(pid)
            except ProcessLookupError:
                pass  # A short-lived process may have exited between read and write.
        try:
            (root / "cgroup.subtree_control").write_text("+cpu +memory +pids")
            enabled = set((root / "cgroup.subtree_control").read_text().split())
            if REQUIRED <= enabled:
                print("cgroup v2 nesting ready: cpu memory pids", flush=True)
                return
        except OSError as error:
            if error.errno != 16:  # EBUSY: an exec process raced the migration.
                raise
        time.sleep(0.1)
    raise RuntimeError("unable to enable required cgroup v2 subtree controllers")


if __name__ == "__main__":
    if (os.geteuid() != 0 or not Path("/.dockerenv").exists() or
            Path("/run/phase6e-container").read_text() != "phase6e-disposable\n" or
            Path("/proc/self/cgroup").read_text().strip() != "0::/"):
        raise SystemExit("private disposable cgroup v2 root required")
    prepare()
