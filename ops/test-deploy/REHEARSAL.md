# Phase 6E: isolated Ubuntu/Docker rehearsal

This replaces the Phase 6D manual plan. It requires no TEST/PROD credentials,
GitHub API token, VPS connection, live checkout or real database. Prepared locally;
End-to-end Linux acceptance of the current stabilization changes is still pending.

## Pipeline stabilization — 2026-11-12

Worktree `C:\CarServiceApp\rehearsal-pipeline-stabilization`, branch
`feature/rehearsal-pipeline-stabilization`, starts at fetched `origin/test-deploy`
`31a896b54979baa6be74c11724140f2911db9b52` (PR #11). Earlier permission,
cgroup, diagnostics and Compose compatibility changes are retained.

### Evidence and limits

Inspected all three jobs in [run 43201430898](https://github.com/MTZBRN/CarServiceApp/actions/runs/43201430898):

| Scenario | Job | Assertion time (UTC) |
|---|---|---|
| success | 131125571991 | 10:34:48 |
| backup-failure | 131125571522 | 10:34:49 |
| migration-failure | 131125572304 | 10:34:54 |

Each fails at `admission not repeated`. After the 21 rehearsal tests finish,
there is **no deployment `building` checkpoint**. The earlier checkpoints with
revision `aaaa...` are deployment unit-test output, not the scenario. Diagnostics
show both baseline services running/healthy. No `/evidence/report.json` exists.
The installed preflight completed; otherwise run_case could not reach this assertion.

**The exact historical exception, admission list and private journal are not
recoverable from these logs.** The old harness retained only an exception class
name, asserted before reading the journal, and never saved a failure report.
Do not describe an inferred historical sequence as observed GitHub evidence.

Confirmed fixture mismatch: `provision()` sets the only application network to
`internal:true`, while unchanged `test_deploy.smoke()` connects to
`127.0.0.1:5174`. Internal-only Docker networks do not publish the requested host
port. Container-local health checks on port 8080 can pass independently.
`containers()` checks requested `HostConfig.PortBindings`, not an actual listener.
This accounts for the healthy baseline/preflight and subsequent smoke failure.
See the [Moby endpoint implementation](https://github.com/moby/moby/blob/v28.2.2/libnetwork/endpoint.go)
(`!n.internal` gates external-connectivity programming) and the
[maintainer explanation of internal-network publication](https://github.com/moby/moby/discussions/53256).
The run installed Ubuntu's `docker.io` 29.1.3 package; this machine cannot execute it.
The fixture mismatch is established; attributing this particular historical failure
to it remains an inference until Linux evidence confirms it or reveals an earlier failure.

Local reproduction uses the real helper's smoke check with an absent loopback
listener. It raises `ConnectionRefusedError` after
`["local-fetch", "fixture-ci"]`, with no journal/marker and the simulated baseline
still running. This is a regression reproduction, **not a Linux Docker run**.
A separate real local Git test executes unchanged `check_release()` twice through
the adapter and observes exactly
`["local-fetch", "fixture-ci", "local-fetch", "fixture-ci"]`.
The existing adapter's fetch rewrite is correct; the required sequence is unchanged.

### Complete execution path and expected evidence

1. Provision fictional DB/uploads and old images in the isolated daemon; run
   installed preflight, then the negative ownership check without changing containers.
2. Start fixture-only loopback ingress. `deploy()` runs its own preflight, validates
   approval/configuration digests and takes its deployment lock.
3. First `check_release()`: real local fixture fetch, current-tip and commit checks,
   then the fixture CI response through the real CI validator. Validate resolved
   Compose, storage layout, baseline containers, smoke and health.
4. Create the unfinished marker and `building` journal, retain rollback image tags,
   archive source and build both images. Check baseline identity, then repeat the
   complete release/CI admission **before stopping either service**.
5. Stop frontend then backend; verify quiescence and migration inventory. Checkpoint
   `backing-up`; create the real paired SQLite/uploads backup; restore-verify it.
6. Start/wait for backend; validate image, migrations and existing business counts.
   Only then start/wait for frontend, verify both images and smoke, checkpoint
   `healthy`, remove the marker.

| Scenario | Admission trace | Required end state before recovery | Approved operator action |
|---|---|---|---|
| success | four calls above | healthy; both new images; migrations 001/002; no marker | none |
| backup-failure | four calls above | backing-up; original services stopped; no backup recorded; marker retained | validate rollback tags/schema, restart original containers, health/smoke/preflight |
| migration-failure | four calls above | starting-backend; new backend exited 1; original frontend stopped; history still 001; verified backup and marker retained | stop writers, verify/restore backup to a new temporary pair, start original image pair, verify history/row/upload/health/smoke; require preflight refusal of temporary binds |

Neither failure is automatically rolled back by the helper. Recovery remains a
separate explicitly approved command. Migration recovery preserves the failed
original DB/uploads; temporary recovered binds remain inadmissible for deployment.

### Changes and security implications

Only `rehearsal/harness.py`, `scripts/tests/test_rehearsal.py`, and this document change.
Production helper, storage helper, Compose template, workflow, cgroup bootstrap,
preflight and admission implementations are unchanged. No new dependencies.

- A standard-library TCP relay supplies the fixture's intended ingress strictly
  **inside the outer container**: `127.0.0.1:5174` to fixed frontend
  `172.29.80.3:8080`. It requires the inner network to remain internal, has no
  caller-selected address, and exists only during run/recovery. Bind conflicts
  fail closed. It transports actual frontend responses, including backend-proxied
  authentication checks; it never manufactures a successful response. Socket
  timeouts and context cleanup bound connections. Recovery can reopen the port.
  This does not test Docker's host-port publication; that limitation is explicit.
- Outer `--network none`, no host mounts/socket/port publication, private cgroup
  namespace, enforced resource limits, internal application network, build
  `--network=none`, unprivileged fixture users and healthchecks remain intact.
  No firewall, route, extra network or external connectivity is introduced.
- Before asserting, save/print a bounded-schema projection of the actual admission
  calls, error kind/exit code/errno, allowlisted refusal, journal count/stage,
  marker presence and service statuses. Arbitrary exception text, command
  arguments/output, environment and unreviewed journal fields are not emitted.
  Unexpected failures are re-raised rather than replaced with an admission assertion.
  The CLI emits only sanitized error metadata and a failing exit status.
- Expected failure scenarios still require all four calls, their exact checkpoint,
  appropriate error type and existing state/image/schema checks. Incomplete or
  unexpected reports cannot pass `verify` or enter approved recovery.
- Additional confirmed reporting defect: recovery previously saved completion and
  removed its marker **before** final preflight validation. Now completion follows
  validation; failed final validation restores the marker and retains pending
  evidence. Regression coverage checks rollback-tag drift and this failure path.

### Local validation and remaining Linux acceptance

Python 3.14 on Windows; all data fictional. The full scripts test suite is run via:

Final result: **82 tests, 80 passed, 2 skipped**. Rehearsal coverage is 31 tests
(30 passed, one POSIX permission skip); deployment guards 11 passed; storage
10 passed with one unavailable-symlink-permission skip; the remaining 29 script regressions passed.
Python syntax parsing (seven relevant files), rehearsal shell `bash -n`, workflow
safety contract assertions and `git diff --check` passed. The workflow itself is
unchanged; no actionlint binary was available. Windows sandbox escalation was
needed for Git's local subprocess transport, not for external service access.

```powershell
$env:TEMP='C:/CarServiceApp/rehearsal-pipeline-stabilization/test-results/temp'
$env:TMP=$env:TEMP
& C:/CarServiceApp/.stage4a-tools/python314/python.exe -m unittest discover -s scripts/tests
```

Contract tests run actual deployment/admission logic, SQLite migration code,
backup/checksums/restore verification and recovery against explicitly simulated
Docker and Linux OS boundaries. Separate tests use real local Git and loopback
TCP/HTTP. Coverage includes every scenario, correct repeated admission, failed
fetch/CI/second tip check, smoke/build/backup-verification failure propagation,
operator approval, rollback drift, final recovery validation and sanitized errors.
This is not proof of image builds, real container recreation or Linux isolation.

No Docker executable is installed locally and WSL reports it is not installed.
The full disposable rehearsal was **not** executed here. Linux-only remaining
checks include relay reachability on the actual internal bridge, real archived
image builds, stopped-container metadata, migration exit/health behavior, restoring
ownership and temporary recovery binds, and installed/source preflight checks.

After separately authorized review/publication (none performed in this task):

1. Open repository **Actions → Disposable TEST pipeline rehearsal → Run workflow**.
2. Select the reviewed ref containing these changes (feature branch, or
   `test-deploy` after authorized integration). An old run's **Re-run jobs** uses
   the old revision and will not test these changes.
3. Set **approve_fixture_recovery = true**, then manually choose **Run workflow**.
   This launches all three matrix scenarios; there is no per-scenario input.
4. Confirm outer isolation/cgroup checks, all offline tests, baseline health and
   installed preflight. Inspect `deployment_evidence`: each scenario must have all
   four calls and the checkpoint from the table above. An earlier refusal remains
   a failure with its own evidence; do not relax admission to hide it.
5. Confirm approved recovery succeeds for both failure scenarios and final logs
   show `PASS: success`, `PASS: backup-failure`, `PASS: migration-failure`. In each
   summary verify original rollback images, fictional data and cleared marker;
   migration recovery must still reject temporary binds at preflight.
6. Keep the sanitized evidence on failures. Verify disposable-container cleanup
   in every matrix job. Only a fully green Linux run establishes rehearsal acceptance.

No VPS access, real data, deployment activation, commit, push, merge or dispatch
occurred. Synthetic commits exist only inside temporary test repositories and are
removed with those fixtures. No HANDOFF.md was present in this worktree.

## Compose JSON compatibility fix — 2026-11-12

Branch feature/rehearsal-compose-options starts at fetched origin/test-deploy
3d5236a (PR #10). [Run 43199094482](https://github.com/MTZBRN/CarServiceApp/actions/runs/43199094482)
reports `unreviewed service option` in both installed/source preflight. Success job
131117521607 emits both refusal rows at 10:19:07Z.

Confirmed local reproduction with official standalone Compose 2.32.4 for Windows,
SHA256 5df58bb738c7ac2712c031e15154b49f32f4026640d8c0539090d6e0a66d6dfd,
verified against the official release checksums. `config --format json` needs no
Docker daemon. Only fictional environment values were supplied.

| Service | Added service keys versus reviewed template | Values |
|---|---|---|
| backend | command, entrypoint | null, null |
| frontend | command, entrypoint | null, null |

These are JSON serialization defaults, not executable overrides. The underlying
[Compose-go ServiceConfig](https://github.com/compose-spec/compose-go/blob/v2.4.9/types/types.go)
deliberately omits `omitempty` on these JSON fields, distinguishing null (inherit
image defaults) from empty command/entrypoint (clear image defaults). Neither key
is in the deployment helper's strict allowlist, so its set-difference check rejects
the resolved model even though the input template has no overrides.

The same real JSON capture shows bind.create_host_path=false serialized as bind:{}.
The helper requires explicit false and conservatively treats a missing value as
true. This second representation mismatch was reproduced after removing the null
service defaults. No extra service keys besides command/entrypoint were observed.

Fix is confined to the rehearsal image: compose_compat.py wraps the existing pinned
Compose plugin. For successful `config --format json` output only, it removes exactly
null command/entrypoint and materializes the omitted false create_host_path value
inside an existing bind mapping. Explicit true, non-null command/entrypoint
(including empty strings/lists), and all unknown service keys are preserved for
the unchanged strict validator to reject. Other commands exec the original plugin;
up/build/healthchecks are not altered. A nonzero config exit remains nonzero.
This is an explicit rehearsal compatibility boundary, not live deployment support
for additional Compose options. Production helper, template and allowlist are unchanged.

Changed files: rehearsal/compose_compat.py (new), rehearsal/Dockerfile (install
adapter alongside original plugin), rehearsal/prepare_context.py (allowlist),
scripts/tests/test_rehearsal.py, and this document. Official downloaded tools and
fictional resolved JSON stay under ignored test-results/; no runtime dependency
or application source changes are introduced.

Validation: actual locally generated Compose JSON passes unchanged validate_model()
after normalization (only native Windows Path comparisons adapted for this check).
Rehearsal tests: 20 passed, one existing POSIX skip. Deployment guards: 11 passed.
Negative cases retain rejection of explicit overrides, unknown/privileged options
and create_host_path=true; config failure is preserved. Workflow safety assertions
and diff whitespace check passed. No Linux daemon or plugin installation test ran
locally; exact Linux plugin output and full preflight remain to be checked there.

After separately authorized publication, run Disposable TEST pipeline rehearsal on
the reviewed ref with approve_fixture_recovery=true. Verify plugin discovery,
baseline health, installed preflight and in-process admission, then all three
scenario/recovery results. Existing safe diagnostics remain available for any later
invariant. Network-none, private cgroup namespace, cgroup enforcement and fixture
healthchecks remain intact. No VPS access, commit, push, merge or dispatch occurred.

## Healthy baseline / preflight investigation — 2026-11-12

Isolated branch `feature/rehearsal-preflight-fix`, fetched baseline
be93908569630bb0f3d973d07e4e1e4b0ead48d8 (PR #9).
Inspected [run 43196977356](https://github.com/MTZBRN/CarServiceApp/actions/runs/43196977356),
success job 131110324072: at 10:05:12Z the installed preflight command exits 1;
the subsequent diagnostics show both services running/healthy, empty State.Error,
CPU/memory/PIDs controllers available/enabled and cgroupfs selected. This supersedes
the older OCI startup failure. No refused invariant appears in published logs.

Comparison: the installed wrapper uses Python -I, loads the extensionless sibling
carservice-test-deploy via SourceFileLoader, and calls its unchanged preflight().
That helper inserts its own directory to load the sibling ops_storage.py. The
rehearsal installs both files from reviewed sources. In-process calls use the
reviewed scripts/test_deploy.py and its sibling storage module. They share the
same guard logic but have different import locations and process contexts. The
wrapper conceals all exception types/messages; therefore its exit code does not
prove a particular security invariant failed (an import or command failure is
also possible).

Reviewed invariants include root/package/install ownership, private control
files, standalone resolved Compose model, network/IPAM/ports/mounts, storage
ownership/layout, cumulative disk reserves and running/healthy services. Source
inspection alone does not identify which failed in the deleted Linux fixture.
No ownership, disk, Compose or mount requirement is relaxed; no fixture change
is justified yet.

Added preflight_diagnostics.py to the rehearsal source allowlist. After an installed
wrapper failure only, the harness runs this script twice with python3 -I, once
loading the installed helper exactly as the wrapper does and once loading the
source helper. Separate processes avoid sharing import caches. Each calls the
real unmodified read-only preflight. Refused messages are published only when
they exactly match literal require() messages from that reviewed helper; unknown
messages and exception args/stdout/stderr are never emitted. Other failures use
fixed categories, and import errors are marked load-error. The original wrapper
failure is re-raised even if a diagnostic re-check passes. Diagnostics never
call deploy(), CI admission, fetch or service mutations. No production logging
or wrapper changes are made.

Local validation: rehearsal tests 17 passed, one existing POSIX-only skip;
deployment-guard tests 11 passed; whitespace check passed. Tests cover known versus
unknown refusal disclosure, generic/subprocess exception redaction, both isolated
diagnostic variants, and preservation of the original abort. Docker/Linux execution
is unavailable locally. No confirmed root cause or successful repair is claimed.

Next verification: after separately authorized publication, run Disposable TEST
pipeline rehearsal on the reviewed ref with approve_fixture_recovery=true. In the
failed exercise step, collect both preflight_variant JSON rows. Matching refused
invariants support a fixture correction; installed-only load/error points to
installation/import context; a source pass with an installed refusal requires
comparison of contexts before any fix. If both pass, investigate transient state
without treating the original failure as success. Keep all existing guards,
network-none/private namespace/cgroup limits and healthchecks intact. No dispatch,
VPS access, commit, push or deployment occurred during this investigation.

## Cgroup v2 startup fix — 2026-11-12

Prepared in isolated `feature/rehearsal-cgroup-fix` from fetched origin/test-deploy
3845737 (PR #8). PR #7 metadata permissions and PR #8 sanitization remain intact.

Evidence retrieved from [run 43194455268](https://github.com/MTZBRN/CarServiceApp/actions/runs/43194455268),
jobs 131101695957, 131101696496 and 131101696545: all three report
`OCI runtime create failed: runc create failed: unable to start container process:
unable to apply cgroup [redacted]`. Backend remains created/128 and healthchecks
have no results. Daemon diagnostics mention cpu/memory/pids and `no such file
[redacted] directory`. Logs identify runc 1.3.4-0ubuntu1~24.04.1. The precise
controller path and remaining runtime error were redacted and cannot be recovered.

Confirmed failure layer: cgroup application before fixture execution. Confirmed
configuration omission: the custom entrypoint starts dockerd directly without any
cgroup v2 nesting setup. Moby's [DinD wrapper](https://github.com/moby/moby/blob/master/hack/dind)
moves root processes to an init child and enables subtree controllers before nested
containers run. This entrypoint previously did neither. Cgroup v2's internal-process
restriction prevents simply enabling domain controllers while root processes remain.

The proposed minimal repair implements that missing setup for the required CPU,
memory and PIDs controllers only. It is evidence-supported, but success on the
reported runner is **not yet verified**. Distinguish these possibilities:

* Missing nested delegation/enabling: strongest source-supported explanation;
  new setup checks controller availability, relocates processes, enables controllers
  and fails closed if the parent did not make them available or writable.
* Namespace: explicitly require private outer cgroup namespace and verify it in
  workflow inspect; setup requires `/proc/self/cgroup` to be `0::/`. No host
  namespace fallback or host cgroup bind mount is used.
* Driver: explicitly select cgroupfs for this shell-PID1 container without systemd.
  The old logs do not show the selected driver, so a driver mismatch is not claimed
  as proven. New diagnostics report the selected driver and required controllers.
* Runtime incompatibility: no direct evidence of an incompatible binary; observed
  runc is recent. No version downgrade or runtime substitution is justified yet.

Changes: cgroup_setup.py performs bounded process migration/EBUSY retries and
controller checks; entry.sh invokes it before dockerd and selects cgroupfs;
prepare_context.py includes the new file; the rehearsal workflow explicitly sets
and verifies `--cgroupns private`; harness diagnostics add bounded controller/driver
fields; related regression tests cover ordering and fail-closed behavior.

After loading the fixture base, a fresh network-none probe container must read back
memory.max=67108864, pids.max=32 and cpu.max with a half-CPU quota. The ready marker
is created only after these assertions succeed. The probe has no bind mounts,
socket, credentials or external network. This verifies kernel limits rather than
only trusting Docker configuration. Existing Compose limits and service
healthchecks are unchanged.

Security impact: only the already privileged disposable container's cgroup subtree
is reorganized. Cgroup enforcement is required, not disabled. Outer network-none,
empty Mounts, private cgroup namespace, no host socket and no deployment credentials
remain enforced. This remains a trusted-code harness on a disposable GitHub-hosted
VM; privileged mode is not a hostile-code sandbox. No production helper or live
Compose configuration changed, and no workflow was dispatched.

Local validation: rehearsal 15 passed/1 POSIX skip; backup/restore 10 passed/1 Windows
symlink skip. Workflow safety assertions and whitespace check passed. These checks
cannot simulate kernel cgroup delegation; Docker/Linux is unavailable locally.

Next verification, after separately authorized publication: Actions → Disposable
TEST pipeline rehearsal → Run workflow → select reviewed published ref → check
approve_fixture_recovery=true. Require the cgroup nesting-ready message, kernel
enforcement probe success and all three scenario/recovery results. On failure,
inspect cgroups.available/enabled/driver and the sanitized state_error/daemon_tail
before changing anything further. Missing controllers require investigation of
parent delegation; a failed write must not be bypassed. Full success remains pending.

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
