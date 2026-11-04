# Backup runtime ownership fix — baseline 1b45fdf

Implemented locally; no commit, push, VPS installation, secret copy or timer activation.
The initial working tree was clean. No branding/application files or data ownership changed.

## Result

The developer checkout no longer needs to be root-owned. The root service uses an explicitly
promoted release under `/opt/carserviceapp/backup-runtime/staging/r1`, with private root-owned
files/directories and a read-only runtime mount in the service. The original deploy-owned
checkout/env and UID 1654 DB/uploads stay unchanged. Secret-bearing snapshots remain private.

The new offline packager consumes only inputs explicitly staged by the operator. It never
contacts Docker, discovers secrets, installs units or deploys. It refuses existing output.
Reviewed source Compose files are copied for provenance; their resolved operational model
has build contexts removed, absolute binds preserved, inspected image IDs pinned and the
existing named networks marked external. There is no relative checkout dependency at runtime.

The project is taken from inspected staging labels, not guessed from the new folder. Both
container IDs, image IDs and network IDs are pinned and checked before interruption. A normal
container replacement causes preflight failure until a fresh reviewed runtime is installed.
No path through the orchestrator creates/rebuilds/pulls a stack. Existing start/stop and
failure/recovery behavior remains, including failed backup exit status after successful restart.

The single maintenance lock retains its original root-owned inode. Root administrators hold
it while running approved deployment work as deploy; no new sudo policy or alternative lock
was added. This is cooperative coordination, not a security boundary against Docker/root users.

## Files

- `scripts/orchestrate_backup.py`: isolated trusted helper import, protected release checks,
  explicit project/runtime file, image/container/network identity checks and trusted non-data binds.
- `scripts/freeze_backup_runtime.py`: offline reviewed-input packaging, consistency validation,
  literal-dollar handling, immutable-image/external-network snapshot and identity manifest.
- `scripts/backup.sh`, `scripts/restore-test.sh`: Python isolated mode and no site initialization.
  `ops_storage.py` and its integrity checks are unchanged.
- `ops/backup-staging.json`: protected release paths; project placeholder must be populated
  from inspected staging inputs. No production defaults.
- `ops/systemd/carserviceapp-backup.service`: protected working directory/entrypoint,
  `-I -S -B`, `ReadOnlyPaths`. Existing timer definition remains unchanged and unenabled.
- `scripts/tests/test_backup_orchestration.py`: updated runtime fixtures and helper ownership refusal.
- `scripts/tests/test_backup_units.py`: isolated entrypoint, working directory and read-only path checks.
- `scripts/tests/test_runtime_release.py`: packaging/identity tests and refusal of mismatched inputs.
- `ops/BACKUP_ORCHESTRATION.md`: replacement installation, deploy coordination, rollback and gates.
- `ops/IMPLEMENTATION_REPORT.md`: marks the original report historical and links this report.
- This report.

## Verification

| Check | Result |
| --- | --- |
| Python unittest discovery | 38 tests: 37 passed, 1 platform-specific skip |
| Mock success/failure/timeout/INT/TERM/recovery flows | Passed; no live server touched |
| Read-only preflight/lock contention/ownership refusal | Passed |
| Wrong project/environment/mount/network packaging | Rejected in tests |
| Replaced container/image/network identity | Rejected in tests |
| Protected runtime command/unit contracts | Passed |
| Backend dotnet test | 172 passed, 0 failed |
| Frontend npm run build | TypeScript and production build passed |
| Bash syntax for backup and restore helpers | Passed via local Git Bash |
| ShellCheck | Unavailable locally |
| Git diff review and whitespace checks | Passed |

Backend compilation retains the pre-existing User.Role CS8618 warning. Python tests use
synthetic fixtures; ownership and Docker/systemd interactions are mocked on Windows. Local
backend and Git Bash checks used approved outside-sandbox execution, not VPS access.

## Manual rollout, rollback and limitations

The exact root-session installation/verification commands are in
[BACKUP_ORCHESTRATION.md](BACKUP_ORCHESTRATION.md). They explicitly stage reviewed code,
Compose/env inputs and inspection output under the shared lock, package the release, verify
permissions, install/verify units and assert that the timer is disabled/inactive. They do not
enable the timer. A separate approved window is required to invoke the backup oneshot.

Rollback commands restore only a protected prior service/release after checking its recorded
identity still matches. Do not reactivate the earlier checkout-dependent unit. If container
IDs changed, package a new snapshot even when reverting to an earlier application image.
Keep all backups, application data and the maintenance lock; no data restore is needed to
roll back this code. Retained runtime releases contain secrets and need private storage.

Native Ubuntu `systemd-analyze verify`, real Compose snapshot/dry-run, Linux flock/signal
delivery and a supervised staging backup/restore remain operator gates. This Windows host
has no native systemd/WSL runtime. No actual staging project name or container identity was
invented. Do not claim production readiness from mocked tests.

Operators must review copied source before root promotion and prevent concurrent checkout
edits during capture. All deploy/host writers must honor the lock. Caddy downtime affects
all sites it serves; SIGKILL/power loss can prevent recovery. Root/OS/Docker tooling remains
trusted. Independent offsite credentials/key recovery, verified encrypted offsite restore,
alerts, measured downtime/RPO/RTO and production-specific deployment remain prerequisites.
