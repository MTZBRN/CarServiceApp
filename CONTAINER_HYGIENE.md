# Container filesystem and verification notes

These are configuration/verification notes, not a deployment procedure. No real workshop data has
been moved or had its ownership changed by Security Stage 3C.

## Identities and writable paths

| Image | Runtime identity | Listener | Writable paths |
|---|---|---|---|
| Backend, including combined root image | UID/GID 1654:1654 | 8080 | /app/data, /app/uploads, /tmp |
| Static Nginx frontend | UID/GID 101:101 | 8080 | /tmp |

Application files and Nginx configuration/static content stay root-owned and readable by the service
users. Compose makes both root filesystems read-only, drops all Linux capabilities and enables
no-new-privileges. /tmp is a bounded writable tmpfs with noexec/nosuid/nodev. Nginx PID and all temporary
paths are explicitly under /tmp; its prebuilt configuration needs no root entrypoint initialization.

Backend container defaults place SQLite at /app/data/app.db and uploads under /app/uploads. These
defaults are image environment settings; local non-container developer paths are unchanged. The
combined root image also declares the two data volumes. Dockerfile USER applies outside Compose;
the read-only/capability/resource controls are Compose settings and must be supplied separately if
someone runs an image directly.

## Existing bind directories

Compose defaults remain `./backend-data` -> `/app/data` and `./user-uploads` -> `/app/uploads`.
Stage 4A adds `DATA_PATH` and `UPLOADS_PATH` parameters for deliberately selected absolute Linux
production paths; see PRODUCTION_ARCHITECTURE.md and .env.production.example. The frontend remains
loopback-only; FRONTEND_BIND_PORT changes the port, never the public bind address.
It refuses to automatically create missing host paths. This prevents an unnoticed new root-owned
empty data directory from replacing the intended database mount.

Before any container run, the operator must verify that these are the intended directories and
that UID/GID 1654 can read/write the database, sidecars and uploads. Image directory ownership does
not override a bind mount's host permissions. Do not make these directories world-writable.

For **new, empty directories only**, a Linux operator can create them from the repository root with:

```sh
sudo install -d -o 1654 -g 1654 -m 0700 ./backend-data ./user-uploads
```

For existing business data, review backups, current ownership, rootless/user-namespace mappings and
host ACLs first. Deliberate operator permission preparation is required; there is no automatic
recursive chown, copying, database migration/reset or ownership change in this task. On Docker
Desktop, bind permission behavior must be checked in the actual engine environment.

## Health and resource bounds

The backend healthcheck invokes `dotnet CarServiceShop.dll --healthcheck`. This is a separate bounded
loopback HTTP client; it does not start another host, validate secrets, provision accounts or run
migrations. It succeeds only for HTTP 200 from http://127.0.0.1:8080/healthz. That anonymous endpoint
returns only `healthy` with no-store. A process existing without a serving HTTP application fails.
Startup migrations/configuration still finish before serving. Health does not continuously query
the database or certify every business operation.

The frontend uses the Alpine image's wget against its own static document at port 8080. Compose waits
for backend health before initially starting Nginx. Health transitions do not provide automatic
recovery/monitoring. The fixed internal HTTP port is part of this configuration; changing ports or
introducing HTTPS redirection needs a corresponding healthcheck review.

| Service | Memory | CPU quota | Process/thread limit | /tmp size |
|---|---|---|---|---|
| Backend | 1 GiB | 1 CPU | 256 | 128 MiB |
| Frontend | 128 MiB | 0.5 CPU | 64 | 32 MiB |

Nginx uses two workers so it cannot spawn one per host CPU beyond the intended process budget.
These are starting limits for local Docker Compose on a Linux engine, not performance guarantees.
The service-level mem_limit/cpus/pids_limit settings are used rather than relying on optional
Swarm deploy settings. Do not reuse the file as a Swarm stack without separately checking semantics.
Container limits do not provide application pagination, per-user quotas or an audit trail.

## Required future container verification

Docker was unavailable during Stage 3C. Before relying on this container configuration, use isolated
disposable bind directories and synthetic external environment values to verify:

1. Compose parsing, both builds, Nginx syntax and actual HTTP/health status.
2. Effective backend UID/GID 1654 and frontend UID/GID 101, including workers.
3. SQLite database/sidecar and normalized upload writes succeed in their mounted directories.
4. Application/config/static paths reject writes; only intended mounts and tmpfs accept them.
5. Dropped capabilities, no-new-privileges, read-only rootfs and resource limits are actually applied.
6. Backend has no host port; frontend ingress is still only 127.0.0.1:5173 (internal port changed to 8080).
7. Image layers contain no local databases, uploads, environment secrets, test projects or build caches.
8. A current image scanner reviews the final OS/native layers; a clean package advisory scan is not
   an image scan.

Do not use the real workshop database for this validation. `docker compose config` can expand and
display secret environment values; use only synthetic values or the quiet validation option and
never paste expanded real secrets into logs or reports. No public HTTPS/domain setup is included.
