"""Exercise the shipped Nginx log configuration with synthetic loopback requests."""

import argparse
import http.client
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
import time


FRONTEND = Path(__file__).resolve().parents[2] / "Frontend"
MARKER = "fictional-log-probe"


class Upstream(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/ServiceJobs"):
            # Close without a response to exercise Nginx's upstream error handler.
            return
        self.send_response(503 if self.path.startswith("/api/Users") else 200)
        self.send_header("X-Test-Request-ID", self.headers["X-Request-ID"])
        self.end_headers()

    def do_POST(self):
        if self.path.startswith("/api/Vehicle"):
            return
        self.rfile.read(int(self.headers["Content-Length"]))
        self.send_response(403)
        self.end_headers()

    def log_message(self, *args):
        pass


def check(nginx, root, upstream_port):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    for folder in ("logs", "temp"):
        (root / folder).mkdir()
    (root / "50x.html").write_text("upstream error")
    (root / "trusted-edge.conf").touch()
    for name in ("security-headers.conf", "proxy-headers.conf"):
        (root / name).write_bytes((FRONTEND / name).read_bytes())
    site = (FRONTEND / "nginx.conf").read_text().replace("/etc/nginx/", "")
    site = site.replace("listen 8080;", f"listen 127.0.0.1:{port};")
    site = site.replace("backend:8080", f"127.0.0.1:{upstream_port}")
    (root / "site.conf").write_text(site.replace("/usr/share/nginx/html", f'"{root.as_posix()}"'))
    config = (FRONTEND / "nginx-main.conf").read_text()
    config = config.replace("/dev/stdout", "logs/access.log").replace("/dev/stderr", "logs/error.log")
    config = config.replace("/dev/null", os.devnull).replace("/tmp/", "temp/")
    config = config.replace("include /etc/nginx/mime.types;", "").replace("/etc/nginx/conf.d/*.conf", "site.conf")
    (root / "nginx.conf").write_text("daemon off; master_process off;\n" + config)
    command = [nginx, "-p", root.as_posix() + "/", "-c", "nginx.conf"]
    subprocess.run(command + ["-t"], cwd=root, check=True)
    with (root / "logs/stderr").open("wb") as stderr:
        process = subprocess.Popen(command, cwd=root, stderr=stderr)
        try:
            deadline = time.monotonic() + 10
            while True:
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                        break
                except OSError:
                    if process.poll() is not None or time.monotonic() >= deadline:
                        raise RuntimeError("Nginx failed to start")
                    time.sleep(0.05)
            headers = {"Referer": f"https://example.invalid/?q={MARKER}-ref",
                       "Authorization": f"Bearer {MARKER}-token", "Cookie": f"id={MARKER}-cookie",
                       "X-Request-ID": MARKER + "-forged"}
            cases = [
                ("GET", "/api/%43ustomers", 200, "/api/Customers"),
                ("POST", "/api/Parts", 403, "/api/Parts"),
                ("GET", "/api/ServiceJobs", 502, "/api/ServiceJobs"),
                ("POST", "/api/Vehicle", 502, "/api/Vehicle"),
                ("GET", "/api/Users", 503, "/api/Users"),
                ("GET", "/api/Customers/123", 200, "/api/Customers/:id"),
                ("GET", "/api/Customers/" + MARKER + "%40example.invalid", 200, "/[redacted]"),
                ("GET", "/uploads/" + MARKER + "-ABC123.png", 200, "/uploads/[redacted]"),
                ("POST", "/api/Auth/upload-profile-picture", 413, "/api/Auth/upload-profile-picture"),
            ]
            upstream_id = None
            for method, target, status, _ in cases:
                body = None if method == "GET" else (MARKER + "-body").encode()
                if status == 413:
                    # Nginx rejects on Content-Length before reading the oversized body.
                    headers["Content-Length"] = "3000000"
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
                try:
                    conn.request(method, target + "?q=" + MARKER + "%40example.invalid&phone=" + MARKER + "-361234567&name=" + MARKER + "&plate=" + MARKER, body, headers)
                    response = conn.getresponse()
                    assert response.status == status
                    if upstream_id is None and status == 200:
                        upstream_id = response.getheader("X-Test-Request-ID")
                    response.read()
                finally:
                    conn.close()
        finally:
            process.terminate()
            process.wait(timeout=10)
    for log in (root / "logs").iterdir():
        assert MARKER.encode() not in log.read_bytes(), f"Fictional marker leaked to {log.name}"
    rows = [json.loads(line) for line in (root / "logs/access.log").read_text().splitlines()]
    assert [(r["method"], r["path"], r["status"]) for r in rows] == [
        (method, path, status) for method, _, status, path in cases]
    for row in rows:
        assert set(row) == {"method", "path", "status", "duration", "request_id"}
        assert row["duration"] >= 0 and re.fullmatch("[0-9a-f]{32}", row["request_id"])
    assert len({row["request_id"] for row in rows}) == len(rows)
    assert rows[0]["request_id"] == upstream_id


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nginx", default="nginx")
    with HTTPServer(("127.0.0.1", 0), Upstream) as server, tempfile.TemporaryDirectory() as tmp:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            check(parser.parse_args().nginx, Path(tmp), server.server_port)
        finally:
            server.shutdown()
    print("PASS: 9 request cases, original GET/POST routes, redacted path data and marker-free logs.")
