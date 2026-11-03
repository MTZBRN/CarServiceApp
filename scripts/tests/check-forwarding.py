"""Exercise the real Caddy, Nginx and ASP.NET chain on disposable loopback ports."""

import argparse
import base64
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import ssl
import subprocess
import tempfile
import time
from contextlib import ExitStack


REPO = Path(__file__).resolve().parents[2]
HOST = "workshop.example.invalid"
EDGE = "127.0.0.1"
CLIENT_A = "127.0.0.2"
CLIENT_B = "127.0.0.3"


def request(port, path, *, source=EDGE, tls=None, headers=None, payload=None):
    options = {"source_address": (source, 0), "timeout": 5}
    connection = (
        http.client.HTTPSConnection(EDGE, port, context=tls, **options)
        if tls
        else http.client.HTTPConnection(EDGE, port, **options)
    )
    try:
        connection.request(
            "POST" if payload is not None else "GET",
            path,
            body=json.dumps(payload) if payload is not None else None,
            headers={"Host": HOST, "Content-Type": "application/json", **(headers or {})},
        )
        response = connection.getresponse()
        return response.status, response.headers, response.read()
    finally:
        connection.close()


def stop(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def start(stack, root, name, command, port, env):
    log_path = root / (name + ".log")
    with log_path.open("wb") as log:
        process = subprocess.Popen(
            command, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    stack.callback(stop, process)
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(name + " failed to start\n" + log_path.read_text(errors="replace"))
        try:
            with socket.create_connection((EDGE, port), timeout=0.25):
                return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError(name + " startup timed out")


def run(args):
    project = REPO / "Backend/CarServiceShop/CarServiceShop"
    backend = project / "bin/Debug/net10.0/CarServiceShop.dll"
    dist = REPO / "Frontend/dist"
    if not backend.is_file() or not (dist / "index.html").is_file():
        raise RuntimeError("Build the backend and frontend before running this check.")

    with ExitStack() as ports:
        listeners = [ports.enter_context(socket.socket()) for _ in range(3)]
        for listener in listeners:
            listener.bind((EDGE, 0))
        backend_port, nginx_port, caddy_port = [s.getsockname()[1] for s in listeners]

    with tempfile.TemporaryDirectory(prefix="carserviceapp-rel001-") as temporary, ExitStack() as processes:
        root = Path(temporary)
        (root / "logs").mkdir()
        (root / "temp").mkdir()
        token = secrets.token_hex(32)
        login = {"email": "rel001-admin", "password": secrets.token_urlsafe(24)}
        env = {
            **{name: value for name, value in os.environ.items()
               if name.upper() in {"PATH", "SYSTEMROOT", "WINDIR", "SYSTEMDRIVE", "DOTNET_ROOT", "PROGRAMFILES"}},
            "HOME": str(root),
            "USERPROFILE": str(root),
            "APPDATA": str(root),
            "LOCALAPPDATA": str(root),
            "TEMP": str(root / "temp"),
            "TMP": str(root / "temp"),
            "ASPNETCORE_ENVIRONMENT": "Production",
            "DOTNET_ENVIRONMENT": "Production",
            "ASPNETCORE_URLS": f"http://{EDGE}:{backend_port}",
            "ASPNETCORE_FORWARDEDHEADERS_ENABLED": "false",
            "ConnectionStrings__DefaultConnection": f"Data Source={root / 'test.db'}",
            "Uploads__Path": str(root / "uploads"),
            "Jwt__Key": base64.b64encode(secrets.token_bytes(64)).decode(),
            "Jwt__Issuer": "urn:carserviceapp:rel001-test",
            "Jwt__Audience": "urn:carserviceapp:rel001-test-client",
            "ReverseProxy__KnownProxies__0": EDGE,
            "Login__SourcePermitLimit": "1",
            "InitialAdmin__Email": login["email"],
            "InitialAdmin__Password": login["password"],
            "Logging__LogLevel__Default": "Warning",
        }
        command = [args.dotnet, str(backend), "--contentRoot", str(project)]
        subprocess.run(command + ["--provision-admin"], env=env, cwd=root, check=True, timeout=30)
        start(processes, root, "backend", command, backend_port, env)

        for name in ("proxy-headers.conf", "security-headers.conf"):
            (root / name).write_bytes((REPO / "Frontend" / name).read_bytes())
        (root / "trusted-edge.conf").write_text(f'"{EDGE}:{token}" 1;\n', encoding="ascii")
        site = (REPO / "Frontend/nginx.conf").read_text(encoding="utf-8")
        site = (
            site.replace("/etc/nginx/", "")
            .replace("listen 8080;", f"listen {EDGE}:{nginx_port};")
            .replace("http://backend:8080", f"http://{EDGE}:{backend_port}")
            .replace("/usr/share/nginx/html", f'"{dist.as_posix()}"')
        )
        (root / "nginx.conf").write_text(
            "master_process off; daemon off; error_log logs/error.log;\n"
            "events { worker_connections 128; }\nhttp { access_log off;\n" + site + "\n}\n",
            encoding="utf-8",
        )
        nginx = [args.nginx, "-p", root.as_posix() + "/", "-c", "nginx.conf"]
        subprocess.run(nginx + ["-t"], cwd=root, check=True, timeout=15)
        start(processes, root, "nginx", nginx, nginx_port, env)

        subprocess.run([
            args.openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
            "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
            "-keyout", "fixture.key", "-out", "fixture.crt",
        ], cwd=root, check=True, capture_output=True, timeout=30)
        site = (REPO / "ingress/Caddyfile.example").read_text(encoding="utf-8")
        (root / "edge-header.conf").write_text(f"header_up X-CarService-Edge-Token {token}\n", encoding="ascii")
        site = site.replace("/etc/caddy/carservice-edge-header.conf", "edge-header.conf")
        site = site.replace("admin off", "admin off\n    auto_https disable_redirects")
        site = site.replace(HOST + " {", f"https://:{caddy_port} {{\n    bind {EDGE}\n    tls fixture.crt fixture.key")
        site = site.replace(EDGE + ":5173", f"{EDGE}:{nginx_port}")
        (root / "Caddyfile").write_text(site, encoding="utf-8")
        caddy = [args.caddy, "run", "--config", "Caddyfile", "--adapter", "caddyfile"]
        start(processes, root, "caddy", caddy, caddy_port, env)
        tls = ssl.create_default_context(cafile=str(root / "fixture.crt"))

        spoof = {
            "X-Forwarded-For": "203.0.113.77",
            "X-Forwarded-Proto": "https",
            "X-CarService-Edge-Client": "203.0.113.78",
            "X-CarService-Edge-Scheme": "http",
            "X-CarService-Edge-Token": "forged",
            "Forwarded": "for=203.0.113.79;proto=https",
        }
        valid = {
            "X-CarService-Edge-Token": token,
            "X-CarService-Edge-Scheme": "https",
            "X-CarService-Edge-Client": "2001:db8::12",
        }
        for source, headers in (
            (EDGE, spoof),
            (EDGE, {name: value for name, value in spoof.items() if name != "X-CarService-Edge-Token"}),
            (CLIENT_A, valid),
            (EDGE, {**valid, "X-CarService-Edge-Scheme": "http"}),
            (EDGE, {**valid, "X-CarService-Edge-Client": "203.0.113.1, 203.0.113.2"}),
            (EDGE, {**valid, "X-CarService-Edge-Client": "dead"}),
        ):
            status, response, _ = request(nginx_port, "/api/Auth/me", source=source, headers=headers)
            assert status == 401 and response.get("Strict-Transport-Security") is None
        status, response, _ = request(nginx_port, "/api/Auth/me", headers=valid)
        assert status == 401 and response.get_all("Strict-Transport-Security") == ["max-age=15552000"]

        status, response, _ = request(backend_port, "/api/Auth/me", source=CLIENT_A, headers=spoof)
        assert status == 401 and response.get("Strict-Transport-Security") is None
        status, response, _ = request(caddy_port, "/", source=CLIENT_A, tls=tls, headers=spoof)
        assert status == 200 and response.get_all("Strict-Transport-Security") == ["max-age=15552000"]
        assert "frame-ancestors 'none'" in response["Content-Security-Policy"]

        status, response, payload = request(caddy_port, "/api/Auth/login", source=CLIENT_A, tls=tls, headers=spoof, payload=login)
        assert status == 200 and response.get_all("Strict-Transport-Security") == ["max-age=15552000"]
        bearer = "Bearer " + json.loads(payload)["token"]
        second_spoof = {**spoof, "X-Forwarded-For": "203.0.113.88", "X-CarService-Edge-Client": "203.0.113.89"}
        status, _, _ = request(caddy_port, "/api/Auth/login", source=CLIENT_A, tls=tls, headers=second_spoof, payload=login)
        assert status == 429, "Changing spoofed addresses must not change the login partition"
        status, _, _ = request(caddy_port, "/api/Auth/login", source=CLIENT_B, tls=tls, headers=spoof, payload=login)
        assert status == 200, "A second socket IP must have an independent login partition"
        status, response, _ = request(caddy_port, "/api/Auth/me", source=CLIENT_A, tls=tls, headers={"Authorization": bearer})
        assert status == 200 and response.get_all("Strict-Transport-Security") == ["max-age=15552000"]
        print("PASS: verified TLS and IPv6 pair, untrusted/forged/invalid pairs, direct API auth, same-origin SPA/API, HSTS/CSP and separate login partitions.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for tool in ("dotnet", "nginx", "caddy", "openssl"):
        parser.add_argument("--" + tool, default=tool)
    run(parser.parse_args())
