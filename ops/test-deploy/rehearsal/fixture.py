"""Fictional application contract, not CarServiceShop or an EF implementation."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from contextlib import closing
from pathlib import Path
import sqlite3
import sys
import urllib.request

if len(sys.argv) > 1 and sys.argv[1] == "health":
    urllib.request.urlopen("http://127.0.0.1:8080/", timeout=2).close()
    raise SystemExit(0)

role = Path("/role").read_text().strip()
if role == "backend" and Path("/generation").read_text().strip() == "new":
    # Real SQLite transaction and a deterministic SQL migration failure variant.
    with closing(sqlite3.connect("/app/data/app.db")) as db, db:
        if not db.execute("SELECT 1 FROM __EFMigrationsHistory WHERE MigrationId='002_fixture'").fetchone():
            db.execute("CREATE TABLE FixtureExtension (Id INTEGER PRIMARY KEY)")
            if Path("/migration-fails").exists():
                db.execute("INSERT INTO MissingFixtureTable VALUES (1)")
            db.execute("INSERT INTO __EFMigrationsHistory VALUES ('002_fixture', 'fixture')")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if role == "frontend" and self.path.startswith("/api/"):
            try:
                urllib.request.urlopen("http://backend:8080" + self.path, timeout=2)
                status = 200
            except urllib.error.HTTPError as error:
                status = error.code
        else:
            status = 401 if self.path == "/api/Auth/me" else 200
        self.send_response(status)
        self.end_headers()
        self.wfile.write(b'<html><div id="root">FICTIONAL REHEARSAL</div></html>')

    def log_message(self, *_):
        pass


HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
