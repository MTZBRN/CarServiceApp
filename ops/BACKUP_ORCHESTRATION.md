# Protected staging backup runtime — manual rollout only

This replaces the former root-owned-checkout procedure. Keep the Git checkout deploy-owned,
Compose files 0664, original .env.staging deploy-owned 0600, and DB/uploads owned by UID 1654.
No VPS changes, secret copying, installation or timer activation were performed by the agent.

## Layout and trust boundary

Use /var/lib/carserviceapp-backup/staging/r1 outside Git: root:root directories 0700,
files 0600, no links. Never edit an active release. The unit mounts the runtime read-only.
Root can explicitly install a new reviewed release; this does not defend against root or
Docker-group users, who effectively have root privileges.

`/opt/carserviceapp` is deploy-owned and is not a runtime trust root. The existing
`/opt/carserviceapp/verified-backups` remains root-owned 0700 at its current location;
it is artifact storage, not executable configuration. Its deploy-owned parent can rename
or replace that directory, so it is not protected against the deploy account. No ownership
or path change to that backup directory is part of this fix.

inputs/ archives the reviewed Compose pair, explicit env snapshot, resolved config and
container inspection. These contain secrets: never commit, print or publish them.
compose/runtime.json is flattened with no builds, external env files or checkout dependencies.
Relative paths are resolved against the ORIGINAL checkout before packaging. Build contexts
are removed; images are pinned to live image IDs; existing named networks are external.
Absolute database/upload/edge binds stay unchanged. Source Compose files are archived only.
An empty explicit env file prevents implicit dotenv input; literal dollars are escaped.

identity.json records the inspected project, container IDs, image IDs and network IDs.
Explicit --project-name avoids the new directory creating a different project identity.
Preflight refuses replacements, wrong labels, mounts/environment, unsafe permissions,
additional Docker writers and unresolved build inputs. No up/build/pull/create is invoked.
Recreating containers during deployment requires a newly reviewed runtime snapshot.

All root-loaded helpers are installed privately. Isolated Python (-I -S -B) avoids checkout,
user-site and environment imports. The entry point validates its helper path before import.
System Python/stdlib, Bash, Docker/Compose and root Docker config remain trusted OS inputs.
Non-data bind inputs must be root-owned and not group/world writable. Existing edge credential
permissions must also allow its container to read it; no bind ownership is changed here.

Exactly one deployment/backup lock remains /var/lib/carserviceapp-backup/maintenance.lock, root 0600.
Never replace its inode. Deploy cannot open it directly: an approved root maintenance session
must hold it while invoking the normal deployment procedure as deploy. Do not add blanket
sudo rights. All operators/writers must cooperate; flock cannot stop uncooperative root/Docker
users. The storage helper's .backup.lock remains its artifact guard, not a second deploy lock.

## Exact manual installation (root Bash on staging only)

Pause checkout edits/deploys and review the exact commit. Set REVIEWED to its absolute path.
These commands explicitly copy secrets only when the operator runs them. Inspect root-owned,
nonlinked, non-group/world-writable administrative ancestors before proceeding.

```bash
set -euo pipefail
umask 077
: "${REVIEWED:?Absolute reviewed checkout path required}"
test "${REVIEWED:0:1}" = /
R=/var/lib/carserviceapp-backup/staging/r1
test ! -e "$R"
python3 -I -S -B - <<'PY'
from pathlib import Path
import stat
p = Path('/var/lib/carserviceapp-backup')
for entry in ([p] if p.exists() or p.is_symlink() else []) + list(p.parents):
    s = entry.lstat()
    assert not stat.S_ISLNK(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022, 'Unsafe runtime ancestor'
PY
install -d -o root -g root -m 0700 /var/lib/carserviceapp-backup
if [ ! -e /var/lib/carserviceapp-backup/maintenance.lock ]; then
  (set -o noclobber; : > /var/lib/carserviceapp-backup/maintenance.lock)
fi
test ! -L /var/lib/carserviceapp-backup/maintenance.lock
test "$(stat -c '%u:%a' /var/lib/carserviceapp-backup/maintenance.lock)" = 0:600
exec 9</var/lib/carserviceapp-backup/maintenance.lock
flock -n -x 9
install -d -o root -g root -m 0700 /var/lib/carserviceapp-backup /var/lib/carserviceapp-backup/staging "$R" "$R/scripts" "$R/inputs" "$R/units"
test -d /opt/carserviceapp/verified-backups
test ! -L /opt/carserviceapp/verified-backups
test "$(stat -c '%u:%a' /opt/carserviceapp/verified-backups)" = 0:700
for file in orchestrate_backup.py ops_storage.py backup.sh restore-test.sh freeze_backup_runtime.py; do
  install -o root -g root -m 0600 "$REVIEWED/scripts/$file" "$R/scripts/$file"
done
install -o root -g root -m 0600 "$REVIEWED/ops/backup-staging.json" "$R/backup-staging.json"
install -o root -g root -m 0600 "$REVIEWED/ops/systemd/carserviceapp-backup.service" "$R/units/"
install -o root -g root -m 0600 "$REVIEWED/ops/systemd/carserviceapp-backup.timer" "$R/units/"
install -o root -g root -m 0600 /opt/carserviceapp/compose/docker-compose.yml "$R/inputs/"
install -o root -g root -m 0600 /opt/carserviceapp/compose/docker-compose.ingress.yml "$R/inputs/"
install -o root -g root -m 0600 /opt/carserviceapp/.env.staging "$R/inputs/env.staging"
docker --host unix:///var/run/docker.sock ps --format '{{.ID}} {{.Names}} {{.Label "com.docker.compose.project"}} {{.Label "com.docker.compose.service"}}'
```

Review the copied code and inputs before executing them. Set BACKEND_ID and FRONTEND_ID to
the observed staging containers. Do not guess the project name or select another stack.
Full inspect/resolved output is redirected into private files, not the terminal.

```bash
: "${BACKEND_ID:?Select staging backend ID}"
: "${FRONTEND_ID:?Select staging frontend ID}"
PROJECT=$(docker --host unix:///var/run/docker.sock inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$BACKEND_ID")
test -n "$PROJECT"
test "$PROJECT" = "$(docker --host unix:///var/run/docker.sock inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$FRONTEND_ID")"
docker --host unix:///var/run/docker.sock inspect "$BACKEND_ID" "$FRONTEND_ID" > "$R/inputs/containers.json"
env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/root docker --host unix:///var/run/docker.sock compose --project-name "$PROJECT" --project-directory /opt/carserviceapp/compose --env-file "$R/inputs/env.staging" -f "$R/inputs/docker-compose.yml" -f "$R/inputs/docker-compose.ingress.yml" config --format json > "$R/inputs/resolved.json"
python3 -I -S -B "$R/scripts/freeze_backup_runtime.py" --release "$R"
test -z "$(find "$R" -type l -print)"
test -z "$(find "$R" ! -user root -print)"
test -z "$(find "$R" -type f ! -perm 0600 -print)"
test -z "$(find "$R" -type d ! -perm 0700 -print)"
test -z "$(find "$R" ! -type f ! -type d -print)"
namei -l "$R/scripts/orchestrate_backup.py"
bash -n "$R/scripts/backup.sh"
```

Verify namei ancestors manually. If units already exist, archive them first and confirm the
service is inactive; disable the timer if it was independently enabled. Do not interrupt a
running backup to install files. Keep any prior protected release for rollback.

```bash
ROLLBACK=/var/lib/carserviceapp-backup/staging/unit-rollback-r1
install -d -o root -g root -m 0700 "$ROLLBACK"
for unit in carserviceapp-backup.service carserviceapp-backup.timer; do
  if [ -f "/etc/systemd/system/$unit" ]; then
    cp --preserve=mode,ownership "/etc/systemd/system/$unit" "$ROLLBACK/$unit"
  fi
done
install -o root -g root -m 0644 "$R/units/carserviceapp-backup.service" /etc/systemd/system/
install -o root -g root -m 0644 "$R/units/carserviceapp-backup.timer" /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/carserviceapp-backup.service /etc/systemd/system/carserviceapp-backup.timer
systemd-analyze calendar '*-*-* 03:00:00 Europe/Budapest'
systemctl daemon-reload
test "$(systemctl is-enabled carserviceapp-backup.timer || true)" = disabled
test "$(systemctl is-active carserviceapp-backup.timer || true)" = inactive
flock -u 9
exec 9<&-
python3 -I -S -B "$R/scripts/orchestrate_backup.py" --config "$R/backup-staging.json" --dry-run
```

Stop on any failure; do not weaken permissions. Never rerun packaging over an existing
release. Its project placeholder is replaced only from inspected inputs, never a production
default. Dry-run reads files/service state and HTTPS and takes the existing lock; it creates
no backups/caches and changes no service/application data. HTTPS may generate access logs.

Only during a separately approved downtime window, after successful dry-run:

```bash
systemctl start carserviceapp-backup.service
systemctl show carserviceapp-backup.service -p Result -p ExecMainStatus
journalctl -u carserviceapp-backup.service -n 60 --no-pager
: "${BACKUP_SET:?Select explicit completed backup directory}"
: "${RESTORE_TARGET:?New /var/tmp/carserviceapp-restore-test-unique directory}"
bash "$R/scripts/restore-test.sh" --backup "$BACKUP_SET" --target "$RESTORE_TARGET"
```

The timer stays disabled. Select completed sets, never partials. Never restore over staging.

## Deployment and rollback

Every deployment uses this same root-session lock; hold fd 9 while running the separately
reviewed deployment commands as deploy, then install a NEW reviewed snapshot before unlocking:

```bash
exec 9</var/lib/carserviceapp-backup/maintenance.lock
flock -n -x 9
# Approved deployment as deploy, then repeat packaging for a fresh r2.
# In r2's copied unit change BOTH WorkingDirectory and ExecStart paths from r1 to r2.
flock -u 9
exec 9<&-
```

Repeat installation with R ending in r2 (never overwrite r1), inspect the new container IDs,
verify/install its unit and dry-run after unlocking. The root review is the trust promotion
boundary: an unattended copier from a writable checkout is deliberately not installed.

Rollback only to a retained PROTECTED release whose recorded container/network/image IDs
still match. Wait for any backup to finish recovery, keep timer disabled, and in root Bash:

```bash
: "${PRIOR_UNIT:?Absolute archived unit pointing to a matching protected release}"
: "${PRIOR_RELEASE:?Absolute retained protected release}"
exec 9</var/lib/carserviceapp-backup/maintenance.lock
flock -n -x 9
install -o root -g root -m 0644 "$PRIOR_UNIT" /etc/systemd/system/carserviceapp-backup.service
systemd-analyze verify /etc/systemd/system/carserviceapp-backup.service
systemctl daemon-reload
flock -u 9
exec 9<&-
python3 -I -S -B "$PRIOR_RELEASE/scripts/orchestrate_backup.py" --config "$PRIOR_RELEASE/backup-staging.json" --dry-run
```

If the archived unit points at the old checkout-dependent design, DO NOT reactivate it.
Leave the service uninvoked until a protected snapshot is available. If containers were
recreated, package fresh identities even after rolling back the application image. Never
bypass identity checks, delete backup/lock files or alter application data ownership.

## Operational limits and remaining approval gates

Stop Caddy/frontend/backend, invoke unchanged integrity logic with --quiesced, then attempt
original-state recovery backend/frontend/Caddy on success/error/timeout/INT/TERM. Backup
failure remains failure after successful recovery. Bounds remain 45s stop, 900s backup,
90s start and 180s health; service budgets 35min/15min, mixed kill mode. HTTPS checks 200 and
unauthenticated 401 without tokens. No pruning, production defaults or automatic rollout.

Caddy downtime affects every hosted site. Host writers must cooperate. SIGKILL/power loss
cannot guarantee recovery. Native Ubuntu systemd/flock/signals and a real staging restore
are still required; this Windows host cannot execute native systemd validation.

Future offsite Restic needs an independently administered encrypted repository and operator-
provisioned root-only credentials/password files. No endpoint or credentials are invented.
Back up an explicit completed set, check the repository, restore an explicit snapshot in
isolation, run restore-test and isolated application smoke tests. No deletion/retention job
is installed. Verified offsite restore, independent key recovery, monitoring, measured RPO/RTO
and production-specific config/project/unit/window are production prerequisites.
