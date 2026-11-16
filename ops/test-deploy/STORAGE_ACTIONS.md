# Phase 6F.3 Actions review and execution

Status: implemented and locally validated; **not committed, pushed, dispatched or
executed on Linux**. The real VPS and deployment gates remain untouched.

Workflow: `.github/workflows/rehearse-test-storage.yml`, display name
**Phase 6F.3 disposable storage rehearsal**. Trigger: manual only. Default recovery
approval is false; each job refuses without explicit approval. Four independent
`ubuntu-24.04` jobs, fail-fast disabled, 35-minute timeout per job:
`success`, `before-cutover`, `interrupted-cutover`, `failed-startup`.

## Immutable reviewed input

The workflow runs the binary source snapshot at
`ops/test-deploy/review-artifacts/phase6f3-storage-review.tar.gz`, SHA256:

```text
7928a63a75a943f15acd8d1a4962ef0a3f711632acf9f8009cbf16e16b692d88
```

It does not rebuild a package from checkout or accept a URL/user-provided digest.
Both shell and the verifier pin the digest. Before extraction, the verifier checks
all internal entries, all internal hashes and both subordinate artifact manifests;
it refuses links, duplicate/traversal names, extra entries and existing destinations.
The Git binary attribute prevents LF conversion of the tar.gz. This 79,259-byte
snapshot remains unmodified. Checkout changes do not silently change what is tested.
To change the rehearsal, review a new archive and deliberately update both pins.

The native-only Dockerfile is used directly, not the packaged sequential launcher.
The matrix runs one scenario per fresh daemon so a failure cannot cancel the other
scenarios. No Compose adapter is installed. Native normalization may still be
rejected by strict validators; that must produce FAIL, not a relaxed model. The
packaged Compose version is not necessarily the VPS's reported 5.7.0. PASS here is
not proof of native VPS compatibility or real EF/application acceptance.

The prior runbook's four cases were reviewed against the packaged source: real
fictional SQLite/upload backup and copy, same-image check, pre-cutover collision,
actual SIGKILL after backend startup, startup fault and explicit old-pair recovery.
The synthetic PROD container/volume/network are compared after each completed case.
Recovery is verified from the packaged report AND the recovered journal stage;
the fixture itself checks health/images/content before writing success.

## Isolation and evidence

Only repository contents read permission is granted. Checkout does not persist its
token. There is no deployment environment, repository secret reference, SSH action,
VPS address, self-hosted runner, gate write or deployment invocation. The outer box
has no network, mounts or host Docker socket; its private cgroup namespace and CPU/
memory/PIDs enforcement are retained. Privileged DinD is confined to a disposable
GitHub-hosted runner. Builds fetch public base images/packages before isolation;
the source digest does not pin those upstream build inputs.

Actions receive a default-deny JSON summary per scenario. PASS requires successful
execution, native validation, same images, pair verification, synthetic PROD
preservation and recovery evidence where applicable. Missing/malformed evidence or
a skipped test produces FAIL. Only fixed keys, boolean outcomes, scenario names,
strict version syntax and selected known rejected option names are published.
Raw build/daemon logs, command stderr, configuration, DB/upload data and arbitrary
exception messages are not uploaded. Evidence artifacts are retained for 14 days.
Cleanup runs after collection/upload and removes only the labelled outer box.
Job cancellation before evidence upload can leave no artifact; treat it as incomplete.

## Local validation

The full local suite ran 124 tests: 122 passed, two platform-specific skips.
Six added Actions tests cover exact extraction, tampered package rejection, internal
hash/traversal rejection, each scenario's result/recovery requirements, missing or
hostile evidence and workflow isolation. Actionlint 1.7.7 was downloaded from its
official release and verified against its published checksum; workflow validation
passed. Shellcheck was unavailable; Bash syntax is checked separately. No runtime
dependency was added. Linux/Docker execution remains NOT EXECUTED.

## PR review and registration gate

Proposed PR title: **Run the pinned Phase 6F.3 storage rehearsal on GitHub-hosted Ubuntu**.
Use `PR_PHASE6F3_STORAGE_ACTIONS.md` as the PR body. Base: `test-deploy`.
The proposed commit contains eight paths. On `feature/native-compose-diagnostics`,
after explicit publishing approval, use this path list from the repository root to
leave earlier installation work out of the PR:

```powershell
git add -- .gitignore .gitattributes .github/workflows/rehearse-test-storage.yml ops/test-deploy/review-artifacts/phase6f3-storage-review.tar.gz scripts/storage_actions.py scripts/tests/test_storage_actions.py ops/test-deploy/STORAGE_ACTIONS.md ops/test-deploy/PR_PHASE6F3_STORAGE_ACTIONS.md
git diff --cached --name-status
git diff --cached --check
```

Confirm exactly those eight files and the pinned hash, then commit with the PR title,
push `feature/native-compose-diagnostics` to origin, and open a PR into `test-deploy`.
Review the Files changed tab against that list before merging.

### Default-branch registration

In GitHub, inspect the repository default branch at
`.github/workflows/rehearse-test-storage.yml`. The local `origin/main` snapshot
has no such file. GitHub requires the workflow on the default branch for manual
dispatch ([GitHub workflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)).
If absent, obtain separate authorization for a one-file registration PR against
the default branch before making any change there. Use the same filename, workflow
name, manual trigger and boolean input as the reviewed workflow. Give the registration
stub `permissions: {}` and a single job with `if: ${{ false }}`, `runs-on: ubuntu-24.04`
and one inert `run: echo registration` step. It needs no checkout, archive, secrets
or deployment environment. Review and merge that registration separately. Select
`test-deploy` for the actual run. While a default-branch change is out of scope
and registration is absent, dispatch remains blocked.

## Exact operator steps after separate approvals

1. Review the PR candidate, immutable archive hash, Actions permissions and existing
   uncommitted changes. Authorize commit/push/PR creation separately; this task does
   not do them. Review/merge into `test-deploy` through normal controls.
2. Verify the dedicated workflow's default-branch registration. If unavailable,
   stop at the registration gate above; do not touch main without authorization.
3. Confirm repository `TEST_DEPLOY_ENABLED` remains absent/false. Do not connect to
   the VPS just to run this rehearsal; it consumes no VPS state or credentials.
4. Once dispatch is separately authorized and registration is available: GitHub →
   MTZBRN/CarServiceApp → Actions → **Phase 6F.3 disposable storage rehearsal** →
   Run workflow → select the reviewed `test-deploy` ref → check
   `approve_fixture_recovery` → Run workflow. All four scenarios run automatically.
5. Record run URL, head SHA, archive SHA and all four job outcomes. Read each summary
   and download `storage-<scenario>-<attempt>` JSON artifact. Require all four PASS,
   native validation and verified recovery for both recovery scenarios. Any FAIL,
   cancelled job or missing evidence is NO-GO. Preserve failed results for review.
6. Even four PASS results do not authorize migration. Source custody, effective live
   topology, disk budgets, actual VPS native Compose, maintenance approval, same-image
   real-app acceptance and installed post-cutover preflight remain separate gates.

Files introduced by this Actions change: workflow, pinned archive, verifier/reporter,
six regression tests, this guide and PR draft. `.gitattributes` gains only the archive
binary exception and .gitignore admits the single pinned archive. Existing deployment workflow and the reviewed archive are unchanged.

## Operator checkpoint — 2026-11-16

Remote default `main` at `aed0cb1b0d2692b231b7de509394214b7703a0b9` lacks the workflow.
The fetched `test-deploy` tip and local HEAD both equal
`6a7e358c80c1dce981743257fe049cd7e5b8aa11`. The separate one-file registration
candidate is prepared locally at `test-results/registration/.github/workflows/rehearse-test-storage.yml`
for a later, separately authorized PR. Both YAML files passed actionlint.

After explicit publication approval, commit only the eight paths above with the
proposed title, push the feature branch to origin, then use GitHub's Compare &
pull request with base `test-deploy` and the supplied PR body. Register the
same filename using the inert candidate only with separate default-branch
approval. Publication, merges and dispatch have not taken place.

For the independent VPS metadata step, run the existing `CHECK_CUTOVER.ps1
-GitHubGateConfirmedDisabled` in the operator's normal Windows PowerShell after
checking the GitHub variable. For native Compose, after the new bundle and a
private candidate environment have been separately staged and verified, run:

```powershell
ssh -tt -o BatchMode=yes gta-test 'sudo -k -- /usr/bin/python3 -I -B /root/carservice-test-migrate-6f3/review/scripts/test_compose_native.py check --compose /root/carservice-test-migrate-6f3/review/ops/test-deploy/docker-compose.test.yml --env-file /root/carservice-test-migrate-6f3/environment --project-directory /root/carservice-test-migrate-6f3/home'
```

Use a new root-private staging environment with fictional JWT values and verified
TEST addresses for this compatibility check. Final acceptance also needs the actual
reviewed runtime configuration. Keep real installation blocked pending Linux results,
native VPS validation, effective topology, custody, space and maintenance approval.
The working-tree Gate C/D execution sheet is in `MIGRATE_TEST_STORAGE.md`.
Install only independently verified helpers, frozen config, a read-only source
mirror and verified gh. Use `carservice-test-ci` only with the reviewed forced
command and no-argument sudo grant. The installed preflight must pass on new mounts.

For future release authorization, the existing `deploy-test.yml` requires the
protected exact `test-deploy` tip and successful push CI. Restrict environment
`isolated-test` to that branch with operator review. Its host variable is
`TEST_SSH_HOST`; its secrets are `TEST_DEPLOY_KEY` and pinned `TEST_KNOWN_HOSTS`.
The authorization job uses Actions/contents read. Repository `TEST_DEPLOY_ENABLED`,
server `actions-enabled` and a root-owned exact-revision approval are separate
activation controls. Keep them inactive during preparation. After a separately
approved release, verify both running image IDs and revision labels against the
approved full SHA, schema history, application health and the private journal.
