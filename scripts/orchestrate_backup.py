"""Cold paired backup orchestration. Linux/root only; no installation or pruning."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import sys
import time

sys.dont_write_bytecode = True  # Read-only preflight must not create module caches.
# With python -I -S, admit only the explicitly installed, protected helper directory.
if __name__ == "__main__" and sys.platform == "linux":
    helper = Path(__file__).absolute().parent
    for entry in [helper / "ops_storage.py", helper, *helper.parents]:
        info = entry.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise SystemExit("Untrusted runtime import path")
    sys.path.insert(0, str(helper))
from ops_storage import safe_path, overlaps


class Failure(Exception):
    pass


DOCKER = ["docker", "--host", "unix:///var/run/docker.sock"]
COMMAND_ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "HOME": "/root", "LANG": "C.UTF-8",
               "PYTHONDONTWRITEBYTECODE": "1"}


def run(argv, seconds=30):
    # Never print command output: Compose config and daemon errors can contain secrets.
    process = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                               start_new_session=True, env=COMMAND_ENV)
    try:
        output, _ = process.communicate(timeout=seconds)
        if process.returncode:
            raise Failure("Command failed")
        return output.decode().strip()
    finally:
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass  # Child exited between poll and kill.
            process.wait()


def interrupted(_signum, _frame):
    raise Failure("Interrupted")


class Orchestrator:
    def __init__(self, config):
        self.c = config
        self.compose = DOCKER + ["compose", "--project-name", config["project_name"],
                        "--project-directory", config["compose_dir"],
                        "--env-file", config["env_file"], "-f", config["compose_dir"] + "/runtime.json"]
        self.ids = {}
        self.original = {}

    def state(self, service):
        return json.loads(run(DOCKER + ["inspect", "--format", "{{json .State}}", self.ids[service]]))

    def healthy(self, service):
        deadline = time.monotonic() + self.c["health_timeout"]
        while time.monotonic() < deadline:
            state = self.state(service)
            if state.get("Running") and state.get("Health", {}).get("Status") == "healthy":
                return
            time.sleep(1)
        raise Failure("Health deadline exceeded")

    def https(self):
        for route, expected in [("/", "200"), ("/api/Customers", "401")]:
            code = run(["curl", "--disable", "--silent", "--noproxy", "*", "--proto", "=https",
                        "--max-time", "15", "--output", "/dev/null", "--write-out", "%{http_code}",
                        "https://" + self.c["hostname"] + route], 20)
            if code != expected:
                raise Failure("HTTPS verification failed")

    def preflight(self):
        if sys.platform != "linux" or os.geteuid() != 0 or sys.version_info < (3, 12):
            raise Failure("Linux root and Python 3.12+ required")
        for tool in ["docker", "systemctl", "curl", "bash", "python3"]:
            if not shutil.which(tool, path=COMMAND_ENV["PATH"]):
                raise Failure("Required tool missing")
        run(["python3", "-c", "import sys, sqlite3; assert sys.version_info >= (3,12)"])
        c = self.c
        if not c["hostname"] or any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789.-" for ch in c["hostname"]):
            raise Failure("Invalid hostname")
        for key in ["stop_timeout", "backup_timeout", "start_timeout", "health_timeout"]:
            if type(c[key]) is not int or not 1 <= c[key] <= 3600:
                raise Failure("Invalid timeout")
        paths = {key: safe_path(c[key]) for key in ["compose_dir", "env_file", "db", "uploads", "output", "lock", "release"]}
        for path in paths.values():
            if not path.exists():
                raise Failure("Required path missing")
        for key in ["env_file", "lock"]:
            info = paths[key].stat()
            if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077:
                raise Failure("Private root-owned file required")
        for key in ["compose_dir", "release", "env_file", "lock", "output"]:
            for path in [paths[key], *paths[key].parents]:
                if path.stat().st_uid != 0 or path.stat().st_mode & 0o022:
                    raise Failure("Untrusted administrative path")
        for name in ["runtime.json", "identity.json"]:
            path = safe_path(paths["compose_dir"] / name)
            if not path.is_file() or path.stat().st_uid != 0 or path.stat().st_mode & 0o022:
                raise Failure("Untrusted Compose file")
        for name in ["orchestrate_backup.py", "backup.sh", "ops_storage.py"]:
            path = safe_path(paths["release"] / "scripts" / name)
            if not path.is_file() or any(p.stat().st_uid != 0 or p.stat().st_mode & 0o022 for p in [path, path.parent]):
                raise Failure("Untrusted backup implementation")
        # Everything in the installed release (including archived inputs) is root-private.
        for current, dirs, files in os.walk(paths["release"]):
            for name in dirs + files:
                entry = safe_path(Path(current) / name)
                info = entry.stat()
                if info.st_uid != 0 or info.st_mode & 0o077 or not (entry.is_file() or entry.is_dir()):
                    raise Failure("Unprotected runtime release entry")
        db, uploads, output = (paths[k] for k in ["db", "uploads", "output"])
        if db.name != "app.db":
            raise Failure("Compose requires app.db")
        if not db.is_file() or not uploads.is_dir() or not output.is_dir() or output.stat().st_mode & 0o077:
            raise Failure("Invalid data/output paths or permissions")
        if overlaps(db.parent, uploads) or overlaps(output, db.parent) or overlaps(output, uploads):
            raise Failure("Overlapping data paths")
        if not os.access(output, os.W_OK) or not os.access(db, os.R_OK):
            raise Failure("Insufficient access")
        size = db.stat().st_size
        wal = safe_path(str(db) + "-wal")
        if wal.exists():
            size += wal.stat().st_size
        def walk_error(_error):
            raise Failure("Cannot inspect upload tree")

        for current, dirs, files in os.walk(uploads, onerror=walk_error):
            for name in dirs + files:
                path = safe_path(Path(current) / name)
                if not path.is_dir():
                    if not path.is_file() or not os.access(path, os.R_OK):
                        raise Failure("Unsupported upload entry")
                    size += path.stat().st_size + 4096
        if shutil.disk_usage(output).free < size * 2 + 256 * 1024 * 1024:
            raise Failure("Insufficient backup space")
        if (output / ".backup.lock").exists():
            raise Failure("Existing backup lock requires operator review")
        run(self.compose + ["config", "--quiet"])
        # Read resolved config in memory only; never log credentials.
        resolved = json.loads(run(self.compose + ["config", "--format", "json"]))
        identity = json.loads((paths["compose_dir"] / "identity.json").read_text())
        if resolved.get("name") != c["project_name"] or identity["project"] != c["project_name"]:
            raise Failure("Runtime project identity mismatch")
        if set(resolved["services"]) != {"backend", "frontend"}:
            raise Failure("Unexpected runtime services")
        for service in ["backend", "frontend"]:
            if resolved["services"][service]["image"] != identity["services"][service]["image"]:
                raise Failure("Runtime image identity mismatch")
        for definition in resolved["services"].values():
            if any(key in definition for key in ["build", "env_file", "extends", "configs", "secrets", "develop"]):
                raise Failure("Runtime must be self-contained without build inputs")
            for mount in definition.get("volumes", []):
                if mount["type"] != "bind":
                    raise Failure("Unsupported runtime mount")
                source = safe_path(mount["source"])
                if source not in [paths["db"].parent, paths["uploads"]]:
                    for entry in [source, *source.parents]:
                        if entry.stat().st_uid != 0 or entry.stat().st_mode & 0o022:
                            raise Failure("Untrusted deployment input")
        required_env = {"ConnectionStrings__DefaultConnection": "Data Source=/app/data/app.db",
                        "Uploads__Path": "/app/uploads"}
        if any(resolved["services"]["backend"].get("environment", {}).get(k) != v
               for k, v in required_env.items()):
            raise Failure("Compose storage configuration mismatch")
        for service in ["backend", "frontend"]:
            ids = run(self.compose + ["ps", "--all", "--quiet", service]).splitlines()
            if len(ids) != 1:
                raise Failure("Exactly one existing container per service required")
            self.ids[service] = ids[0]
            self.verify_identity(service, identity["services"][service])
            state = self.state(service)
            if state["Status"] not in ["running", "exited"]:
                raise Failure("Unstable container state")
            self.original[service] = state["Running"]
            if state["Running"] and state.get("Health", {}).get("Status") != "healthy":
                raise Failure("Unhealthy service before backup")
        expected = {"/app/data": str(db.parent), "/app/uploads": str(uploads)}
        configured = {v["target"]: v.get("source") for v in resolved["services"]["backend"]["volumes"] if v["type"] == "bind"}
        mounted = json.loads(run(DOCKER + ["inspect", "--format", "{{json .Mounts}}", self.ids["backend"]]))
        actual = {v["Destination"]: v["Source"] for v in mounted if v["Type"] == "bind"}
        if any(configured.get(k) != v or actual.get(k) != v for k, v in expected.items()):
            raise Failure("Compose/running data mounts mismatch")
        live_env = dict(item.split("=", 1) for item in json.loads(run(
            DOCKER + ["inspect", "--format", "{{json .Config.Env}}", self.ids["backend"]])) if "=" in item)
        if any(live_env.get(k) != v for k, v in required_env.items()):
            raise Failure("Running storage configuration mismatch")
        # Reject visible extra Docker writers; host writers still must honor the lock.
        for container in run(DOCKER + ["ps", "--quiet"]).splitlines():
            if container in self.ids.values():
                continue
            mounts = json.loads(run(DOCKER + ["inspect", "--format", "{{json .Mounts}}", container]))
            if any(m.get("RW") and m.get("Type") == "bind" and
                   any(overlaps(Path(m["Source"]), p) for p in [db.parent, uploads]) for m in mounts):
                raise Failure("Additional container can write backup sources")
        caddy = run(["systemctl", "show", "caddy", "--property=ActiveState", "--value"])
        if caddy not in ["active", "inactive"]:
            raise Failure("Unstable Caddy state")
        self.original["caddy"] = caddy == "active"
        if self.original["frontend"] and not self.original["backend"]:
            raise Failure("Inconsistent initial service state")
        if self.original["caddy"] and not all(self.original.values()):
            raise Failure("Active ingress requires healthy application")
        if self.original["caddy"]:
            self.https()
        print("Preflight passed; no services changed", flush=True)

    def verify_identity(self, service, expected):
        live = json.loads(run(DOCKER + ["inspect", self.ids[service]]))[0]
        labels = live["Config"]["Labels"]
        networks = {name: item["NetworkID"] for name, item in live["NetworkSettings"]["Networks"].items()}
        if (live["Id"] != expected["id"] or live["Image"] != expected["image"] or
                labels.get("com.docker.compose.project") != self.c["project_name"] or
                labels.get("com.docker.compose.service") != service or networks != expected["networks"]):
            raise Failure("Running container identity changed; install a reviewed runtime release")

    def recover(self):
        print("Restoring original service state", flush=True)
        errors = []
        # Continue all recovery attempts even when a previous service fails.
        for service in ["backend", "frontend", "caddy"]:
            if not self.original[service]:
                continue
            try:
                if service == "caddy":
                    run(["systemctl", "start", "caddy"], self.c["start_timeout"])
                    self.https()
                else:
                    run(self.compose + ["start", service], self.c["start_timeout"])
                    self.healthy(service)
            except Exception:
                print("Recovery check failed: " + service, file=sys.stderr, flush=True)
                errors.append(service)
        if errors:
            raise Failure("Recovery verification failed: " + ", ".join(errors))

    def execute(self):
        try:
            print("Stopping ingress and application", flush=True)
            if self.original["caddy"]:
                run(["systemctl", "stop", "caddy"], self.c["stop_timeout"])
            for service in ["frontend", "backend"]:
                if self.original[service]:
                    run(self.compose + ["stop", "--timeout", str(self.c["stop_timeout"]), service], self.c["stop_timeout"] + 10)
                if self.state(service)["Running"]:
                    raise Failure("Container did not stop")
            if run(["systemctl", "show", "caddy", "--property=ActiveState", "--value"]) != "inactive":
                raise Failure("Ingress did not stop")
            run(["bash", self.c["release"] + "/scripts/backup.sh", "--db", self.c["db"],
                 "--uploads", self.c["uploads"], "--output", self.c["output"], "--quiesced"], self.c["backup_timeout"])
            print("Paired backup verified", flush=True)
        except BaseException:
            print("Backup workflow failed; attempting recovery", file=sys.stderr, flush=True)
            raise
        finally:
            # A second recoverable signal must not interrupt recovery.
            signal.signal(signal.SIGINT, signal.SIG_IGN)
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            self.recover()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    os.umask(0o077)
    try:
        import fcntl
        config_path = safe_path(args.config)
        if any(p.stat().st_uid != 0 or p.stat().st_mode & 0o022 for p in [config_path, *config_path.parents]):
            raise Failure("Untrusted configuration")
        config = json.loads(config_path.read_text())
        # Existing provisioned file only: dry-run creates/modifies no files.
        lock = safe_path(config["lock"])
        if lock.stat().st_uid != 0 or lock.stat().st_mode & 0o077 or not lock.is_file():
            raise Failure("Invalid maintenance lock")
        with lock.open("rb") as stream:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            signal.signal(signal.SIGINT, interrupted)
            signal.signal(signal.SIGTERM, interrupted)
            job = Orchestrator(config)
            job.preflight()
            if not args.dry_run:
                job.execute()
        print("Backup orchestration completed" if not args.dry_run else "Dry-run completed", flush=True)
        return 0
    except Exception as error:
        # Exception details may contain external command output or customer filenames.
        print("Backup orchestration FAILED (" + type(error).__name__ + "); operator review required", file=sys.stderr)
        if isinstance(error, Failure):
            print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
