# Phase 6D validation — 2026-11-11

Prepared locally on clean starting branch `feature/munkalap-javitas`, HEAD
`0d052d0`. No commit, push, merge, SSH, deployment, customer-data access or server
change was performed. The supplied current release/CI status (`7d958d1`) and running
VPS revision (`8b6b7ad`) were not independently verified against the server. Local
origin/test-deploy still points to `8b6b7ad`; no decision uses that stale ref.
The connected GitHub read of the release runbook matched the reviewed policy;
the main workflow path returned 404. Environment settings/plan were not inspected.

## Executed checks

Windows, Python 3.14. Tests use only synthetic fixtures and mocked deployment
commands, never a daemon, customer database or deployment credential.

| Check | Result |
| --- | --- |
| `python -m unittest discover -s scripts/tests -p test_test_deploy.py` | 11 passed |
| `python -m unittest discover -s scripts/tests -p test_ops_storage.py` | 11 run: 10 passed, 1 platform-specific skip |
| Python AST parse of changed scripts/tests | Passed |
| `git diff --check` | Passed (working-copy CRLF normalization notices only) |
| Registration patch `git apply --check` in empty disposable directory | Passed |
| Workflow and ssh-gate comparison with starting checkout | Unchanged |

Tests cover exact successful branch push CI, tip drift, revoked/wrong approval,
invalid inputs, production/shared mounts, topology, backup write/verification
failure, migration mismatch, successful ordering and retained failure marker.
Added tests cover aggregate disk budgets on shared devices, private ownership and
ancestor permissions, preflight refusal before deployment commands, supplied
Compose model/network/proxy validation, and exact workflow-only patch contents.

The first test attempt could not write sandbox-provided TEMP directories. Re-run
with TEMP and TMP set to the existing workspace `C:\CarServiceApp\test-temp`
passed; no policy bypass or test assertion was removed. The synthetic template
test substitutes fixture environment values and validates the model; it does not
claim Docker Compose rendering was executed.

## Not executed / remaining blockers

- Linux Python 3.12, actual Compose parsing, root preflight and Docker builds/runs:
  Docker unavailable and WSL not installed on this workstation.
- Disposable Linux success, fault injection, interruption and paired recovery
  acceptance matrix in REHEARSAL.md; offline unit tests are not a replacement.
- VPS operator metadata confirmation of actual IPAM, paths, owners, alternate
  writers/daemons, disk/CPU/RAM capacity, frozen config and baseline compatibility.
- GitHub plan supports branch restrictions and protected exact-SHA CI; selected
  branch environment rule, self-review setting or documented reviewer-unavailable
  mode; no settings were changed.
- Explicit authorization to publish/merge workflow registration and release
  changes, and separate authorization for installation/activation. New release
  tip requires new push CI, full SHA and root approval; old CI cannot authorize it.

See BOOTSTRAP.md for the ordered activation checklist. Root ownership and Linux
permissions are installation requirements, not properties this Windows checkout
can provision or verify. Export reviewed files with Git/LF line endings for Linux.

## Phase 6E local validation — 2026-11-11

Continued from the uncommitted Phase 6D files. Added a manual-only Ubuntu/Docker
rehearsal workflow, allowlisted context builder, isolated daemon entry point,
fictional HTTP/SQLite fixture, integration harness and offline safety tests.
The production workflow, SSH gate and Phase 6D deployment helper were not changed
by Phase 6E. No commit, push, merge, dispatch, VPS access or deployment occurred.

Executed with Python 3.14 on Windows, workspace TEMP/TMP:

| Check | Result |
| --- | --- |
| Existing deployment guard tests | 11 passed |
| Existing backup/restore tests | 10 passed, 1 platform-specific skip |
| New rehearsal tests | 5 passed |
| Combined run | 27 run: 26 passed, 1 skipped |
| Python AST parsing | Passed |
| Rehearsal YAML parsing + manual trigger, permissions, Ubuntu matrix and recovery-default assertions | Passed |
| `git diff --check` | Passed |
| Git Bash `bash -n` | Could not start: Windows sandbox denied MSYS named-object initialization |

New tests exercise rejection of external interfaces/default routes, credentials
and Docker overrides; exact build-context allowlist and refusal to reuse a target;
local-only Git fetch/API fixture adaptation; real SQLite migration success and SQL
failure; and workflow isolation/approval constraints. The initial new-test run
exposed SQLite connections left open on Windows; explicit connection closing was
added to the fixture, harness and tests, then the combined suite passed.

Not executed: Docker image construction, nested Linux daemon, installed Linux
preflight, real Compose service transitions or recovery workflow. Docker and WSL
remain unavailable here. Publication/default-branch registration and dispatch need
separate authorization. All three Linux matrix jobs must pass before this can be
reported as a successful deployment rehearsal. The real deployment enablement
settings were not queried or changed. Future runs download public build dependencies
only before starting the isolated runtime; no TEST/PROD token or VPS host is used.

The new rehearsal does not certify EF migrations, application acceptance, real
GitHub protection/environment policy, SSH admission or VPS metadata. Those remain
activation blockers; interruption/SIGKILL recovery is not covered by this matrix.
