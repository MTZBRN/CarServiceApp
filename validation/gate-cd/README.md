> Latest hosted run 44143882754: all 8 Gate C Docker checks PASS; Gate D passed
> Compose/identity/stop checks, then failed in its owner reader. The diagnosed
> fix and local Linux regressions are documented in
> [the owner-reader investigation](FAILURE-44143882754.md). Full hosted D success is pending.

# Gate C/D candidate validation package

## Provenance and comparison

Both original VPS-created ZIPs were verified on import. The Gate C Docker test
now has a documented fixture-only correction; operational Gate C now includes the reviewed mount-order correction. See FAILURE-44136402143.md for provenance and verification limits.
Documents and operator commands inside them are reference material, not execution
authorization. No supplied operational launcher has been executed.

| Input | ZIP bytes | ZIP SHA-256 | Verified payloads |
| --- | ---: | --- | ---: |
| `carservice-gate-c-package.zip` | 39448 | `34573c42d359ea3d6b3035acb30dc167cbf7076b29aff7d242e4e04e43995469` | 8 |
| `carservice-gate-d-package.zip` | 41857 | `9e73694c924bb22c1e103895c4d04f1e01b147e843c5562cc0555c6ad8bf9cde` | 11 |

All original manifest SHA-256 hashes AND byte counts were checked directly in each
ZIP before extraction/use, then checked again after extraction. Current manifests
are themselves pinned by `verify_candidate.py`: C is
`a8d648c2316de103409578a998be8c52c07fc1f4b433f02647f2cd17a4d9a166` (updated test inventory), D is
`ba09e1aa63feaabc77b94c8e639aef99d6ad000ba66b741d32cdffd22a495201`.
Git attributes disable byte conversion in both candidate directories.

**Current C-copy comparison: no differences.** C `gate-c.py` and the dependency in D
are byte-for-byte identical: 33241 bytes, SHA-256
`a0fae6538c6b64e4160041c274cc4f8662e38e93b677504f867026f0f8208989`.
Both C copies carry the same earlier correction and are unchanged by the owner-reader fix.
The corrected D `gate-d.py` is 33802 bytes, SHA-256
`6d32022d499bd7dc6d55dcb0223f346737e8b8f283100040e73b718fe32c67fe`.
The D fixture helper remains SHA-256
`90ddda01a6aba871c10441900506889d819571069d03f2d764c867ca9940f2dc`.
Candidate corrections and their fingerprint changes are explicitly documented in
the failure reports. Current fingerprints establish reviewed-byte consistency;
original ZIP hashes establish import provenance, not publisher authentication.

## Exact available files

Initial PR #19 inventory: no original C/D package was present in the workspace;
D was imported in the first PR commit. C has now been supplied separately. The
previous missing-package blocker is resolved. The current review worktree is
`C:\CarServiceApp\gate-c-fix`, branch `fix/gate-c-stopped-snapshot` (PR #21).
No VPS was contacted or server path inspected.

`validation/carservice-gate-c/` now contains:

| File | Bytes |
| --- | ---: |
| `FILE-FINGERPRINTS.txt` | 768 |
| `CHANGES-AND-TESTS.md` | 6623 |
| `GATE-C-EXECUTION.md` | 25612 |
| `GATE-D-PREPARATION.md` | 8382 |
| `gate-c-approval.template.json` | 874 |
| `gate-c-recovery.template.json` | 793 |
| `gate-c.py` | 33241 |
| `test_gate_c.py` | 27182 |
| `test_gate_c_docker.py` | 10785 |

`validation/carservice-gate-d/` retains:

| File | Bytes |
| --- | ---: |
| `FILE-FINGERPRINTS.txt` | 1044 |
| `OPERATOR.md` | 23501 |
| `gate-c.py` | 33241 |
| `gate-d.py` | 33802 |
| `ops_storage.fixture.py` | 13686 |
| `test_gate_d.py` | 18178 |
| `cutover.template.json` | 694 |
| `accept.template.json` | 866 |
| `acceptance-evidence.template.json` | 343 |
| `old-path-recover.template.json` | 889 |
| `forward-capture.template.json` | 848 |
| `resume-new.template.json` | 869 |

The manifests provide current payload hashes; the original test/manifest hashes
are retained in the failure report. All supplied templates remain
unfilled; no approvals, customer data, runtime environments or secrets are invented.

## Workflow and disposable checks

`.github/workflows/validate-gate-cd-candidate.yml` runs only on manual
`workflow_dispatch`, using `ubuntu-24.04`, `contents: read`, and checkout without
persisted credentials. No existing deployment/rehearsal workflow is modified.
No deployment environment, VPS, SSH, PROD/STAGING access, secrets or deployment
activation is used. This extends the PR's validation harness, not CI/CD architecture.

After verifying both complete inventories and C-copy equality, it runs:

1. Original `test_gate_c.py`: 34 unit tests (mocked Docker, fictional SQLite).
2. `test_gate_d.py`: 36 unit tests (mocked lifecycle, real fictional
   SQLite/backup/restore/materialization). The added `test_owner_reader.py` runs
   10 root/UID-1654 regressions, including private ancestors, WAL/SHM, upload
   permission failures and sanitized errors, before Docker starts.
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
socket inside containers. It executes the fingerprint-verified candidate functions. A fixture-only inspect adapter
requires an internal network and its original exact IPAM before requiring an empty
endpoint gateway, as Docker internal bridges provide. Other fixture
resource/path/image/container constants are rebound in memory. UID/GID remains
1654 and frontend publication remains loopback-only.

The wrapper stops its exact private daemon in `finally`; an `always()` step
retries shutdown with PID/command identity checks. No shared daemon is signalled,
no prune is used, and no broad filesystem deletion is performed. Residual fixture
files and daemon logs stay on the ephemeral runner until GitHub destroys it.
Cancellation/runner loss can bypass cleanup, but no external resources persist.
On a successful run, download `gate-c-docker-pass-<run-id>-<attempt>` from
**Artifacts** on the run summary. It contains the original
`gate-c-docker-report.json` with the tested Gate C SHA-256, the private Docker
Engine version, the PASS result and all lifecycle observations. The job checks
those evidence fields before upload and preserves the original report bytes.
Selected checks and status also appear in the job log.

## Results and review status

Run 44143882754 passed all 8 Gate C Docker checks, native Gate D Compose models,
image/network rejection and the initial frontend/both-container stop sequence.
It failed at the first Gate D owner read; the later storage lifecycle was not
reached. The latest correction reproduces and fixes that failure locally on
Ubuntu 24.04/Python 3.12. See the linked investigation for exact evidence.

The corrected reader passes 10 real root/credential-drop regressions. All 36
Gate D unit tests pass locally both as an unprivileged Linux user and as root.
A private Docker 28.0.4 daemon with the runner's exact public fixture image
reproduced original FAIL / corrected PASS after container exit. Gate C is unchanged
and was not rerun locally. Fingerprints, byte sizes, launcher bindings, Python
syntax, JSON templates and manual-only workflow restrictions are checked before
publication. Local evidence does not claim the full hosted workflow is GREEN.

The complete supplied C/D validation package is present in PR #21 for human
review. This is not deployment readiness or approval. Coverage remains fictional:
no live CLI cutover/acceptance/forward repair, installed preflight, custody proof
or real release-image migration is claimed.

## Exact next action

Open GitHub **Actions → Gate C-D candidate disposable validation → Run workflow**,
select **`fix/gate-c-stopped-snapshot` at the updated PR #21 tip**, and confirm
**Run workflow**. No inputs or deployment secrets are needed. Rerunning the old
failed job tests the old commit. Require the new owner-reader regression step and
all C/D Docker/Compose/storage steps to pass. This manual validation workflow
already exists on the default branch; deployment workflows remain untouched.
