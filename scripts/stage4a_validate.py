"""Future LOCAL Linux/rootful-Docker synthetic validation. Never targets a remote engine or production paths."""
import argparse
import base64
from contextlib import closing
import ipaddress
import json
import os
from pathlib import Path
import secrets
import socket
import struct
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zlib

from ops_storage import backup, readonly, restore_test, safe_path


def require_local_engine(endpoint):
    if not endpoint.startswith("unix:///") or "\n" in endpoint:
        raise ValueError("Remote/SSH/TCP Docker engines are forbidden")


def local_docker_command(endpoint):
    require_local_engine(endpoint)
    # Pin the checked socket: inherited DOCKER_CONTEXT must never redirect operations.
    return ["docker", "--host", endpoint]


def validate_config(config, root, port):
    root = safe_path(root)
    if os.name == "posix" and (not root.is_relative_to(Path("/tmp")) or not root.name.startswith("carserviceapp-stage4a-")):
        raise ValueError("Staging root must be newly created under /tmp")
    if set(config["services"]) != {"backend", "frontend"} or config.get("volumes"):
        raise ValueError("Unexpected service/named volume: review staging design")
    backend, frontend = config["services"]["backend"], config["services"]["frontend"]
    if set(config.get("networks", {})) != {"workshop"} or any(set(service.get("networks", {})) != {"workshop"} for service in (backend, frontend)):
        raise ValueError("Unexpected shared network: review staging isolation")
    if backend.get("ports") or any(s.get("container_name") or s.get("network_mode") or s.get("privileged") for s in (backend, frontend)):
        raise ValueError("Host exposure/fixed container identity is forbidden")
    expected = {"/app/data": root / "data", "/app/uploads": root / "uploads"}
    mounts = backend.get("volumes", [])
    if len(mounts) != 2 or frontend.get("volumes"):
        raise ValueError("Unexpected mount")
    for mount in mounts:
        if mount.get("type") != "bind" or mount["target"] not in expected or safe_path(mount["source"]) != expected[mount["target"]]:
            raise ValueError("Refusing any non-disposable or production storage path")
    ports = frontend.get("ports", [])
    if len(ports) != 1 or ports[0].get("host_ip") != "127.0.0.1" or str(ports[0].get("published")) != str(port) or ports[0].get("target") != 8080:
        raise ValueError("Only the chosen loopback staging port is allowed")
    for service in (backend, frontend):
        if service.get("cap_add") or not service.get("read_only") or "ALL" not in service.get("cap_drop", []) or "no-new-privileges:true" not in service.get("security_opt", []):
            raise ValueError("Stage 3C hardening must remain enabled")
    environment = backend["environment"]
    if environment.get("ASPNETCORE_ENVIRONMENT") != "Production" or environment.get("ConnectionStrings__DefaultConnection") != "Data Source=/app/data/app.db" or environment.get("Uploads__Path") != "/app/uploads":
        raise ValueError("Unexpected application environment or data mapping")
    allowed = {"ASPNETCORE_ENVIRONMENT", "ConnectionStrings__DefaultConnection", "Uploads__Path", "Jwt__Key", "Jwt__Issuer", "Jwt__Audience", "ReverseProxy__KnownProxies__0"}
    if environment.keys() - allowed or frontend.get("environment") or config.get("secrets") or config.get("configs"):
        raise ValueError("Unexpected credential/configuration source requires review")
    return root


def choose_subnet(existing):
    occupied = [ipaddress.ip_network(cidr) for cidr in existing]
    for part in range(10, 250):
        candidate = ipaddress.ip_network(f"172.29.{part}.0/24")
        if not any(candidate.overlaps(old) for old in occupied if old.version == 4):
            return candidate
    raise ValueError("No free staging subnet; do not alter existing networks")


def png():
    def chunk(kind, data):
        return struct.pack("!I", len(data)) + kind + data + struct.pack("!I", zlib.crc32(kind + data))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack("!IIBBBBB", 1, 1, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00\xff")) + chunk(b"IEND", b"")


def run(port):
    if sys.platform != "linux" or not hasattr(os, "geteuid") or os.geteuid() != 0:
        raise ValueError("Run reviewed script as root on an isolated Linux host with local rootful Docker")
    if not 1024 <= port <= 65535:
        raise ValueError("Use an unprivileged loopback port")
    # Check the endpoint BEFORE any Docker info/build/network operation.
    endpoint = os.environ.get("DOCKER_HOST")
    if not endpoint:
        context = subprocess.run(["docker", "context", "inspect", "--format", '{{(index .Endpoints "docker").Host}}'], capture_output=True, text=True, check=True)
        endpoint = context.stdout.strip()
    docker = local_docker_command(endpoint)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", port))
    root = Path(tempfile.mkdtemp(prefix="carserviceapp-stage4a-", dir="/tmp")).resolve()
    os.chmod(root, 0o700)
    project = root.name.lower()
    for name in ("data", "uploads"):
        (root / name).mkdir(mode=0o700)
        os.chown(root / name, 1654, 1654)
    key, password = base64.b64encode(secrets.token_bytes(64)).decode(), secrets.token_urlsafe(24)
    issuer, audience = "urn:carserviceapp:stage4a:issuer", "urn:carserviceapp:stage4a:client"
    env = dict(os.environ)
    env.pop("DOCKER_CONTEXT", None)
    for name in ("JWT_KEY", "JWT_ISSUER", "JWT_AUDIENCE", "DATA_PATH", "UPLOADS_PATH", "FRONTEND_BIND_PORT", "APP_IMAGE_TAG", "COMPOSE_FILE", "COMPOSE_PROJECT_NAME", "COMPOSE_PROFILES", "InitialAdmin__Email", "InitialAdmin__Password"):
        env.pop(name, None)
    env.update({"InitialAdmin__Email": "stage4a-admin", "InitialAdmin__Password": password})
    env_file = root / ".env.synthetic"
    env_file.write_text(f"COMPOSE_PROJECT_NAME={project}\nAPP_IMAGE_TAG={project}\nDATA_PATH={root / 'data'}\nUPLOADS_PATH={root / 'uploads'}\nFRONTEND_BIND_PORT={port}\nJWT_KEY={key}\nJWT_ISSUER={issuer}\nJWT_AUDIENCE={audience}\n", encoding="ascii")
    repo = Path(__file__).resolve().parents[1]
    compose_file = root / "compose.synthetic.json"

    def command(args):
        result = subprocess.run(args, cwd=repo, env=env, capture_output=True, text=True)
        with (root / "private-command.log").open("a", encoding="utf-8") as log:
            log.write(result.stdout + result.stderr)
        if result.returncode:
            raise RuntimeError("Command failed; inspect the protected staging log")
        return result.stdout

    initial = docker + ["compose", "--project-directory", str(repo), "--env-file", str(env_file), "-p", project, "-f", str(repo / "docker-compose.yml")]
    config = json.loads(command(initial + ["config", "--format", "json"]))
    validate_config(config, root, port)
    if any(config["services"]["backend"]["environment"].get(name) != value for name, value in (("Jwt__Key", key), ("Jwt__Issuer", issuer), ("Jwt__Audience", audience))):
        raise ValueError("Only the generated synthetic signing/scope values are allowed")
    networks = command(docker + ["network", "ls", "--quiet"]).split()
    details = json.loads(command(docker + ["network", "inspect", *networks])) if networks else []
    subnets = [item["Subnet"] for net in details for item in net.get("IPAM", {}).get("Config", []) if item.get("Subnet")]
    routes = json.loads(command(["ip", "-j", "-4", "route", "show"]))
    subnets.extend(route["dst"] for route in routes if route.get("dst") and route["dst"] != "default")
    subnet = choose_subnet(subnets)
    config["name"] = project
    config["networks"]["workshop"] = {"name": project + "_workshop", "ipam": {"config": [{"subnet": str(subnet)}]}}
    for service, offset in (("backend", 2), ("frontend", 3)):
        config["services"][service]["networks"]["workshop"]["ipv4_address"] = str(subnet.network_address + offset)
    config["services"]["backend"]["environment"]["ReverseProxy__KnownProxies__0"] = str(subnet.network_address + 3)
    compose_file.write_text(json.dumps(config, indent=2), encoding="utf-8")
    compose = docker + ["compose", "--project-directory", str(repo), "-p", project, "-f", str(compose_file)]
    print("Synthetic local validation root: " + str(root))

    def api(path, data=None, token=None, method=None, body=None, content_type="application/json"):
        headers = {"Content-Type": content_type}
        if token:
            headers["Authorization"] = "Bearer " + token
        payload = json.dumps(data).encode() if data is not None else body
        request = urllib.request.Request(f"http://127.0.0.1:{port}" + path, data=payload, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read(2 * 1024 * 1024)
                return response.status, response.headers, json.loads(raw) if raw and "json" in response.headers.get("Content-Type", "") else raw
        except urllib.error.HTTPError as error:
            return error.code, error.headers, None

    def success(path, data=None, token=None, method=None, **kwargs):
        status, headers, response = api(path, data, token, method, **kwargs)
        if not 200 <= status < 300:
            raise RuntimeError("Synthetic HTTP smoke operation failed")
        return headers, response

    started = False
    try:
        command(compose + ["config", "--quiet"])
        command(compose + ["build", "--pull"])
        started = True
        command(compose + ["up", "-d", "--wait", "--wait-timeout", "180", "backend"])
        with closing(readonly(root / "data/app.db")) as db:
            if db.execute("SELECT count(*) FROM Users").fetchone()[0] != 0 or not db.execute("SELECT count(*) FROM __EFMigrationsHistory").fetchone()[0]:
                raise ValueError("Migration/default-account check failed")
        command(compose + ["stop", "backend"])
        command(compose + ["run", "--rm", "--no-deps", "-e", "InitialAdmin__Email", "-e", "InitialAdmin__Password", "backend", "--provision-admin"])
        command(compose + ["up", "-d", "--wait", "--wait-timeout", "180"])
        command(compose + ["exec", "-T", "frontend", "nginx", "-t"])
        for service, uid, memory, cpus, pids in (("backend", "1654", 1073741824, 1000000000, 256), ("frontend", "101", 134217728, 500000000, 64)):
            container = command(compose + ["ps", "--quiet", service]).strip()
            info = json.loads(command(docker + ["inspect", container]))[0]
            host = info["HostConfig"]
            if host["RestartPolicy"]["Name"] != "unless-stopped":
                raise ValueError("Expected process-restart policy missing")
            if not host["ReadonlyRootfs"] or host["Privileged"] or host.get("CapAdd") or "ALL" not in host["CapDrop"] or not any(item.startswith("no-new-privileges") for item in host["SecurityOpt"]):
                raise ValueError("Effective container hardening failed")
            if host["Memory"] != memory or host["NanoCpus"] != cpus or host["PidsLimit"] != pids or info["State"]["Health"]["Status"] != "healthy":
                raise ValueError("Effective resource/health check failed")
            if set(host["Tmpfs"]) != {"/tmp"} or not all(flag in host["Tmpfs"].get("/tmp", "") for flag in ("noexec", "nosuid", "nodev")):
                raise ValueError("tmpfs hardening failed")
            expected_binds = {"/app/data": str(root / "data"), "/app/uploads": str(root / "uploads")} if service == "backend" else {}
            actual_binds = {mount["Destination"]: mount["Source"] for mount in info["Mounts"] if mount["Type"] == "bind" and mount["RW"]}
            if actual_binds != expected_binds or any(mount["Destination"] not in {*expected_binds, "/tmp"} for mount in info["Mounts"]):
                raise ValueError("Effective writable mounts differ from disposable configuration")
            bindings = host.get("PortBindings") or {}
            if service == "backend" and bindings:
                raise ValueError("Backend published a host port")
            if service == "frontend" and bindings != {"8080/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(port)}]}:
                raise ValueError("Frontend is not loopback-only")
            if command(compose + ["exec", "-T", service, "id", "-u"]).strip() != uid or command(compose + ["exec", "-T", service, "id", "-g"]).strip() != uid:
                raise ValueError("Effective UID/GID failed")
            process_status = command(compose + ["exec", "-T", service, "cat", "/proc/self/status"])
            status_fields = dict(line.split(":", 1) for line in process_status.splitlines() if ":" in line)
            if int(status_fields["CapEff"].strip(), 16) != 0 or status_fields["NoNewPrivs"].strip() != "1":
                raise ValueError("Effective process capability/privilege checks failed")
            writable = ["/tmp"] + (["/app/data", "/app/uploads"] if service == "backend" else [])
            for directory in writable:
                command(compose + ["exec", "-T", service, "sh", "-c", f"set -eu; set -C; umask 077; : > {directory}/.stage4a-probe; rm -- {directory}/.stage4a-probe"])
            protected = "/app/.stage4a-deny" if service == "backend" else "/etc/nginx/.stage4a-deny"
            command(compose + ["exec", "-T", service, "sh", "-c", f"if (: > {protected}) 2>/dev/null; then exit 1; fi"])
        if api("/api/Auth/me")[0] != 401 or api("/api/Seed", {}, method="POST")[0] != 404:
            raise ValueError("Production API isolation failed")
        _, signed = success("/api/Auth/login", {"email": "stage4a-admin", "password": password})
        token = signed["token"]
        _, customer = success("/api/Customers", {"name": "Synthetic Stage4A", "phoneNumber": "000"}, token)
        _, vehicle = success("/api/Vehicle", {"customerId": customer["id"], "licensePlate": "SYNTHETIC-STAGE4A", "make": "Ford", "model": "Focus", "year": 2020}, token)
        _, job = success("/api/ServiceJobs", {"vehicleId": vehicle["id"], "description": "Synthetic work", "laborCost": 100, "jobParts": []}, token)
        _, job = success("/api/ServiceJobs/" + str(job["id"]), {"version": job["version"], "description": "Synthetic edited", "laborCost": 200, "jobParts": []}, token, "PUT")
        boundary = "stage4a-boundary"
        upload_body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.png"\r\nContent-Type: image/png\r\n\r\n').encode() + png() + (f"\r\n--{boundary}--\r\n").encode()
        _, uploaded = success("/api/Auth/upload-profile-picture", token=token, method="POST", body=upload_body, content_type="multipart/form-data; boundary=" + boundary)
        headers, image = success(uploaded["filePath"])
        if not image.startswith(b"\x89PNG") or "sandbox" not in headers.get("Content-Security-Policy", ""):
            raise ValueError("Normalized upload serving failed")
        _, events = success("/api/Audit?action=Worksheet.Updated&resourceId=" + str(job["id"]), token=token)
        if not events:
            raise ValueError("Business audit check failed")
        command(compose + ["restart"])
        command(compose + ["up", "-d", "--wait", "--wait-timeout", "180"])
        _, persisted = success("/api/ServiceJobs/" + str(job["id"]), token=token)
        if persisted["description"] != "Synthetic edited":
            raise ValueError("Restart database persistence failed")
        success(uploaded["filePath"])
        command(compose + ["stop"])
        saved = backup(root / "data/app.db", root / "uploads", root / "backups", True)
        restored = restore_test(saved, root / "carserviceapp-restore-test-snapshot")
        (root / "VALIDATION_PASSED.json").write_text(json.dumps({"project": project, "loopbackPort": port, "subnet": str(subnet), "checks": ["compose", "builds", "nginx-t", "uid-gid", "hardening", "resources", "health", "migrations", "login", "upload", "worksheet", "audit", "restart-persistence", "synthetic-backup-restore"], "restore": restored.name}, indent=2) + "\n")
        print("PASS: local synthetic container checks. TLS, firewall, offsite recovery and real production controls are NOT validated.")
    finally:
        if started:
            command(compose + ["down", "--remove-orphans"])
        print("Protected synthetic artifacts retained for review: " + str(root))


def main():
    if sys.version_info < (3, 12):
        raise SystemExit("Python 3.12+ is required")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=15173)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        run(args.port)
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError, urllib.error.URLError, KeyError) as error:
        print("Validation stopped (" + type(error).__name__ + "). No production path/remote engine is authorized by this tool.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
