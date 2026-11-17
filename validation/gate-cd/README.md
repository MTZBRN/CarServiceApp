# Gate C/D candidate validation package

## Provenance and comparison

Both original VPS-created ZIPs are now preserved as extracted, unchanged packages.
Documents and operator commands inside them are reference material, not execution
authorization. No supplied operational launcher has been executed.

| Input | ZIP bytes | ZIP SHA-256 | Verified payloads |
| --- | ---: | --- | ---: |
| `carservice-gate-c-package.zip` | 39448 | `34573c42d359ea3d6b3035acb30dc167cbf7076b29aff7d242e4e04e43995469` | 8 |
| `carservice-gate-d-package.zip` | 41857 | `9e73694c924bb22c1e103895c4d04f1e01b147e843c5562cc0555c6ad8bf9cde` | 11 |

All original manifest SHA-256 hashes AND byte counts were checked directly in each
ZIP before extraction/use, then checked again after extraction. Original manifests
are themselves pinned by `verify_candidate.py`: C is
`6815f456f198d9c14123ef57b32e9ced4d48e57ece7b0513376196cff2e452ea`, D is
`a4516d46f00cf53fe75367d42279b95241a0a5ffcc9fc886bfdc8a84f1c8afcd`.
Git attributes disable byte conversion in both candidate directories.

**Comparison: no differences.** Original C `gate-c.py` and the dependency in D
are byte-for-byte identical: 32710 bytes, SHA-256
`f05282c07805c251b52bb6541320bbfa376759a92e9f4a1fd2fdbdf8a02a4e4e`.
Neither copy was replaced. D `gate-d.py` remains 31451 bytes, SHA-256
`4dd7435c6d26578724d65e281c28c4a7cc4e5e524db7aaf8295a6a8ecb714315`.
The D fixture helper remains SHA-256
`90ddda01a6aba871c10441900506889d819571069d03f2d764c867ca9940f2dc`.
No candidate defect requiring a byte change was identified by local static checks.
Fingerprints establish consistency with the supplied packages, not independent
publisher authentication.

## Exact available files

Initial PR #19 inventory: no original C/D package was present in the workspace;
D was imported in the first PR commit. C has now been supplied separately. The
previous missing-package blocker is resolved. The review worktree remains
`C:\CarServiceApp\gate-d-review`, branch `review/gate-d-disposable-validation`.
No VPS was contacted or server path inspected.

`validation/carservice-gate-c/` now contains:

| File | Bytes |
| --- | ---: |
| `FILE-FINGERPRINTS.txt` | 768 |
| `CHANGES-AND-TESTS.md` | 6318 |
| `GATE-C-EXECUTION.md` | 25612 |
| `GATE-D-PREPARATION.md` | 8382 |
| `gate-c-approval.template.json` | 874 |
| `gate-c-recovery.template.json` | 793 |
| `gate-c.py` | 32710 |
| `test_gate_c.py` | 25911 |
| `test_gate_c_docker.py` | 10444 |

`validation/carservice-gate-d/` retains:

| File | Bytes |
| --- | ---: |
| `FILE-FINGERPRINTS.txt` | 1044 |
| `OPERATOR.md` | 21464 |
| `gate-c.py` | 32710 |
| `gate-d.py` | 31451 |
| `ops_storage.fixture.py` | 13686 |
| `test_gate_d.py` | 17310 |
| `cutover.template.json` | 694 |
| `accept.template.json` | 866 |
| `acceptance-evidence.template.json` | 343 |
| `old-path-recover.template.json` | 889 |
| `forward-capture.template.json` | 848 |
| `resume-new.template.json` | 869 |

The manifests provide all original payload hashes. All supplied templates remain
unfilled; no approvals, customer data, runtime environments or secrets are invented.

## Workflow and disposable checks

`.github/workflows/validate-gate-cd-candidate.yml` runs only on manual
`workflow_dispatch`, using `ubuntu-24.04`, `contents: read`, and checkout without
persisted credentials. No existing deployment/rehearsal workflow is modified.
No deployment environment, VPS, SSH, PROD/STAGING access, secrets or deployment
activation is used. This extends the PR's validation harness, not CI/CD architecture.

After verifying both complete inventories and C-copy equality, it runs:

1. Original `test_gate_c.py`: 32 unit tests (mocked Docker, fictional SQLite).
2. Original `test_gate_d.py`: 34 unit tests (mocked lifecycle, real fictional
   SQLite/backup/restore/materialization).
3. Original `test_gate_c_docker.py` against its required empty dedicated daemon:
   actual running/frontend-stopped/both-stopped metadata, frontend-only and
   both-container recovery, and wrong-network/image/container-ID refusal. Its
   source/custody/admission checks are explicitly mocked by the delivered test.
4. The PR's `docker_validation.py`: actual candidate functions with native Compose
   config, wrong-image/network refusal, exact stop order, real fictional paired
   backup/restore, exclusive materialization, UID 1654 ownership/access and owner
   reader credential drop, backend-first new-layout startup/resume with health,
   stable data comparison, and the accepted-authority recovery barrier.

`disposable_daemon.py` creates a fresh root-private
`/tmp/carservice-gate-c-docker-<run>-<attempt>/docker.sock` and separate data/exec
roots. The daemon is labelled `carservice.gate-c.fixture=true`, has no default
bridge and disables host iptables/forwarding changes; fixture networks are internal
bridges with only fictional containers. No candidate uses the default runner
socket. The wrapper preloads only the public Python image saved by the runner's
preparation step; tests use its immutable local SHA-256 ID and never pull release
images. C's original driver verifies the socket ownership/mode, daemon label/data
root and empty state. D checks the same daemon identity and empty container set.

C's own driver cleans its exact labelled containers/network before D begins.
D's harness uses unique run labels/project and private fictional files under
`/var/lib/gate-cd-fixture-<run>-<attempt>`, with two fixture binds and no Docker
socket inside containers. Its candidate functions are unchanged; only fixture
resource/path/image/container constants are rebound in memory. UID/GID remains
1654 and frontend publication remains loopback-only.

The wrapper stops its exact private daemon in `finally`; an `always()` step
retries shutdown with PID/command identity checks. No shared daemon is signalled,
no prune is used, and no broad filesystem deletion is performed. Residual fixture
files and daemon logs stay on the ephemeral runner until GitHub destroys it.
Cancellation/runner loss can bypass cleanup, but no external resources persist.
C's full fictional report stays in its private temporary directory; selected
checks/status and D's result/version information appear in the job log.

## Results and review status

Local checks passed: both full package fingerprints/sizes and pinned manifests;
C byte equality; Python AST parsing (10 sources); original suite counts (32/34);
all 8 JSON templates parse with unapproved flags; fingerprint refusal for modified,
missing and extra payloads/manifests in both packages; workflow trigger, runner,
permissions, test wiring, private-socket and cleanup static assertions; and
`git diff --check`. Staged and published candidate bytes are compared to the
verified inputs before publication.

**Not run locally:** the 66 Linux unit tests (candidate uses Linux `fcntl`/fork
facilities), original real Docker suite and D Compose/storage checks. This Windows
workspace has no Docker CLI. Previous PASS claims inside delivered documents are
historical supplier results, not results obtained here. No workflow was dispatched.

The PR contains the complete supplied C/D validation package and is ready for
human code review and merge as a manual validation workflow. Runtime success is
pending the first GitHub-hosted run; this is not deployment readiness or approval.
Coverage remains fixture-scoped: no full live CLI cutover/acceptance/forward repair,
installed preflight, custody proof or real release-image migration is claimed.

## Exact next action

After human review, a human merges PR #19 to `main`. Then open GitHub **Actions →
Gate C-D candidate disposable validation → Run workflow**, select `main` containing
the reviewed merge, and confirm **Run workflow**. No inputs or secrets are needed.
This is the validation workflow, not the TEST deployment workflow. GitHub requires
manual-dispatch workflows to exist on the default branch; see
[workflow dispatch documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatch).

Review all unit/lifecycle step conclusions before treating the validation as PASS.
A successful fictional run supplies review evidence only; pipeline activation and
any operational Gate C/D execution still need their separately reviewed inputs
and explicit human authorization. This PR never activates deployment.
