# Phase 6E: isolated Ubuntu/Docker rehearsal

This replaces the Phase 6D manual plan. It requires no TEST/PROD credentials,
GitHub API token, VPS connection, live checkout or real database. Prepared locally;
Linux execution has NOT been performed yet.

## Runtime investigation continuation — 2026-11-12

Branch `feature/rehearsal-runtime-diagnostics` starts at freshly fetched
`origin/test-deploy` dc8e65a05d7a13171c6f32d5c8adc0b1b037dc69 (PR #7 merged).
The permission fix is retained without modification.

Retrieved all three job logs from [run 43023372253](https://github.com/MTZBRN/CarServiceApp/actions/runs/43023372253):
success job 130531848657, backup-failure 130531849130, migration-failure 130531849194.
Each shows backend `created`, exit 128, health `unknown`, empty health exit codes;
frontend `created`, exit 0, health `unknown`. Compose exits 1 during provisioning.
Outer image build and isolated daemon readiness passed. The logged Ubuntu package
was docker.io 29.1.3-0ubuntu3~24.04.2. All eight existing rehearsal tests passed on
Linux, including metadata permissions, before the startup failure.

**Confirmed evidence gap:** State.Error was excluded from diagnostics, daemon.log
was not exported, report.json did not exist, and cleanup deleted the outer box.
Those missing fields cannot be recovered from the historical job logs. No new
workflow was dispatched. The error is consistent with a failure before the fixture
process starts, not evidence that its Python startup or healthcheck failed.

| Candidate layer | Evidence needed before changing behavior |
|---|---|
| OCI runtime / namespace | State.Error mentioning OCI/runc/task creation, namespace or sysctl; correlate daemon errors |
| Mount / cgroup | Mount, read-only filesystem or cgroup error; distinguish from application file access |
| Network | Endpoint/bridge/iptables/address failure; an unreachable backend health URL has not been observed |
| Permissions / security profile | EACCES/EPERM, AppArmor/seccomp/capability details; created/128 does not prove fixture metadata permissions |

No runtime cause is confirmed and no runtime, Compose, isolation or healthcheck
behavior is changed. Diagnostic code now reads real State.Error and emits a
sanitized vocabulary projection, plus the last 40 daemon lines from a bounded
64 KiB tail. Unknown words, paths, IDs and credential values are redacted; control
characters are removed. This intentionally trades some detail for disclosure
control. Unknown errors may need a follow-up vocabulary extension based on safe
operator evidence; redacted text must not be treated as a complete error message.
No raw Docker config, environment, healthcheck output or daemon log is published.

The rehearsal workflow collects this JSON with `always()` before cleanup, even
when provisioning fails before report.json exists. Diagnostics are best-effort;
they neither replace the failure nor mark a scenario successful. A fixed-path
diagnose command also works when inner daemon readiness failed, provided the outer
box is still running and has its disposable marker. If the outer box has exited,
docker exec cannot collect evidence; this remains a stated limitation.

Local validation: 10 rehearsal tests passed, one existing POSIX-only test skipped
on Windows; workflow safety/order assertions and diff whitespace check passed.
No local Docker/Linux execution or full Actions schema validation is claimed.

Next authorized Actions verification: publish reviewed changes separately, open
Actions → Disposable TEST pipeline rehearsal → Run workflow, select the published
reviewed branch and set approve_fixture_recovery=true. One dispatch runs all three
scenarios. Read `Record sanitized runtime diagnostics before cleanup` and each job
summary for `state_error` and `daemon_tail`. Preserve the run URL and compare the
errors across scenarios before proposing a fix. No success claim is valid until
baseline health, intended fault injection and approved recoveries actually pass.

### Provisioning startup investigation (2026-11-11)

Prepared on `feature/rehearsal-startup-fix` from freshly fetched `origin/test-deploy`
at `5441b58fee44e5d228fc71c6d292b26233397f11`.
Baseline tags match the template (`carserviceapp-test-{backend,frontend}:baseline`);
the imported Python base supplies the interpreter used by startup and healthchecks.
The metadata files `/role` and `/generation` were created by root without explicit
permissions, before switching to UID 1654/101. The outer daemon is launched under
umask 077. If that mask reaches the build RUN process, metadata is 0600 and the
fixture raises PermissionError before binding port 8080. Both old/new images now
explicitly chmod only these fictional metadata files to 0644. Healthchecks and
production guards remain unchanged.

This is a candidate cause, not a verified diagnosis of the reported Actions run:
the supplied failure contains no container state or stderr, and this Windows host
has no Docker or installed WSL. Verify actual image metadata modes and startup on
Linux before declaring the incident resolved. A POSIX regression runs the exact
metadata creation command under umask 077 and checks resulting permissions.

Provisioning failures now emit a bounded JSON projection of each fixture service's
status, exit code, health status and last three healthcheck exit codes. Raw logs,
healthcheck output, Docker configuration/environment and exception text are omitted.
Diagnostics failure does not replace the original Compose failure. Production
deployment logging is unchanged.

Local results: rehearsal suite 7 passed/1 POSIX-only skip; deployment guard suite
11 passed. Existing workflow safety assertions passed (manual hosted runner,
network-none, no deployment secrets/environment, explicit recovery approval).
The workflow YAML itself was not changed; no Actions dispatch occurred.
After separately authorized publication, run all three matrix cases with
`approve_fixture_recovery=true`; require baseline health, success migration,
both intended faults and their recovery assertions to pass. If provisioning still
fails, use the new state evidence to investigate further; do not weaken healthchecks.

## Exact GitHub Actions instructions (after separate publication authorization)

1. Review the uncommitted Phase 6D and 6E changes. This task does not authorize
   committing, pushing, merging, registering or dispatching any workflow.
2. After authorization, publish the reviewed rehearsal files together with the
   Phase 6D dependencies. Register **rehearse-test-deploy.yml**, not deploy-test.yml,
   on the default branch for manual dispatch. No application promotion is needed
   for the fictional fixture. Keep the real deployment variable unset/false and
   the server actions-enabled marker absent; this rehearsal never sets either.
3. In Actions, select **Disposable TEST pipeline rehearsal**, choose the reviewed
   ref, and check **approve_fixture_recovery**. This is explicit authorization for
   restoring fictional fixtures only. Alternatively, using an operator's normal
   GitHub session outside the rehearsal container:

   ```sh
   gh workflow run rehearse-test-deploy.yml --repo MTZBRN/CarServiceApp --ref <reviewed-ref> -f approve_fixture_recovery=true
   gh run list --repo MTZBRN/CarServiceApp --workflow rehearse-test-deploy.yml --limit 5
   gh run watch <run-id> --repo MTZBRN/CarServiceApp --exit-status
   ```

   No token is passed to the rehearsal. Omitting/clearing recovery approval leaves
   both fault cases pending and intentionally fails the acceptance step; it cannot
   silently claim recovery passed. Recovery occurs in a separate workflow step,
   never inside the deployment helper's failure handler.
4. Require all three Ubuntu 24.04 matrix jobs to pass. Read each job summary's
   JSON report: versions/base image ID, preflight, exact synthetic commit and image
   IDs, journal stage, injected failure and recovery status. Keep this synthetic
   evidence with the review. No database, uploads, token or full config is exported.
5. The always-run cleanup removes only the labelled disposable outer container;
   the GitHub-hosted runner is discarded after its job. Never run this privileged
   harness on a VPS, a self-hosted runner, or a machine holding valuable data.

Manual dispatch registration behavior: [GitHub documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

## Isolation boundary

The job uses an explicit file allowlist to build a fresh Ubuntu harness image.
It does not send the repository root, .git, environment files or local data into
its build context. Public image/package downloads happen during preparation.
Checkout has contents-read permission and persist-credentials=false. There is no
Actions environment, deployment secret, caller-selected host/path/ref/SHA input,
SSH operation, automatic push/PR trigger or self-hosted runner option.

The outer container has **network none**, no bind mounts, no volumes, no host Docker
socket, no host PID/network mode and no passed credentials. Privileged mode is used
only to run its own nested Docker daemon with vfs storage. It is not a sandbox for
hostile code: dispatch only reviewed code on the disposable GitHub-hosted VM.
[Docker network none](https://docs.docker.com/engine/network/drivers/none) supplies
only loopback. The harness refuses external interfaces/default routes and daemon
or credential overrides; its daemon root must be /var/lib/phase6e-docker.

The fixed /opt, /etc and /var/lib TEST-shaped paths exist only in this new
container filesystem. Setup refuses any existing runtime paths or containers;
it never adopts storage. The nested network is internal, with synthetic addresses
172.29.80.2/3 and loopback 5174 inside the outer container. Images are loaded before
execution; builds have --network=none --pull=false. Nothing publishes on the outer
runner or connects to the real VPS. No endpoint can be supplied to the harness.

## What is real and what is a fixture

The existing test_deploy.deploy, installed preflight entry point, Compose template,
isolation checks, flock/journal, image builds, backup and restore verifier are reused.
The production helper and SSH gate acquire no rehearsal switches.

A tiny Python HTTP fixture substitutes for the application images. It initializes
no customer source: one fictional SQLite row and one text upload are seeded locally.
Its new backend executes a real SQLite migration; its frontend proxies the fixture
API for the existing SPA-200/API-401 smoke contract. Health checks and service UIDs
match the deployment contract. This is not EF or application/browser acceptance.

Only GitHub boundaries are replaced in-process: fetch is redirected to the fixed
local synthetic Git repository, and gh receives a fictional successful push-CI
response. Original exact-tip, SHA, CI-response and root approval validators still
execute twice. No network or real credential is needed. Synthetic Git commits are
created only inside the disposable container, never in the real repository.
Existing offline tests cover negative CI/ref/approval cases. This does not prove
live GitHub branch protections, Actions environment approvals or SSH admission.

## Executed Linux cases once dispatched

| Case | Actual operations and required assertions |
| --- | --- |
| Preflight | Installed root entry point runs; real packages, Compose/IPAM, disk, ownership, mounts and health checked. Group-writable env is refused without changing containers. |
| Success | Actual old/new Docker image builds, stopped writers, real SQLite/upload backup and restore verification, successful migration, new pair healthy, fictional row preserved, SPA/API smoke, marker removed. |
| Backup failure | Only storage.backup raises a deterministic fixture OSError. Both old services remain stopped; no new backend starts; backing-up journal and marker remain. |
| Migration failure | New fixture backend executes invalid SQL after a schema extension. Container exits with code 1; expected migration remains unapplied; frontend stays stopped; verified backup and starting-backend journal remain. No mocked migration_state. |
| Recovery after backup failure | Separate approved step acquires the lock, checks old IDs/schema and rollback-tag mapping, starts original backend then frontend, verifies health/data/upload/smoke, records decision before clearing marker. |
| Recovery after migration failure | Separate approved step stops failed services, uses existing restore_test to create a fresh paired recovery tree, restores service ownership, starts journaled old image pair on new binds, checks integrity/FKs/history/row/upload/health/smoke. Failed pair remains untouched; canonical preflight rejects recovery binds even after marker removal. |

The supplied template is used with only internal networking and restart=no as
rehearsal-specific changes, so migration failure stays stopped for inspection.
Disk admission budgets are not mocked or lowered. Insufficient hosted-runner disk
is a real failure requiring a suitably sized disposable hosted runner, not cleanup
of unrelated storage or bypassing the preflight.

## Remaining limits

Actual Linux/Docker execution must still pass. Local unit tests cannot establish
nested-daemon/Compose behavior, disk availability or successful operator recovery.
Public package/image tags can change; the report records resolved versions and
fixture base image ID. Pin approved digests if identical future rebuilds are needed.
Real application/EF migrations, native printing, authenticated application smoke,
SSH restrictions, live GitHub settings and real VPS metadata remain separate
activation checks. Do not treat fictional admission or recovery as permission to
enable deployment. Interruption/SIGKILL recovery remains a later rehearsal case.
