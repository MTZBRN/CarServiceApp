"""Disposable-only integration harness. Production helper has no rehearsal mode."""
from contextlib import ExitStack, closing, contextmanager
import ast
import json
import os
import re
from pathlib import Path
import shutil
import sqlite3
import select
import socket
import socketserver
import subprocess
import sys
import time
import threading
from unittest.mock import patch

REVIEW = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REVIEW/"scripts"))
import test_deploy as d

SOURCE = Path("/fixture-source")
REPORT = Path("/evidence/report.json")
BASE_IMAGE = "python:3.12-slim-bookworm"
SCENARIOS = ("success", "backup-failure", "migration-failure")
real_run = d.run
ADMISSION = ["local-fetch", "fixture-ci", "local-fetch", "fixture-ci"]
STAGES = {"building", "stopping", "backing-up", "verifying-backup", "starting-backend",
          "starting-frontend", "healthy"}


class FixtureRelay(socketserver.BaseRequestHandler):
    """Fixed TCP transport only: smoke responses still come from the real fixtures."""
    def handle(self):
        try:
            with socket.create_connection(("172.29.80.3", 8080), timeout=10) as upstream:
                self.request.settimeout(10)
                peers = (self.request, upstream)
                while ready := select.select(peers, [], [], 10)[0]:
                    for source in ready:
                        data = source.recv(65536)
                        if not data:
                            return
                        (upstream if source is self.request else self.request).sendall(data)
        except OSError:
            # A closed connection makes the real smoke check fail; never synthesize HTTP.
            return


class FixtureIngressServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True  # Recovery reopens the same loopback listener.


@contextmanager
def fixture_ingress():
    # Internal-only Docker networks do not publish ports. Preserve that network and
    # provide its intended localhost ingress INSIDE the network-none outer box.
    # No configurable bind/target, host port, extra network, or successful fallback.
    require(real_run("docker", "network", "inspect", "-f", "{{.Internal}}", d.NETWORK) == "true",
            "fixture ingress requires the internal network")
    with FixtureIngressServer(("127.0.0.1", 5174), FixtureRelay) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield
        finally:
            server.shutdown()
            thread.join()


def require(value, message):
    if not value:
        raise RuntimeError(message)


def validate_boundary(marker, interfaces, routes, environment):
    require(marker == "phase6e-disposable\n", "disposable container marker required")
    require(not any(key in environment for key in
                    ("DOCKER_HOST", "DOCKER_CONTEXT", "GH_TOKEN", "GITHUB_TOKEN", "SSH_AUTH_SOCK")),
            "credentials or daemon override forbidden")
    require(all(name == "lo" or name.startswith(("br-", "veth")) for name in interfaces),
            "external network interface forbidden")
    require(not any(line.split()[1] == "00000000" for line in routes.splitlines()[1:] if line.split()),
            "external default route forbidden")


def boundary():
    require(sys.platform == "linux" and os.geteuid() == 0 and Path("/.dockerenv").is_file(),
            "requires disposable Linux container")
    validate_boundary(Path("/run/phase6e-container").read_text(),
                      [p.name for p in Path("/sys/class/net").iterdir()],
                      Path("/proc/net/route").read_text(), os.environ)
    require(real_run("docker", "info", "--format", "{{.DockerRootDir}}") == "/var/lib/phase6e-docker",
            "dedicated inner daemon required")
    require(not (d.ETC/"actions-enabled").exists(), "real deployment activation forbidden")


def write(path, text, mode=0o600):
    path.write_text(text, encoding="utf-8")
    path.chmod(mode)


def fixture_dockerfile(role, generation):
    uid = 1654 if role == "backend" else 101
    return f'''FROM {BASE_IMAGE}
COPY fixture.py /fixture.py
RUN printf '{role}' > /role && printf '{generation}' > /generation && chmod 0644 /role /generation
USER {uid}:{uid}
EXPOSE 8080
HEALTHCHECK --interval=1s --timeout=3s --start-period=1s --retries=3 CMD ["python", "/fixture.py", "health"]
ENTRYPOINT ["python", "/fixture.py"]
'''


def dc(*args, file=None, tag="baseline"):
    return real_run("docker", "compose", "--project-name", d.PROJECT,
                    "--project-directory", str(d.ETC), "--env-file", str(d.ENV_FILE),
                    "-f", str(file or d.ETC/"docker-compose.test.yml"), *args,
                    env={"APP_IMAGE_TAG":tag}, timeout=240)


def diagnostic_text(value):
    """Default-deny vocabulary: arbitrary identifiers, paths and credentials never leave the box."""
    words = set(('failed to create task for container shim OCI runtime runc unable start process '
                 'error during init open sysctl reopen fd permission denied operation not permitted '
                 'mount mounting mounted namespace namespaces network bridge endpoint veth iptables '
                 'cgroup cgroups memory cpu pids read only file system no such directory exists '
                 'invalid argument executable format exec stat bind address already in use '
                 'apparmor seccomp profile apply load security context capability capabilities '
                 'cannot allocate space left on device resource temporarily unavailable '
                 'daemon docker containerd starting started listening API socket initialization '
                 'completed warning info fatal debug level time msg transport timeout connection '
                 'refused unsupported function not implemented exit status code unknown eacces eperm enoent '
                 'net.ipv4.ip_unprivileged_port_start net.ipv4.ip_forward').lower().split())
    if not isinstance(value, str):
        return ""
    # Only known diagnostic words/punctuation survive. Even quoted secret values are redacted.
    return re.sub(r'''[^\s:;,()="'\\]+''', lambda m: m[0] if m[0].lower() in words else "[redacted]",
                  re.sub(r"[\x00-\x1f\x7f]", " ", value[:4096]))


def daemon_diagnostics():
    try:
        with Path("/evidence/daemon.log").open("rb") as log:
            log.seek(0, 2)
            log.seek(max(0, log.tell() - 65536))
            lines = log.read(65536).decode("utf-8", errors="replace").splitlines()[-40:]
        return [diagnostic_text(line) for line in lines]
    except OSError:
        return ["unavailable"]


def startup_diagnostics():
    """State projection and sanitized daemon tail; no raw config, env or log output."""
    rows = []
    for service in d.SERVICES:
        try:
            ids = real_run("docker", "ps", "-aq", "--filter", f"label=com.docker.compose.project={d.PROJECT}",
                           "--filter", f"label=com.docker.compose.service={service}").splitlines()
            for cid in ids:
                state = json.loads(real_run("docker", "inspect", "--format", "{{json .State}}", cid))
                health = state.get("Health", {})
                rows.append({"service": service,
                             "state_error": diagnostic_text(state.get("Error")),
                             "status": state.get("Status") if state.get("Status") in
                             ("created", "running", "paused", "restarting", "removing", "exited", "dead") else "unknown",
                             "exit_code": state.get("ExitCode") if type(state.get("ExitCode")) is int else None,
                             "health": health.get("Status") if health.get("Status") in
                             ("starting", "healthy", "unhealthy") else "unknown",
                             "health_exit_codes": [v["ExitCode"] for v in health.get("Log", [])[-3:]
                                                   if type(v.get("ExitCode")) is int]})
        except Exception:
            rows.append({"service": service, "diagnostics": "unavailable"})
    cgroups = {}
    for field, filename in (("available", "cgroup.controllers"), ("enabled", "cgroup.subtree_control")):
        try:
            cgroups[field] = sorted(set(Path('/sys/fs/cgroup', filename).read_text().split()) & {"cpu", "memory", "pids"})
        except OSError:
            cgroups[field] = "unavailable"
    try:
        driver = real_run("docker", "info", "--format", "{{.CgroupDriver}}")
        cgroups['driver'] = driver if driver in ('systemd', 'cgroupfs') else 'unknown'
    except Exception:
        cgroups['driver'] = 'unavailable'
    print(json.dumps({"fixture_startup": rows, "daemon_tail": daemon_diagnostics(), "cgroups": cgroups}), flush=True)


def provision(scenario):
    boundary()
    for p in (d.BASE, d.ETC, d.STATE, SOURCE):
        require(not p.exists(), "fresh container required; never adopt existing storage")
    require(not real_run("docker", "ps", "-aq"), "empty disposable daemon required")
    os.umask(0o077)
    for p in (d.BASE, d.ETC, d.STATE, SOURCE):
        p.mkdir(mode=0o700)
    for p in (d.DATA, d.UPLOADS, d.BACKUPS, d.STATE/"home", d.LIVE_COMPOSE.parent):
        p.mkdir(mode=0o700)
    for src, name, mode in (("scripts/test_deploy.py", "carservice-test-deploy", 0o755),
                            ("scripts/ops_storage.py", "ops_storage.py", 0o644),
                            ("scripts/test_deploy_preflight.py", "carservice-test-preflight", 0o755),
                            ("ops/test-deploy/ssh-gate", "carservice-test-ssh-gate", 0o755)):
        write(Path("/usr/local/sbin")/name, (REVIEW/src).read_text(), mode)
    write(d.ENV_FILE, "JWT_KEY=fictional-rehearsal-only-not-a-real-key\nJWT_ISSUER=fictional\n"
          "JWT_AUDIENCE=fictional\nTEST_SUBNET=172.29.80.0/24\n"
          "TEST_BACKEND_IP=172.29.80.2\nTEST_FRONTEND_IP=172.29.80.3\n")
    model = json.loads((REVIEW/"ops/test-deploy/docker-compose.test.yml").read_text())
    model["networks"]["workshop"]["internal"] = True
    # A migration crash must remain stopped for deterministic operator inspection.
    for service in model["services"].values():
        service["restart"] = "no"
    for path in (d.LIVE_COMPOSE, d.ETC/"docker-compose.test.yml"):
        write(path, json.dumps(model))
    with closing(sqlite3.connect(d.DB)) as db, db:
        db.executescript("CREATE TABLE Customers (Id INTEGER PRIMARY KEY, Name TEXT);"
                         "INSERT INTO Customers VALUES (1, 'FICTIONAL PERSON');"
                         "CREATE TABLE __EFMigrationsHistory (MigrationId TEXT PRIMARY KEY, ProductVersion TEXT);"
                         "INSERT INTO __EFMigrationsHistory VALUES ('001_fixture', 'fixture');")
    write(d.UPLOADS/"fictional.txt", "FICTIONAL UPLOAD\n")
    own_pair(d.DATA, d.UPLOADS)
    for role, subtree in (("backend", "Backend/CarServiceShop"), ("frontend", "Frontend")):
        folder = SOURCE/subtree
        folder.mkdir(parents=True)
        write(folder/"fixture.py", Path(__file__).with_name("fixture.py").read_text(), 0o644)
        write(folder/"Dockerfile", fixture_dockerfile(role, "old"), 0o644)
        real_run("docker", "build", "--network=none", "--pull=false", "-t",
                 f"{d.PROJECT}-{role}:baseline", str(folder), timeout=240)
        content = fixture_dockerfile(role, "new")
        if scenario == "migration-failure" and role == "backend":
            content = content.replace("USER 1654", "RUN touch /migration-fails\nUSER 1654")
        write(folder/"Dockerfile", content, 0o644)
    # Synthetic source objects live only in the container; never commit to the real checkout.
    real_run("git", "init", "-b", "test-deploy", str(SOURCE))
    real_run("git", "-C", str(SOURCE), "add", ".")
    real_run("git", "-C", str(SOURCE), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
             "commit", "-m", "Disposable fictional source")
    sha = real_run("git", "-C", str(SOURCE), "rev-parse", "HEAD")
    real_run("git", "clone", "--bare", str(SOURCE), str(d.REPO))
    real_run("git", "--git-dir", str(d.REPO), "remote", "set-url", "origin",
             "https://github.com/MTZBRN/CarServiceApp.git")
    d.REPO.chmod(0o700)
    write(d.ETC/"actions-read.token", "fictional-token-never-sent")
    write(d.ETC/"approved.json", json.dumps({"branch":"test-deploy", "revision":sha,
          "compose_sha256":d.storage.digest(d.LIVE_COMPOSE),
          "frozen_compose_sha256":d.storage.digest(d.ETC/"docker-compose.test.yml"),
          "env_sha256":d.storage.digest(d.ENV_FILE), "migrations":["001_fixture", "002_fixture"]}))
    try:
        dc("up", "-d", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "45")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        startup_diagnostics()
        raise
    return sha


def own_pair(*roots):
    for root in roots:
        for p in (root, *root.rglob("*")):
            os.chown(p, 1654, 1654)
            p.chmod(0o700 if p.is_dir() else 0o600)


def admission_adapter(sha, calls):
    """Only GitHub boundaries are fixtures; original admission validators still run."""
    def command(*args, **kwargs):
        if args[0] == "gh":
            require(args[:4] == ("gh", "api", "--hostname", "github.com") and
                    f"head_sha={sha}&" in args[4], "unexpected API request")
            calls.append("fixture-ci")
            return json.dumps({"workflow_runs":[{"head_sha":sha, "head_branch":"test-deploy",
                "event":"push", "status":"completed", "conclusion":"success"}]})
        if args[:4] == ("git", "--git-dir", str(d.REPO), "fetch"):
            require(args[4:] == ("--no-tags", "origin", "+refs/heads/test-deploy:refs/remotes/origin/test-deploy"),
                    "unexpected fetch request")
            calls.append("local-fetch")
            return real_run(*args[:5], str(SOURCE), args[6], **kwargs)
        if args[:2] == ("docker", "build"):
            return real_run(*args[:2], "--network=none", "--pull=false", *args[2:], **kwargs)
        return real_run(*args, **kwargs)
    return command


def saved_report(value):
    write(REPORT, json.dumps(value, indent=2) + "\n")


def failure_summary(error):
    if error is None:
        return None
    kinds = {OSError: "os-error", ConnectionRefusedError: "connection-refused",
             PermissionError: "permissions", FileNotFoundError: "missing-file",
             subprocess.CalledProcessError: "command-failed", subprocess.TimeoutExpired: "command-timeout",
             d.Refused: "refused", ValueError: "invalid-value", RuntimeError: "runtime-error"}
    result = {"kind": kinds.get(type(error), "unexpected-error")}
    if isinstance(error, d.Refused):
        tree = ast.parse(Path(d.__file__).read_text())
        allowed = {n.args[1].value for n in ast.walk(tree) if isinstance(n, ast.Call)
                   and isinstance(n.func, ast.Name) and n.func.id == "require" and len(n.args) == 2
                   and isinstance(n.args[1], ast.Constant) and isinstance(n.args[1].value, str)}
        result["invariant"] = str(error) if str(error) in allowed else "unlisted refusal"
    if isinstance(error, subprocess.CalledProcessError):
        result["exit_code"] = error.returncode if type(error.returncode) is int else None
    if isinstance(error, OSError) and type(error.errno) is int:
        result["errno"] = error.errno
    return result


def deployment_evidence(calls, failure):
    """Capture BEFORE assertions, including failures that precede the first journal."""
    journals = [p for p in d.STATE.glob("*.json") if not p.name.endswith(".images.json")]
    try:
        journal = json.loads(journals[0].read_text()) if len(journals) == 1 else None
        if not isinstance(journal, dict):
            journal = None
    except (OSError, ValueError):
        journal = None  # Do not mask the deployment error with corrupt evidence.
    states = {}
    try:
        current = d.containers()
        for name in d.SERVICES:
            status = current[name]["status"]
            states[name] = status if status in ("running", "exited", "created", "restarting", "dead") else "unknown"
    except Exception:
        states = {"inspection": "unavailable"}
    stage = journal.get("stage") if journal else None
    evidence = {"admission_calls": [v if v in ADMISSION else "unknown" for v in calls],
                "failure": failure_summary(failure), "journal_count": len(journals),
                "stage": stage if isinstance(stage, str) and stage in STAGES else "none-or-unknown",
                "in_progress": (d.STATE/"in-progress").exists(), "services": states}
    print(json.dumps({"deployment_evidence": evidence}), flush=True)
    return evidence, journal


def run_case(scenario):
    sha = provision(scenario)
    # Invoke the installed preflight as well as the in-process deployment preflight.
    try:
        real_run("/usr/local/sbin/carservice-test-preflight")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        # Separate -I processes preserve each module's installed/source import context.
        for variant in ("installed", "source"):
            try:
                print(real_run("python3", "-I", str(Path(__file__).with_name("preflight_diagnostics.py")), variant), flush=True)
            except Exception:
                print(json.dumps({"preflight_variant": variant, "status": "diagnostics-unavailable"}), flush=True)
        raise  # Never turn a refused wrapper into an accepted rehearsal.
    original = d.containers()
    # Exercise real ownership refusal before mutation, then restore the fixture.
    d.ENV_FILE.chmod(0o620)
    try:
        d.preflight()
        raise AssertionError("unsafe ownership accepted")
    except d.Refused:
        pass
    finally:
        d.ENV_FILE.chmod(0o600)
    require(d.containers() == original, "negative preflight changed containers")
    with fixture_ingress():
        exercise_deployment(scenario, sha, original)


def exercise_deployment(scenario, sha, original):
    calls = []
    failure = None
    with ExitStack() as stack:
        stack.enter_context(patch.object(d, "run", side_effect=admission_adapter(sha, calls)))
        if scenario == "backup-failure":
            stack.enter_context(patch.object(d.storage, "backup", side_effect=OSError("fictional backup failure")))
        try:
            d.deploy(sha)
        except Exception as error:
            failure = error
    evidence, journal = deployment_evidence(calls, failure)
    # An unexpected error must never be replaced by a later assertion or accepted
    # merely because it happened in a failure scenario.
    saved_report({"scenario": scenario, "deployment_evidence": evidence, "recovery": "unexpected-failure"})
    expected = {"backup-failure": "backing-up", "migration-failure": "starting-backend"}.get(scenario)
    expected_error = ((scenario == "backup-failure" and type(failure) is OSError) or
                      (scenario == "migration-failure" and isinstance(failure, subprocess.CalledProcessError)))
    if failure is not None and (calls != ADMISSION or not journal or
                                journal.get("stage") != expected or not expected_error):
        raise failure
    require(calls == ADMISSION, "admission not repeated")
    require(journal is not None, "one deployment journal required")
    current = d.containers()
    require(all(journal["previous"][n]["image"] == original[n]["image"] for n in d.SERVICES),
            "baseline evidence mismatch")
    if scenario == "success":
        require(failure is None and journal["stage"] == "healthy", "successful deploy required")
        require(not (d.STATE/"in-progress").exists(), "success left marker")
        require(d.migration_state() == ["001_fixture", "002_fixture"], "migration missing")
        require(d.storage.database_info(d.DB)["Customers"] == 1, "fictional row lost")
        require(all(current[n]["image"] == journal["images"][n] for n in d.SERVICES), "wrong image pair")
        d.smoke()
    else:
        expected = "backing-up" if scenario == "backup-failure" else "starting-backend"
        require(failure and journal["stage"] == expected, "wrong failure stage")
        require((d.STATE/"in-progress").read_text().strip() == journal["run"], "missing failure marker")
        require(current["frontend"]["id"] == original["frontend"]["id"] and
                current["frontend"]["status"] == "exited", "frontend started after failure")
        if scenario == "backup-failure":
            require(current["backend"]["id"] == original["backend"]["id"] and
                    current["backend"]["status"] == "exited" and "backup" not in journal,
                    "backend started without backup")
        else:
            require(current["backend"]["image"] == journal["images"]["backend"], "new backend not attempted")
            require(current["backend"]["status"] == "exited", "failed migration still running")
            require(d.migration_state() == ["001_fixture"], "failed migration recorded as applied")
            # Verify exit code without emitting application logs.
            require(real_run("docker", "inspect", "-f", "{{.State.ExitCode}}", current["backend"]["id"]) == "1",
                    "migration fixture did not fail")
        try:
            d.preflight()
            raise AssertionError("unfinished run was admitted")
        except d.Refused as error:
            require(str(error) == "unfinished deployment requires local operator", "wrong retry refusal")
    saved_report({"scenario":scenario, "preflight":"passed", "negative_preflight":"refused",
                  "admission":"local fixtures; no GitHub verification", "journal":journal,
                  "versions":{"python":sys.version.split()[0],
                              "docker":real_run("docker", "version", "--format", "{{.Server.Version}}"),
                              "compose":real_run("docker", "compose", "version", "--short"),
                              "fixture_base_id":real_run("docker", "image", "inspect", "-f", "{{.Id}}", BASE_IMAGE)},
                  "deployment_evidence": evidence,
                  "failure":failure_summary(failure), "recovery":"not-needed" if scenario == "success" else "pending-operator"})


def wait_healthy(cid):
    for _ in range(45):
        if real_run("docker", "inspect", "-f", "{{.State.Health.Status}}", cid) == "healthy":
            return
        time.sleep(1)
    raise RuntimeError("recovery health timeout")


def recover():
    """Explicit fixture operator action; never invoked automatically by deployment."""
    boundary()
    with fixture_ingress():
        recover_fixture()


def recover_fixture():
    report = json.loads(REPORT.read_text())
    require(report["recovery"] == "pending-operator", "no pending fixture recovery")
    require(report["scenario"] in ("backup-failure", "migration-failure"), "unexpected recovery scenario")
    journal = report["journal"]
    require((d.STATE/"in-progress").read_text().strip() == journal["run"], "journal mismatch")
    import fcntl
    with (d.STATE/"deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        current = d.containers()
        for name in d.SERVICES:
            tag = journal["previous"][name]["rollback_tag"]
            require(real_run("docker", "image", "inspect", "-f", "{{.Id}}", tag) ==
                    journal["previous"][name]["image"], "rollback tag drift")
        if report["scenario"] == "backup-failure":
            require(d.migration_state() == ["001_fixture"], "old schema required")
            for name in d.SERVICES:
                require(current[name]["id"] == journal["previous"][name]["id"], "old container changed")
                real_run("docker", "start", current[name]["id"])
                wait_healthy(current[name]["id"])
            restored_db, restored_uploads = d.DB, d.UPLOADS
        else:
            for name in ("frontend", "backend"):
                real_run("docker", "stop", current[name]["id"])
            backup = Path(journal["backup"])
            require(backup.parent == d.BACKUPS and not backup.is_symlink(), "backup outside fixture")
            pair = d.storage.restore_test(backup, Path("/var/tmp/carserviceapp-restore-test-recovery"))
            own_pair(pair/"data", pair/"uploads")
            restored_db, restored_uploads = pair/"data/app.db", pair/"uploads"
            config = json.loads(dc("config", "--format", "json"))
            for name in d.SERVICES:
                config["services"][name]["image"] = journal["previous"][name]["rollback_tag"]
            for mount in config["services"]["backend"]["volumes"]:
                mount["source"] = str(pair/Path(mount["target"]).name)
            recovery_file = d.ETC/"recovery.json"
            write(recovery_file, json.dumps(config))
            for name in d.SERVICES:
                dc("up", "-d", "--no-build", "--pull", "never", "--no-deps", "--wait",
                   "--wait-timeout", "45", name, file=recovery_file)
            require(d.DB.exists() and d.UPLOADS.exists(), "failed pair was overwritten")
        with closing(sqlite3.connect(restored_db)) as db:
            require(db.execute("SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId").fetchall()
                    == [("001_fixture",)], "restored history mismatch")
        require(d.storage.database_info(restored_db)["Customers"] == 1, "restored fictional row missing")
        require((restored_uploads/"fictional.txt").read_text() == "FICTIONAL UPLOAD\n", "restored upload mismatch")
        for name in d.SERVICES:
            cid = dc("ps", "-q", name, file=(d.ETC/"recovery.json") if report["scenario"] == "migration-failure" else None)
            require(real_run("docker", "inspect", "-f", "{{.Image}}", cid) ==
                    journal["previous"][name]["image"], "wrong recovered image")
            wait_healthy(cid)
        d.smoke()
        (d.STATE/"in-progress").unlink()
        try:
            if report["scenario"] == "migration-failure":
                try:
                    d.preflight()
                    raise AssertionError("temporary recovery binds unexpectedly admitted")
                except d.Refused as error:
                    require(str(error) == "live TEST mount mismatch", "wrong recovery-bind refusal")
            else:
                d.preflight()
        except Exception:
            write(d.STATE/"in-progress", journal["run"] + "\n")
            raise
        report["recovery"] = "operator-approved; original image pair and fictional DB/uploads verified"
        saved_report(report)


def main(args):
    if args == ["diagnose"]:
        # Works even if daemon readiness failed. Never read any caller-selected path.
        require(sys.platform == "linux" and Path("/.dockerenv").is_file() and
                Path("/run/phase6e-container").read_text() == "phase6e-disposable\n",
                "disposable diagnostics only")
        startup_diagnostics()
    elif len(args) == 2 and args[0] == "run" and args[1] in SCENARIOS:
        run_case(args[1])
    elif args == ["recover", "--approve-fixture-recovery"]:
        recover()
    elif args == ["verify"]:
        boundary()
        report = json.loads(REPORT.read_text())
        expected = ("not-needed" if report["scenario"] == "success" else
                    "operator-approved; original image pair and fictional DB/uploads verified")
        require(report["scenario"] in SCENARIOS and report["recovery"] == expected,
                "operator fixture recovery was not approved/executed")
        require(not (d.STATE/"in-progress").exists(), "unfinished fixture run")
        print("PASS: " + report["scenario"])
    else:
        raise SystemExit("run {success,backup-failure,migration-failure} OR recover --approve-fixture-recovery")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception as error:
        print(json.dumps({"rehearsal_failure": failure_summary(error)}), flush=True)
        sys.exit(1)
