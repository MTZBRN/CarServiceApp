# Pre-production Stage 4A — deployment readiness preparation

Date: **2026-11-01**. Repository: `C:\CarServiceApp\CarServiceApp`.

## 1. Baseline and scope

Clean baseline HEAD: **`c580873333a6a66a485d4108aa2401e2d99b460f`**, `Fix final security validation gap`. Recorded upstream resolves to the same commit; no remote fetch/push was required or performed. FINAL-001 aggregate validation and its regression are committed in that baseline. No unrelated local recovery changes were present.

Inspection covered all three Dockerfiles/build contexts, Compose, Nginx main/site/header configuration, appsettings/environment mapping, existing migrations/startup behavior, health probe, admin provisioning, data/upload boundaries, audit/upload maintenance notes and the final re-audit operational blockers. Planning preceded edits: retain a single hardened loopback Compose topology, document the production contract/trust boundaries, prepare path-safe paired backup/isolated restore and disposable staging tools, then run local regressions/static checks. No application business/backend source or migration was changed.

No VPS/cloud resource, real DNS/certificate, production secret/account/customer data, public deployment or firewall was created/configured. No commit/staging or history rewrite was performed. Synthetic fixtures and transient test hosts are the only data used.

## 2. Target architecture

Recommended initial shape: **one workshop, one Linux VPS, one rootful Docker Compose application instance, SQLite retained**. Future host Caddy terminates HTTPS and proxies to loopback frontend Nginx, which forwards only to the private ASP.NET backend. Separate real host paths persist SQLite/audit and uploads. No Kubernetes/Swarm/Redis/PostgreSQL or monitoring platform was added.

[PRODUCTION_ARCHITECTURE.md](C:/CarServiceApp/CarServiceApp/PRODUCTION_ARCHITECTURE.md) documents components, public/private ports, actor/API/filesystem/secret boundaries, proposed host layout, failure considerations and the complete environment contract. `/healthz` remains liveness rather than a continuous DB-write readiness guarantee.

## 3. Production environment and secret contract

[.env.production.example](C:/CarServiceApp/CarServiceApp/.env.production.example) is a deliberately unusable placeholder template: invalid signing material, rejected example issuer/audience, no real password/domain/key. `.env.production` remains ignored; the exact safe example is eligible for tracking and is excluded from Docker contexts by existing env exclusions.

Required inputs: JWT_KEY/ISSUER/AUDIENCE, operational absolute DATA_PATH/UPLOADS_PATH and reviewed release APP_IMAGE_TAG. Optional loopback FRONTEND_BIND_PORT defaults to 5173; explicit stable project identity is documented. Fixed container settings remain Production, `/app/data/app.db`, `/app/uploads`, port 8080 and the trusted private frontend address. Optional application-only read/login limit settings are clearly distinguished from variables actually mapped by Compose. Secret/format/minimum validation/generation/restart implications are recorded per variable.

[PRODUCTION_SECRETS.md](C:/CarServiceApp/CarServiceApp/PRODUCTION_SECRETS.md) provides future CSPRNG commands for 64-byte base64 signing material and a 32-character random admin password without displaying values, protected root-only configuration outside source, safe temporary provisioning environment and rotation/re-login consequences. No future production value was generated. A portable Python test runtime and future staging runner use only disposable synthetic randomness. Operator/Docker root access remains a trusted boundary; no claim is made that environment values are hidden from root.

## 4. Compose strategy and preserved protections

One `docker-compose.yml` remains; no duplicate production overlay was introduced. Changes are narrowly additive:

- `DATA_PATH` / `UPLOADS_PATH` parameterize host binds; prior local defaults remain. `create_host_path=false` remains.
- `FRONTEND_BIND_PORT` parameterizes the port while **127.0.0.1 is fixed**. Backend still has no public host port.
- Release-specific `carserviceapp-backend:${APP_IMAGE_TAG:-local}` / frontend tags support intentional rollback rather than overwriting a single image identity. Production uses the reviewed commit; staging uses a unique synthetic tag.
- `restart: unless-stopped` supports process/daemon recovery; it does not recover an unhealthy running process. Failed deployment health waits require explicitly stopping/investigating the candidate, never ignoring an initialization restart loop.

UID/GID 1654 backend / 101 frontend, read-only rootfs, ALL capabilities dropped, no-new-privileges, hardened bounded tmpfs, existing healthchecks, private network and CPU/memory/PID controls are preserved. Static YAML assertions verify these fields. Dockerfile content was inspected and left unchanged. Existing CONTAINER_HYGIENE.md now explains the safe parameters/defaults. Effective engine settings remain unverified without Docker.

The existing Playwright frontend was also narrowed from all interfaces to **127.0.0.1** for local test safety; the complete Chromium suite passes. No UI/business assertions were changed.

## 5. TLS/client identity and firewall design

[TLS_INGRESS_PLAN.md](C:/CarServiceApp/CarServiceApp/TLS_INGRESS_PLAN.md) recommends host Caddy -> loopback Nginx. It explicitly preserves the unresolved **two-hop forwarding requirement**: current Nginx `$scheme`/`$remote_addr` represent its inner hop. A host TLS proxy alone is insufficient. Later validation must identify the actual immediate peer, trust only that peer, sanitize edge forwarding, preserve original-peer trust when rewriting client IP, forward a single verified address/scheme to the API, and retain API trust of only the frontend/ForwardLimit=1. Spoofed headers, distinct login source partitions, redirects and HSTS must be proven. No fabricated live trust address or arbitrary-header acceptance was enabled.

Public HTTP is only redirect/ACME as appropriate; public business traffic is HTTPS. HSTS starts after valid HTTPS and renewal are verified, with the edge owning a consistent header policy. No actual ingress/DNS/certificate was configured.

[SERVER_HARDENING_CHECKLIST.md](C:/CarServiceApp/CarServiceApp/SERVER_HARDENING_CHECKLIST.md) describes default-deny inbound, approved SSH TCP management, HTTP/HTTPS, IPv4/IPv6 testing, key-based SSH/root-login restrictions after recovery testing, private application/Docker/data ports, least-privilege directories and effective Docker/firewall verification. No host rules were changed.

## 6. Persistent storage and SQLite strategy

Proposed layout: reviewed root-owned releases under `/opt/carserviceapp/releases/<sha>`, 1654:1654 0700 real data/uploads directories, root-only local backup staging, and `/etc/carserviceapp/.env.production` mode 0600. Data is separate from release/config and survives replacement. No world-writable persistent directory or blind recursive ownership change is recommended. Rootless/user-namespace remapping requires separate ownership validation.

The fixed absolute SQLite connection and required `Database.Migrate()` before serving are appropriate for the intended **single-instance** deployment, provided persistence, permissions, backups and migration rehearsal are verified. No provider/journal configuration or model was changed. WAL/SHM must be treated correctly; startup/migration failure stops deployment. Disk-full can reject required audit-backed writes. No copy-only-live-main-file backup, EnsureDeleted, reset, forced startup or blind down-migration is provided.

## 7. Backup and isolated restore design

[BACKUP_AND_RESTORE_PLAN.md](C:/CarServiceApp/CarServiceApp/BACKUP_AND_RESTORE_PLAN.md) covers the database (including accounts/audit/migrations), uploads, separate protected configuration/release identity, quiet-window coordination, off-VPS encryption, retention and incident recovery. Suggested starting policy: daily paired backup, 14 daily/8 weekly/12 monthly encrypted offsite snapshots, about seven days of local completed sets after offsite/restore verification. Provider snapshots are supplementary. No automatic deletion/retention job was installed.

Prepared tools:

- `scripts/backup.sh` -> Python stdlib SQLite backup API, not unsafe live cp. Requires explicit absolute paths and `--quiesced`; rejects overlapping/link paths, checks source stability, integrity/FKs, file inventories/hashes and exclusive lock. Produces private timestamped completed sets with checksums after flushing; partial sets are not successful backups.
- `scripts/restore-test.sh` -> refuses existing targets/production paths, restores only to explicitly new system-temp `carserviceapp-restore-test-*` targets with trusted existing parents. Checks artifact hashes, stream-extracts only expected regular files with traversal/link/type/size restrictions, verifies database and each file, then writes a success marker. Never overwrites production or starts an app. Default upload expansion bound is 1 GiB; larger sets require explicit review.
- `scripts/ops_storage.py` contains the shared logic, clear bounded status logging and no embedded credentials/network/pruning/container control.

`--quiesced` is an operator assertion, not a magical lock on every possible writer. Stop services and all one-off/file writers first. Checksums are corruption checks, not authentication of an attacker-rewritten backup; offsite encryption/authentic provenance and protected access remain required. Real data backups necessarily contain sensitive records/hashes/audit and need protection. The helper does not make plaintext local backups offsite/encrypted automatically.

Local tests used **synthetic SQLite WAL/data and fake upload bytes only**. They are useful functional evidence for the code, not proof that a future VPS/offsite restore works. Linux modes, storage durability, actual restore/application trial and offsite credential recovery remain later gates.

## 8. Deployment, admin and migration runbooks

[PRODUCTION_DEPLOYMENT_RUNBOOK.md](C:/CarServiceApp/CarServiceApp/PRODUCTION_DEPLOYMENT_RUNBOOK.md) is a human-reviewed sequence: host/SSH/firewall/Docker, immutable release/storage/config, quiet Compose validation, build/scan, isolated gates, backup, migration/start, health/admin verification, TLS/spoofing checks, application smoke, offsite restore, alerts and explicit go-live. It is not an opaque production deployment script.

Exact supported first-admin command is a one-off backend `--provision-admin` with selected production binds/config, temporary InitialAdmin environment passed **by name**, and automatic removal of that one-off container. The runbook scopes/unsets the temporary values in a subshell and explains that an already populated Users table returns without overwriting/creating accounts. Exit 0 alone is not account verification. No default/test credential or production recovery use of the Development-only command is recommended. No account was provisioned here except existing disposable regression fixtures.

New installs migrate an empty selected DB through supported startup/provisioning. Existing DB/upgrades require a tested copy, pre-upgrade paired backup, one writer, startup failure as a deployment stop, saved image/release IDs and deliberate rollback/paired restoration when necessary. There is no invented migrate-only CLI or new migration.

[RELEASE_CHECKLIST.md](C:/CarServiceApp/CarServiceApp/RELEASE_CHECKLIST.md) keeps all future-VPS evidence unchecked: source/security/images, data/backup/restore, application roles/workflows and operational signals. Local preparation does not auto-check the public release gate.

## 9. Prepared disposable staging flow

[STAGING_VALIDATION.md](C:/CarServiceApp/CarServiceApp/STAGING_VALIDATION.md) and `scripts/stage4a-validate.sh` / `stage4a_validate.py` prepare a future local Linux/rootful-Docker run. It refuses remote SSH/TCP engines, documented production/other storage, public/backend bindings and hardening disablement. It creates only a private `/tmp/carserviceapp-stage4a-*` root, own project/image tags/subnet, synthetic key/scope/password and loopback port. It resolves the reviewed base Compose to private JSON, avoiding configuration duplication. Critical generated key/scope values are verified before startup.

Later it will build, run `nginx -t`, check migration/no-default-user, explicitly provision a test admin, inspect effective UID/GID/process capabilities/NoNewPrivs/rootfs/tmpfs/resource/mount/port state, probe allowed/denied writes, exercise login/upload/worksheet/audit, restart/persistence and cold synthetic backup/restore. It cleans only its own project and retains protected review artifacts. It does not validate TLS/public firewall/offsite backup and never accepts `.env.production` or arbitrary production data arguments. Rootless/remapped Docker and non-Docker host route conflicts are documented limits.

**This full runner was not executed: Docker is unavailable. No VALIDATION_PASSED marker or live-container pass is claimed.** Safety guard logic has isolated unit coverage; effective runtime checks still need the real engine.

## 10. Images, monitoring and maintenance

[IMAGE_SECURITY_SCANNING.md](C:/CarServiceApp/CarServiceApp/IMAGE_SECURITY_SCANNING.md) provides future Trivy full and HIGH/CRITICAL gate commands for both actual runtime image IDs, OS/library/secret review, digest/date/tool provenance, false-positive/mitigation decisions with expiry and protected reports. No blanket ignore/unfixed suppression or scan pass is asserted. Trivy was not installed/executed.

[OPERATIONS_MONITORING.md](C:/CarServiceApp/CarServiceApp/OPERATIONS_MONITORING.md) defines minimal health/5xx/auth-abuse/disk/DB-upload-backup growth/offsite-age/certificate/restart alerts, privacy and log rotation planning, daily/weekly checks, monthly maintenance and quarterly restore drills. It retains the existing audit sampling/manual-retention caveats. Patch flow includes OS/Docker/Caddy/dependency review, tagged rebuild/scan, pre-upgrade backup, single-writer migration, smoke/regression and rollback; no unattended application upgrade or monitoring stack was added.

## 11. Local verification actually performed

| Required/local check | Result |
| --- | --- |
| dotnet restore | PASS |
| Backend build | PASS, zero errors; existing User.Role CS8618 warning |
| Complete backend tests | **171 passed, 0 failed, 0 skipped** |
| Migration/model consistency | PASS within existing upgrade/HasPendingModelChanges regression tests; no model/migration changes |
| Frontend npm ci | PASS, lock/dependency versions unchanged |
| Strict TypeScript / production build | PASS / PASS |
| Complete Chromium | **85 passed, 0 failed, no retries (3.5 minutes)** with loopback-only frontend test listener |
| Backup/restore helper tests | **10 passed, 1 skipped** of 11; committed WAL/closed WAL pairs, hashes/counts, corruption, overlap, existing/production target refusal, archive traversal/link rejection and bounds |
| Staging guard tests | **9 passed**; paths, public bindings, hardening, unknown/named storage, remote engines, checked socket pinning, subnet selection, synthetic image |
| Python syntax compilation | PASS using isolated portable Python 3.14.10 outside the repository |
| Bash `-n` | PASS for all three shell wrappers, installed Git Bash 5.2.37 |
| Runbook command syntax | PASS: 10 Bash blocks and 2 embedded Python snippets; syntax only, no secret-generation/deployment commands executed |
| Static YAML/topology/security/placeholder/line-ending checks | PASS using existing locked frontend js-yaml; **not** Docker Compose schema/runtime validation |
| Secret-file ignore policy | PASS: `.env.production` ignored; safe example allowed; no usable key/password in example |
| git diff --check / new-file whitespace | PASS; existing Windows LF/CRLF normalization notices are informational |
| Docker/Compose/nginx/image execution | **UNVERIFIED — Docker and standalone Nginx unavailable** |
| ShellCheck | Unavailable; Bash syntax, unit/static checks and manual review used |

The skipped upload-symlink creation case is a Windows privilege limitation; a malicious symlink tar member is still tested/rejected locally. Actual Linux symlink/owner/mode/permission behavior remains a runtime gate. Initial script tests found SQLite connection lifetime/fsync/WAL-sidecar issues, which were corrected before the passing results. No assertion was weakened to hide them.

Windows did not have a usable system Python/WSL runtime, so an official portable Python 3.14.10 was fetched to external `.stage4a-tools` for disposable testing only; it is not a system/application package or repository dependency. Its native stdlib SQLite is a test utility, not a replacement for the application's bundled SQLite provider. Git Bash required the ordinary tool sandbox escape for its Windows named-object initialization; syntax checks then ran. No rejected action or unresolved approval request remains.

## 12. Files created/changed and boundaries

Modified: `.gitignore` (safe example/Python artifact rules), `docker-compose.yml` (safe binds/loopback port/release tags/restart policy), `CONTAINER_HYGIENE.md` (current parameters), `Frontend/playwright.config.ts` (loopback test server).

New configuration: `.env.production.example`, `.gitattributes` (Unix script line endings).

New documents: `PRODUCTION_ARCHITECTURE.md`, `PRODUCTION_SECRETS.md`, `TLS_INGRESS_PLAN.md`, `SERVER_HARDENING_CHECKLIST.md`, `BACKUP_AND_RESTORE_PLAN.md`, `PRODUCTION_DEPLOYMENT_RUNBOOK.md`, `RELEASE_CHECKLIST.md`, `STAGING_VALIDATION.md`, `IMAGE_SECURITY_SCANNING.md`, `OPERATIONS_MONITORING.md`, this report.

New operator/test files: `scripts/backup.sh`, `scripts/restore-test.sh`, `scripts/ops_storage.py`, `scripts/stage4a-validate.sh`, `scripts/stage4a_validate.py`, `scripts/tests/test_ops_storage.py`, `scripts/tests/test_stage4a_safety.py`, `scripts/tests/check-compose.mjs`. No existing backend/business test source was weakened/edited. No source file was removed. Generated Python/browser/build artifacts are ignored, not release inputs.

## 13. Remaining actual-host work and Stage 4A gate

Still required in later authorized stages: purchase/provision a VPS; supported OS/SSH/firewall/Docker; actual engine/Nginx/image/native scans and effective UID/bind hardening; production layout/config/secret generation and initial admin; trusted two-hop ingress adaptation, real DNS/TLS/renewal/HSTS/client-IP/spoofing verification; consistent offsite backup and full isolated restore/application drill; working alerts/log rotation/capacity monitoring; synthetic operator trial and explicit public release decision. No real production data should be introduced until its prerequisites are proven.

The known development-only lint advisory chain/deprecation and cosmetic build/test notices remain non-blocking maintenance, not silently fixed or suppressed. Preparation does not close unresolved infrastructure execution checks.

**Stage 4A preparation gate: PASS — PREPARATION ONLY.** All currently executable required application regressions and artifact/whitespace checks pass, with the explicitly documented Windows test skip and unavailable Docker/Linux runtime checks. This gate concerns repository/runbook/script preparation only; it does not certify a future VPS, functioning production backup/restore or public deployment. Stop after Stage 4A; no commit or live deployment is authorized/performed.
