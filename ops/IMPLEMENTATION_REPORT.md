# GTA Szerviz branding and backup — review report, 2026-11-04

Historical report for the original implementation. The ownership/runtime fix and current
validation results are in [OWNERSHIP_FIX_REPORT.md](OWNERSHIP_FIX_REPORT.md); use the current
BACKUP_ORCHESTRATION.md installation procedure instead of the original layout.

Baseline: `6308ce0` (`Fix trusted HTTPS forwarding across ingress proxies`).
The initial working tree contained only the user-supplied untracked logo under
`Frontend/public/gta-szerviz-logo.png`. No commit, push, VPS deployment, service installation
or timer activation was performed. Existing application functionality and backup integrity
helpers were not changed. New files are untracked and must be included explicitly in review;
plain `git diff --stat` does not show their contents.

## Independently reviewable changes

Task A:

- `Frontend/index.html`: title `GTA Szerviz | Műhelykezelő`; three PNG favicon sizes and Apple icon.
- `Frontend/public/gta-szerviz-logo.png`: original user-supplied source, preserved unchanged.
- `Frontend/public/brand/gta-szerviz-transparent.png`: 1254x1254 transparent full logo, 402,428 bytes
  versus 451,884 bytes for the source (about 11% smaller).
- `Frontend/public/brand/favicon-16.png`, `favicon-32.png`, `favicon-48.png`: original GTA crop
  on a dark tile, 493 / 1,193 / 1,956 bytes.
- `Frontend/public/brand/apple-touch-icon.png`: 180x180 original GTA crop, 19,863 bytes.
- `scripts/build-branding.ps1`: repeatable deterministic extraction and sizing using System.Drawing.

The imagegen draft changed the lettering and was rejected. After the user's explicit approval,
the delivered assets were derived from original pixels with deterministic code. Exact RGB black
is removed; distinguishable nonblack outlines remain. No AI-generated lettering is in the
repository. The optional sidebar substitution was omitted to preserve the existing layout.

Task B:

- `scripts/orchestrate_backup.py`: root/Linux orchestration, read-only dry-run, exclusive lock,
  preflight, cold backup, bounded commands, fail-safe recovery and HTTPS checks.
- `scripts/tests/test_backup_orchestration.py`: 12 mocked workflow/process tests.
- `scripts/tests/test_backup_units.py`: 2 portable systemd contract/budget tests.
- `ops/backup-staging.json`: explicit staging paths and timeouts.
- `ops/systemd/carserviceapp-backup.service`: oneshot, root, private umask, mixed kill mode,
  35-minute start budget, 15-minute recovery budget, no core dumps.
- `ops/systemd/carserviceapp-backup.timer`: proposed daily 03:00 Europe/Budapest, no catchup;
  definition only, never installed/enabled.
- `ops/BACKUP_ORCHESTRATION.md`: architecture, exact manual installation/deployment and rollback,
  emergency recovery, future Restic setup and production prerequisites.
- `BACKUP_AND_RESTORE_PLAN.md`: link to the separately reviewed wrapper/runbook.
- `.gitattributes`: LF line endings for `ops/**`.
- This report.

Task A can be committed separately using only its listed files; Task B owns the remaining
files. Neither commit has been created. No generated build/test caches are included.

## Verification results

| Check | Result |
| --- | --- |
| Backend `dotnet test .../CarServiceShop.Tests.csproj --no-build --no-restore` | 172 passed, 0 failed, 0 skipped |
| Python `python -m unittest discover -s scripts/tests` | 34 total: 33 passed, 1 Windows-specific skip |
| New orchestration tests | 12 passed; success, backup failure/timeout, SIGINT/SIGTERM handler paths, partial stop failure, recovery continuation, initial stopped state, health deadline, unauthorized-route check, preflight mount/storage refusal, dry-run/lock contention, child cleanup |
| Systemd portable checks | 2 passed; parsing, config paths, dependency/order budgets, opt-in timer contract |
| Frontend `npm run build` | TypeScript check and Vite production build passed; assets present in `dist/brand` |
| Existing shell scripts `bash -n` | Passed using local Git Bash |
| ShellCheck | Not installed; not run |
| Pixel preservation | 1,176,443 exact-black pixels became transparent; all 396,073 nonblack pixels exactly unchanged |
| Asset validation | All icon dimensions correct; full logo and compact icons visually inspected |
| Git review | Final tracked diff checked; new implementation files read/reviewed separately; `git diff --check` passed |
| Native `systemd-analyze verify` / Linux signal delivery / real flock | Not available on this Windows host; no WSL/Linux runtime installed |
| Real staging/offsite backup and restore | Not performed; explicitly required before production |

The first .NET run hit sandbox testhost connectivity restrictions; a local approved
outside-sandbox run passed. Python tests used a workspace temp directory after the sandbox
temp path caused access failures. Git Bash syntax validation likewise required a local
outside-sandbox run. None of these tests contacted or interrupted the VPS. Backend compilation
reported the existing `User.Role` CS8618 warning; no backend source was changed.

The unit-budget test initially found the proposed recovery/start timeouts too short; these
were increased and the final suite passed. The test derives budgets from the checked-in JSON
and unit settings, so later deadline changes are reviewed together.

## Deployment, rollback and residual risks

Use [BACKUP_ORCHESTRATION.md](BACKUP_ORCHESTRATION.md) for the exact root-session commands:
manual file installation, unchanged-inode lock provisioning, `systemd-analyze verify` and
calendar validation, disabled/inactive timer assertions, preflight, a supervised oneshot
backup, isolated restore verification, frontend image rollout and rollback. The runbook
contains no timer-enable command. Existing backend/frontend images are started, never rebuilt
or replaced by the backup wrapper.

The shared lock is cooperative. All host-side maintenance/writers must adopt it; arbitrary
external writes cannot be made safe by a backup wrapper alone. Stopping host Caddy interrupts
every site served by that service, so confirm scope before the manual drill. Backups retain
sensitive business data on root-private local storage; offsite encryption and independent key
recovery are still to be provisioned. There is no automatic backup deletion or retention job.

SIGKILL, host power loss and kernel/storage hangs can prevent cleanup. A failed recovery
returns failure and requires operator action. Public HTTPS checks depend on correct DNS/TLS.
Scheduling requires independent failure/freshness/capacity alerts, measured downtime and a
tested incident procedure. Production approval additionally requires production-specific
configuration, native Linux lifecycle tests, a real paired staging restore, an independently
verified Restic offsite restore and isolated application recovery evidence.
