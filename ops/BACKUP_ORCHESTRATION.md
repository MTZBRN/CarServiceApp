# Staging cold-backup orchestration — manual rollout only

This implementation is prepared for review. Nothing is installed or enabled on the VPS.
The existing `scripts/backup.sh`, `restore-test.sh` and `ops_storage.py` remain unchanged.
Read `BACKUP_AND_RESTORE_PLAN.md` for artifact format, integrity checks and restore boundaries.

## Architecture and operating contract

`scripts/orchestrate_backup.py --config <absolute-json-path> [--dry-run]` requires Linux,
root and Python 3.12+. `ops/backup-staging.json` explicitly selects the staging paths;
there are no implicit production defaults. A future production deployment needs its own
reviewed config, Compose/env files, hostname, service/timer names and maintenance window.

The wrapper acquires a nonblocking exclusive flock on the **existing** root-owned 0600
`/opt/carserviceapp/maintenance.lock`, holding it through preflight, backup and recovery.
Every deployment, provisioning, restore and host-side upload/DB writer must cooperate
with this same lock. The wrapper also refuses visible additional running Docker containers
with overlapping writable bind mounts. It cannot prove that arbitrary host processes or
another Docker daemon are not writing. Stop or lock all such writers before rollout.
Never unlink/replace the maintenance lock while operations may hold it: flock locks its inode.

Preflight checks trusted absolute nonlinked paths, ownership/modes, tools, Python/SQLite,
DB/upload/output separation, accessible files, conservative available capacity
(twice source size plus 256 MiB), absence of the storage helper's stale lock,
Compose validity, exactly one existing backend/frontend, stable startup states and healthy
running containers. It compares configured **and actual container mounts** with the backup
paths. Docker is pinned to `unix:///var/run/docker.sock`; inherited Compose/Docker variables
cannot redirect commands. All external command output stays out of the journal.

Dry-run takes the lock and performs these reads, Docker/systemd inspections and token-free
HTTPS GET probes. It never creates a lock, writes a backup, stops/starts a service or writes
Python module caches. HTTPS GETs can create ordinary server access logs; read-only refers
to application/backup/configuration data, not absence of access logging.

Execution stops Caddy, frontend, then backend; confirms stopped states; and invokes the
existing backup helper with `--quiesced`. Its checksums, SQLite integrity/FK checks and source
stability checks are retained. There is no pruning, restore, image pull, container recreation,
database mutation command, offsite transfer or secret logging in the wrapper.

Cleanup runs after successful backup, command errors, deadlines, SIGINT and SIGTERM.
It starts only originally running services: backend then health, frontend then health,
Caddy then HTTPS. It attempts later recovery steps even if an earlier one fails. Originally
inactive services remain inactive. Invalid combinations (active ingress without healthy
app, frontend without backend) fail before interruption. A failed backup still exits nonzero
after successful recovery; failed recovery also exits nonzero and identifies the service.
Repeated INT/TERM signals are ignored during bounded recovery. Child process groups are
killed/reaped on interruption or timeout before restarting writers. A stop/start daemon job
may outlive its CLI, so post-operation state/health checks and operator monitoring matter.

HTTPS checks require verified TLS, `/` HTTP 200 and `/api/Customers` HTTP 401 without
credentials, redirects, proxy environment or curlrc configuration. DNS/TLS/availability
failures fail the operation. No tokens or response bodies are printed. HTTPS probes use
the public DNS endpoint: operators must ensure it points to this staging host.

Timeouts in the supplied config: stop 45 s (Compose command allowance +10 s), backup 900 s,
start 90 s, container health 180 s with bounded inspection calls, HTTP request 15 s.
The service allows 35 minutes overall startup and 15 minutes cleanup on stop; `KillMode=mixed`
sends the initial termination to the supervisor and leaves its cleanup budget before the
final cgroup kill. If adjusting config deadlines, adjust and revalidate the unit budgets too.
The timer proposes 03:00 Europe/Budapest, with no persistent missed-run catchup. It remains
disabled until a separately approved scheduling decision; DST behavior must be included in
the maintenance-window review.

## Exact manual staging deployment

Run these later in a protected **root Bash session on the VPS**, after reviewing the release.
`RELEASE` is the absolute path to the uploaded, reviewed checkout; set it yourself before
the commands below. No credentials belong in this document or in command-line arguments.

1. Confirm the current Compose directory/env and bind paths match the supplied JSON. Confirm
   Caddy's downtime is acceptable for **all sites** it serves. Arrange a quiet maintenance
   window, independent console access, monitoring and the shared-lock contract.
2. Provision/install files explicitly (this does not start anything):

```bash
set -euo pipefail
: "${RELEASE:?Set the absolute reviewed release path first}"
test "${RELEASE:0:1}" = /
test -f "$RELEASE/scripts/orchestrate_backup.py"
install -d -o root -g root -m 0755 /opt/carserviceapp/backup-tools/scripts
install -d -o root -g root -m 0700 /opt/carserviceapp/verified-backups
install -d -o root -g root -m 0755 /etc/carserviceapp
# Create once; preserve an existing lock inode and validate its ownership/mode.
if [ ! -e /opt/carserviceapp/maintenance.lock ]; then
  (umask 077; set -o noclobber; : > /opt/carserviceapp/maintenance.lock)
fi
test -f /opt/carserviceapp/maintenance.lock
test ! -L /opt/carserviceapp/maintenance.lock
test "$(stat -c '%u:%a' /opt/carserviceapp/maintenance.lock)" = '0:600'
# Updating the tools also cooperates with maintenance.
exec 9</opt/carserviceapp/maintenance.lock
flock -n -x 9
install -o root -g root -m 0644 "$RELEASE/scripts/orchestrate_backup.py" /opt/carserviceapp/backup-tools/scripts/
install -o root -g root -m 0644 "$RELEASE/scripts/ops_storage.py" /opt/carserviceapp/backup-tools/scripts/
install -o root -g root -m 0644 "$RELEASE/scripts/backup.sh" /opt/carserviceapp/backup-tools/scripts/
install -o root -g root -m 0644 "$RELEASE/scripts/restore-test.sh" /opt/carserviceapp/backup-tools/scripts/
install -o root -g root -m 0600 "$RELEASE/ops/backup-staging.json" /etc/carserviceapp/backup-staging.json
install -o root -g root -m 0644 "$RELEASE/ops/systemd/carserviceapp-backup.service" /etc/systemd/system/
install -o root -g root -m 0644 "$RELEASE/ops/systemd/carserviceapp-backup.timer" /etc/systemd/system/
flock -u 9
exec 9<&-
bash -n /opt/carserviceapp/backup-tools/scripts/backup.sh
bash -n /opt/carserviceapp/backup-tools/scripts/restore-test.sh
systemd-analyze verify /etc/systemd/system/carserviceapp-backup.service /etc/systemd/system/carserviceapp-backup.timer
systemd-analyze calendar '*-*-* 03:00:00 Europe/Budapest'
systemctl daemon-reload
# Check only: do not enable or start the timer.
test "$(systemctl is-enabled carserviceapp-backup.timer || true)" = disabled
test "$(systemctl is-active carserviceapp-backup.timer || true)" = inactive
python3 -B /opt/carserviceapp/backup-tools/scripts/orchestrate_backup.py --config /etc/carserviceapp/backup-staging.json --dry-run
```

Stop if any check fails, or if the timer unexpectedly reports enabled/active. Do not change
DB/upload ownership to root to satisfy a preflight; application data must retain the deployed
application ownership. Protect administrative parents, Compose files and the env separately.
The env file must be root-owned 0600, output root-owned 0700, administrative parents/files
not group/world-writable. Preserve existing env contents and edge credentials.

3. During the approved downtime window, after a successful dry-run:

```bash
systemctl start carserviceapp-backup.service
systemctl show carserviceapp-backup.service -p Result -p ExecMainStatus
journalctl -u carserviceapp-backup.service -n 60 --no-pager
docker --host unix:///var/run/docker.sock compose --project-directory /opt/carserviceapp/compose --env-file /opt/carserviceapp/.env.staging -f /opt/carserviceapp/compose/docker-compose.yml -f /opt/carserviceapp/compose/docker-compose.ingress.yml ps
systemctl is-active caddy
```

4. Select the exact newly completed backup directory (never `.partial-*`). Set `BACKUP_SET`
   to that absolute directory and `RESTORE_TARGET` to a new unique path under `/var/tmp`
   beginning `carserviceapp-restore-test-`. Then:

```bash
: "${BACKUP_SET:?Select the completed backup directory}"
: "${RESTORE_TARGET:?Select a new isolated restore-test target}"
bash /opt/carserviceapp/backup-tools/scripts/restore-test.sh --backup "$BACKUP_SET" --target "$RESTORE_TARGET"
```

The timer stays disabled after this drill. Record release/image IDs, backup directory,
duration, recovery health and restore verification without exporting business contents.
Native Linux signal/process-group/flock/systemd tests and a real staging restore drill are
required before approving scheduled use. Mocked tests are not that evidence.

## Branding rollout and rollback

Branding changes are in `Frontend/index.html`, the supplied source PNG, generated
`Frontend/public/brand/*`, and `scripts/build-branding.ps1`. They can be reviewed/committed
independently from this orchestration. The source was actually supplied at
`Frontend/public/gta-szerviz-logo.png`; it remains unchanged. The deterministic script removes
only exact RGB(0,0,0), preserving all other source pixels and distinguishable dark outlines.
No generated logo is used. Full transparent PNG keeps original 1254x1254 placement; compact
GTA crops produce 16/32/48 PNG favicons and an opaque 180 Apple icon on a dark tile.
The general PNG is smaller than the original. The sidebar is unchanged (optional scope).

Use the existing reviewed frontend image-build/publishing process with a unique release tag.
This repository change alone does not deploy it. Once the frontend image is present on the
VPS, in the same root Bash session, set `NEW_FRONTEND_IMAGE` to that exact existing image
reference and record the current image ID. This explicit Compose override avoids changing
the backend image or shared env file:

```bash
: "${NEW_FRONTEND_IMAGE:?Set the exact already-built frontend image reference}"
DC=(docker --host unix:///var/run/docker.sock compose --project-directory /opt/carserviceapp/compose --env-file /opt/carserviceapp/.env.staging -f /opt/carserviceapp/compose/docker-compose.yml -f /opt/carserviceapp/compose/docker-compose.ingress.yml)
exec 9</opt/carserviceapp/maintenance.lock
flock -n -x 9
FRONTEND_ID=$("${DC[@]}" ps --all --quiet frontend)
OLD_FRONTEND_IMAGE=$(docker --host unix:///var/run/docker.sock inspect --format '{{.Image}}' "$FRONTEND_ID")
docker --host unix:///var/run/docker.sock image inspect "$NEW_FRONTEND_IMAGE" >/dev/null
export NEW_FRONTEND_IMAGE
python3 -c 'import json,os; print(json.dumps({"services":{"frontend":{"image":os.environ["NEW_FRONTEND_IMAGE"]}}}))' > /opt/carserviceapp/compose/branding-release.json
chmod 600 /opt/carserviceapp/compose/branding-release.json
"${DC[@]}" -f /opt/carserviceapp/compose/branding-release.json up -d --no-deps --no-build --pull never frontend
flock -u 9
exec 9<&-
```

Record `OLD_FRONTEND_IMAGE` securely for rollback; ensure future regular deployments use the
chosen release image, since the branding override is explicit and is not used by backup.
Check Docker health and the public title/icons before accepting the release. For rollback,
set `NEW_FRONTEND_IMAGE` to the recorded prior image ID and repeat the same locked rollout
commands. No backend/data rollback is needed for static branding.

To withdraw orchestration, disable/stop the timer **if an operator later enabled it**;
do not kill an active backup. Let the service finish recovery and review its status, or send
SIGTERM to its main process and wait through the cleanup budget. Leave backup artifacts and
the maintenance lock intact. Units/tools can remain inert. Revert only the reviewed automation
files in a later release; never restore app data to undo automation or branding.

Emergency recovery after power loss/SIGKILL is manual: inspect backup partials and any
`.backup.lock`, verify no writer/backup remains, then use the exact Compose array above to
`start backend`, wait for healthy, `start frontend`, wait for healthy, and `systemctl start caddy`
only for services recorded as originally running. Validate HTTPS and 401 rejection. Never
blindly delete `.backup.lock`; keep incomplete sets for diagnosis. `unless-stopped` does not
guarantee recovery after a host crash during intentionally stopped containers.

## Future encrypted offsite backup — not configured here

Use a separately administered Restic repository outside the VPS failure/account boundary.
The operator must supply the real endpoint, authentication and recoverable encryption key.
Use root-only repository/password/credential files; no invented values are included.
Do not print credentials or enable shell tracing. After reviewing the destination and a
completed local set, an operator can use this pattern with real protected paths:

```bash
: "${RESTIC_REPOSITORY_FILE:?Path to operator-provisioned repository file}"
: "${RESTIC_PASSWORD_FILE:?Path to protected repository password file}"
: "${BACKUP_SET:?Explicit completed local paired set}"
export RESTIC_REPOSITORY_FILE RESTIC_PASSWORD_FILE
restic backup "$BACKUP_SET" --tag carserviceapp-staging
restic snapshots --tag carserviceapp-staging
restic check --read-data
# Select an explicit snapshot ID, and a fresh isolated restore destination.
: "${SNAPSHOT_ID:?Select the snapshot just verified}"
: "${OFFSITE_RESTORE_TARGET:?New protected isolated restore directory}"
restic restore "$SNAPSHOT_ID" --target "$OFFSITE_RESTORE_TARGET"
```

Run `restore-test.sh` on the restored paired set, then perform isolated application smoke
tests with synthetic replacement secrets, no public traffic and the matching release.
Repository initialization, transfer automation, provider credentials and failure alerting
remain separate work. Do not count a failed transfer as offsite success. No `forget`, `prune`
or local deletion is part of this implementation. Capacity/retention policy and any deletion
require a separate review after verified recovery evidence.

Production prerequisites: tested Linux recovery under signals/timeouts and disk failures,
real paired staging backup/restore, offsite restore from another machine with recovered keys,
isolated application drill, measured RPO/RTO, backup freshness/failure/capacity alerts, agreed
maintenance window, verified exclusive writer controls, production-specific config and
operator sign-off. SIGKILL, host failure or unresponsive kernel/storage cannot be guaranteed
recoverable by an in-process cleanup handler.

References: [systemd service timeouts](https://www.freedesktop.org/software/systemd/man/261/systemd.service.html),
[systemd kill behavior](https://www.freedesktop.org/software/systemd/man/259/systemd.kill.html),
[systemd timers](https://www.freedesktop.org/software/systemd/man/260/systemd.timer.html),
[Restic documentation](https://restic.readthedocs.io/en/stable/).
