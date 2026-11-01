# Production architecture and environment contract

**Preparation only.** Baseline `c580873333a6a66a485d4108aa2401e2d99b460f`. No VPS, real secrets, DNS or certificates have been configured. The existing loopback HTTP setup is not ready to expose directly.

## Single-workshop topology

```text
Internet -> domain/DNS -> host Caddy (public TCP 80 redirect / 443 HTTPS)
 -> 127.0.0.1:5173 -> frontend Nginx container :8080
 -> private backend:8080 -> EF Core / SQLite / audit
                         -> separate profile upload bind
```

One Linux VPS, one rootful Docker Compose project, one application instance and one SQLite database. Caddy is the recommended future TLS edge; see [TLS_INGRESS_PLAN.md](C:/CarServiceApp/CarServiceApp/TLS_INGRESS_PLAN.md). No Kubernetes, distributed cache, load-balanced replicas or provider change is needed for the expected small workshop.

| Component | Boundary and access |
| --- | --- |
| Browser/SPA | Same-origin `/api`; localStorage bearer tokens; frontend role guards are UX |
| Host TLS edge | Public HTTP redirects and HTTPS only; sanitizes forwarding inputs; certificate/private key never enters application images |
| Frontend | UID/GID 101:101; only application host binding `127.0.0.1:${FRONTEND_BIND_PORT}:8080`; static files + API/upload proxy |
| Backend | UID/GID 1654:1654; private network :8080, **no host ports**; JWT/database session/role checks authoritative |
| SQLite/audit | `/app/data/app.db`; shared transactional boundary; users, customer/business records and audit history |
| Images | `/app/uploads`; independent filesystem boundary; generated raster names, quota, public sandboxed serving |
| Host storage/backup | Sensitive data accessible only to approved operators/service identity; restore covers DB **and** uploads |

Read-only container rootfs, ALL capabilities dropped, no-new-privileges and existing CPU/memory/PID limits remain. Backend `/tmp` is 128 MiB, frontend `/tmp` 32 MiB, both noexec/nosuid/nodev. Their sticky-mode 1777 private tmpfs is intentional; persistent host data/config directories must not be world-writable.

## Host layout (proposed, not created here)

```text
/opt/carserviceapp/releases/<commit>/   root-owned reviewed source/config/scripts
/opt/carserviceapp/current             operator-managed release symlink, not a data mount
/opt/carserviceapp/data/               UID:GID 1654:1654, mode 0700
/opt/carserviceapp/uploads/            UID:GID 1654:1654, mode 0700
/opt/carserviceapp/backups/            root:root 0700, protected local backup staging
/etc/carserviceapp/.env.production    root:root 0600, outside source/build contexts
/etc/carserviceapp/backup/             root-only offsite credentials/config, created later
```

The host data/uploads paths are **ordinary real directories**, not symlinks, network shares or release-tree subdirectories. They survive image/release replacement. Do not recursively change ownership of existing business data without a backup/review. New empty paths may be created with `install -d -o 1654 -g 1654 -m 0700 ...`; source/config stays root-owned and non-writable to the backend. Rootless Docker/user-namespace remapping needs a separate ownership validation; do not fix mismatches with chmod 777.

One Compose file is retained. `DATA_PATH`/`UPLOADS_PATH` select host binds; defaults preserve the prior local relative paths. `FRONTEND_BIND_PORT` changes only the loopback port. `APP_IMAGE_TAG` gives both locally built images release-specific names for rollback instead of overwriting a single deployment tag. `bind.create_host_path=false` still rejects missing directories. No public-production override file was added. Use explicit `--project-directory`, `--env-file`, `-p` and `-f` in operations, never rely on the current directory or an accidental shell `.env`.

## Production environment contract

Every production app variable below is either fixed in Compose/image or deliberately supplied through the protected env file. Values in `.env.production.example` are fake; the key and scope examples intentionally fail startup validation. Shell variables can override env-file interpolation, so use a clean reviewed administrative shell. `docker compose config --quiet` validates without dumping secrets; unredacted `config`/`inspect` output is sensitive.

| Compose input / container setting | Required / format / validation | Secret? Generation/change/restart |
| --- | --- | --- |
| `JWT_KEY` -> `Jwt__Key` | Required, base64 decoding to ≥32 bytes and ≥16 distinct bytes; known weak/example material rejected. Recommend 64 CSPRNG bytes. | **Yes**. Generate on future server; persist protected; recreate backend after change. All old JWTs invalid. |
| `JWT_ISSUER` -> `Jwt__Issuer` | Required explicit absolute URI/URN, ≤256 chars, no surrounding whitespace or example/default/placeholder value; e.g. `urn:example:carserviceapp:issuer` is template-only and rejected. | No. Choose per installation; recreate backend; existing scope tokens become invalid. |
| `JWT_AUDIENCE` -> `Jwt__Audience` | Same rules; distinct client audience such as an operator-chosen installation URN. Template `urn:example:carserviceapp:client` is rejected. | No. Choose before release; recreate backend/re-login if changed. |
| `DATA_PATH` | Required operationally; absolute real host directory `/opt/carserviceapp/data`, exists, owned/mapped for 1654, no symlink. Compose's local default is `./backend-data`. | Sensitive location, not credential. Choose before first start; bind change requires deliberate stop/backup/recreate, never points silently at an empty DB. |
| `UPLOADS_PATH` | Absolute real separate host directory `/opt/carserviceapp/uploads`; same permission checks; local default `./user-uploads`. | Not credential. Stop/backup/recreate for change. |
| `FRONTEND_BIND_PORT` | Optional default 5173; operator uses unused integer 1024–65535; **host address remains 127.0.0.1**. | No. Choose once; recreate frontend and coordinate host edge on change. |
| `COMPOSE_PROJECT_NAME` / `-p` | Explicit stable project `carserviceapp`; keep the runbook's `-p carserviceapp`. | No. Changing project creates different resources; do not accidentally run two app instances. |
| `APP_IMAGE_TAG` | Production: reviewed release Git SHA, recorded with actual image IDs; template must be replaced. Local fallback `local`; staging uses a unique synthetic tag. | No. Choose each release; build both tags, then recreate services. Keep previous images for rollback; never prune the last recovery candidate blindly. |
| `ASPNETCORE_ENVIRONMENT` | **Fixed `Production` in Compose**. Not an env-file toggle. Development must not be enabled. | No. Recreate on reviewed change; not a supported production customization. |
| `ConnectionStrings__DefaultConnection` | Fixed `Data Source=/app/data/app.db`; no password for SQLite. Image default agrees. Never use repository-relative production data. | Path contains sensitive DB; not a credential. Stop/backup/review/recreate for any change. |
| `Uploads__Path` | Fixed `/app/uploads`, agrees with bind/image. | No. Coordinated storage change only. |
| `ReverseProxy__KnownProxies__0` | Fixed `172.30.90.3`, the frontend's private address; ForwardLimit=1. Do not add all networks/arbitrary forwarders. | No. Recreate backend after a reviewed network change. Host ingress trust is a separate Nginx design step, not this value. |
| `ASPNETCORE_HTTP_PORTS` | Image fixed 8080; no public backend binding. | No. Not changed for deployment convenience. |
| `HOME` | Image `/tmp`; writable, bounded tmpfs. | No. Keep default. |
| `InitialAdmin__Email` | Temporary CLI-only existing username format: nonblank ≤254 chars, preferably a unique ASCII administrative login. | Identity, not password. Supplied only to one-off provisioning process; not web service config. |
| `InitialAdmin__Password` | Temporary CLI-only ≥12 Unicode scalars and ≤72 UTF-8 bytes; recommend 32 random ASCII chars. | **Yes**. Generate/protect later; environment passed by name, unset immediately, one-off container `--rm`. |

The backend additionally supports optional `Reads__PermitLimit` (default 240, clamped 30–600) and `Login__SourcePermitLimit` (default 30, clamped 1–1000). These are **not mapped by this Compose file's env template**. Leave defaults; adding names to `.env.production` alone will not forward them. Any reviewed future override must preserve security and be recreated/tested. Internal upload/write quotas and concurrency defaults remain code-defined. No database-password, refresh-token, cloud key, secret file mount or hidden `VITE_*` production credential is required. Build-time frontend variables are public, so secrets never belong there.

## Failure and backup boundaries

Startup migrations/key/scope failure stops the API; do not force traffic past an unhealthy startup. Compose `restart: unless-stopped` recovers exited containers/daemon restarts unless deliberately stopped; it does not restart a merely unhealthy running process or provide alerts. A failed `up --wait` must make the operator stop the candidate and investigate, not leave an initialization restart loop unattended. Liveness `/healthz` does not prove disk capacity or database write readiness. A disk-full/permission/audit-write failure can reject business mutations deliberately. This VPS is a single point of failure; outages, patching and cold backup have planned downtime. Off-VPS paired backup and a tested restore are required, not only provider snapshots. See [BACKUP_AND_RESTORE_PLAN.md](C:/CarServiceApp/CarServiceApp/BACKUP_AND_RESTORE_PLAN.md).
