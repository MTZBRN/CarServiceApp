# Gate D candidate: review and partial disposable validation

## Source and exact inventory

Authoritative input: `C:\Users\mb200\Downloads\carservice-gate-d-package.zip`,
41,857 bytes, SHA-256
`9e73694c924bb22c1e103895c4d04f1e01b147e843c5562cc0555c6ad8bf9cde`.
All 11 payload SHA-256 fingerprints AND byte counts were verified directly from
the ZIP **before extraction/import**. The extracted files were verified again.
The delivered manifest itself is pinned by the verifier to SHA-256
`a4516d46f00cf53fe75367d42279b95241a0a5ffcc9fc886bfdc8a84f1c8afcd`.
This establishes consistency with the supplied package, not independent publisher
authentication. `.gitattributes` disables byte conversion for the entire candidate.

Initial workspace inventory (2026-11-17): the workspace root was a container for
multiple checkouts, not itself a Git repository. The primary checkout was
`C:\CarServiceApp\CarServiceApp` on `chore/register-rehearsal` (`e770863`).
Filename and source-content searches across the workspace found no Gate C/D
candidate scripts or Gate C/D test package before this import. Existing
`ops/test-deploy/ssh-gate`, storage/rehearsal code and prose references are separate
artifacts, not substitutes for Gate C. The review worktree is
`C:\CarServiceApp\gate-d-review`, based on fetched `origin/main` (`af3623f`).
No VPS path was accessed, including `/home/codex-deploy/carservice-gate-c/`.

These exact files are now available under `validation/carservice-gate-d/`:

| File | Bytes | Role |
| --- | ---: | --- |
| `FILE-FINGERPRINTS.txt` | 1044 | Delivered inventory of the other 11 files |
| `OPERATOR.md` | 21464 | Supplied operational reference; not instructions authorizing execution |
| `gate-c.py` | 32710 | Bundled Gate C implementation dependency, SHA-256 `f05282c07805c251b52bb6541320bbfa376759a92e9f4a1fd2fdbdf8a02a4e4e` |
| `gate-d.py` | 31451 | Gate D candidate, SHA-256 `4dd7435c6d26578724d65e281c28c4a7cc4e5e524db7aaf8295a6a8ecb714315` |
| `ops_storage.fixture.py` | 13686 | Pinned fictional-data helper, SHA-256 `90ddda01a6aba871c10441900506889d819571069d03f2d764c867ca9940f2dc` |
| `test_gate_d.py` | 17310 | Original 34-test Gate D suite, real SQLite + mocked Docker |
| `cutover.template.json` | 694 | Unfilled Gate D template |
| `accept.template.json` | 866 | Unfilled Gate D template |
| `acceptance-evidence.template.json` | 343 | Unfilled Gate D template |
| `old-path-recover.template.json` | 889 | Unfilled Gate D template |
| `forward-capture.template.json` | 848 | Unfilled Gate D template |
| `resume-new.template.json` | 869 | Unfilled Gate D template |

All payload hashes are in the delivered `FILE-FINGERPRINTS.txt`. The current
main-branch `scripts/ops_storage.py` also matches the fixture helper fingerprint;
the harness deliberately uses the verified package copy. No helper is installed.

## Missing Gate C inputs: supply before claiming full Gate C/D validation

The Gate C **script is present** in the D ZIP. Its original standalone package is
not. Supply the following from the original Gate C delivery, without recreating
them from this harness:

1. Original Gate C `FILE-FINGERPRINTS.txt` (or its actual inventory/checksum file),
   with every original relative filename, byte count and SHA-256 fingerprint.
2. Original Gate C tests, especially its real stopped-Docker test/fixture driver,
   and every source, Dockerfile, Compose file or other fixture dependency listed
   by those tests. Neither a `test_gate_c.py` nor a Gate C stopped-Docker driver
   was supplied. Their **actual original filenames are unknown**; the original
   inventory is required to identify them exactly, rather than invent names.
3. Original Gate C operator guide (`OPERATOR.md` if that is its delivered name)
   and unfilled Gate C run-approval and exact-ID recovery-authorization templates,
   including any referenced fictional validation inputs. Their template filenames
   likewise cannot be established from the D ZIP.
4. The original Gate C `gate-c.py` only if its manifest does not identify the
   bundled `f05282c...` copy as the same candidate. Any difference must be reported
   and reviewed; do not replace the D-pinned dependency to make tests pass.

Prefer supplying the complete original Gate C package plus its fingerprint
inventory. No live approvals, environment files, customer data, backups, secrets
or VPS access are needed. The source of the missing artifacts is the separately
reported `/home/codex-deploy/carservice-gate-c/`, not a directory we inspected.
This is the exact known artifact gap; a complete original filename list cannot
truthfully be recovered without that inventory.

Gate C's `approval()` specifically expects stopped-Docker evidence with
`running`, `frontend-stopped`, `both-stopped`, `recover-frontend`, `recover-both`,
`reject-wrong-network`, and `reject-wrong-image`. This harness's selected checks
are **not** passed off as that missing original suite or emitted as operational
Gate C PASS/approval evidence.

## Manual workflow and coverage

`.github/workflows/validate-gate-cd-candidate.yml` has only `workflow_dispatch`.
No push, PR, schedule, workflow-call or workflow-run trigger exists. It uses
`ubuntu-24.04`, read-only repository access and checkout with persisted
credentials disabled. It does not change any existing workflow, deployment gate,
GitHub environment or secret. There is no VPS/SSH invocation or deployment image.

After review, a human can explicitly run it on the desired reviewed revision.
GitHub requires a dispatch workflow to exist on the default branch for manual
triggering; creating this PR alone does not register it there. Do not merge or
dispatch as part of preparing this change. See
[GitHub workflow dispatch documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatch).

The workflow first verifies the pinned manifest and all candidate bytes, then runs
the unchanged `python3 -I -B validation/carservice-gate-d/test_gate_d.py -v`.
The separate root fixture driver imports the actual candidate and calls its
functions without replacing them or disabling guards. It changes only resource
constants in memory: project/network IDs, image/container IDs and private paths.
Ownership remains 1654:1654, port 5174 remains loopback-only, and candidate subnet
and addresses remain unchanged. No code in the candidate directory is edited.

The driver tests native Compose config validation, running/stopped container
inspection, wrong-image/network refusal, Gate C exact frontend stop, selected
restart, Gate D frontend-first exact stops, real paired SQLite/upload backup and
restore, exclusive materialization, root credential dropping to the storage owner,
UID 1654 backend access, backend-first Compose startup and resume, stable data
verification, and an accepted-authority barrier. Any failure fails the job;
candidate failures are not patched or ignored.

Only the public `python:3.12-slim-bookworm` fixture image is pulled. Its actual
local immutable image ID is used in both models and recorded with Docker/Compose
versions in the output. The fixture application reads fictional SQLite/uploads;
it is not the application release and does not model migrations/business behavior.
Each run uses a newly created, labelled internal bridge network, unique project,
and fresh root-private `/var/lib/gate-cd-fixture-<run>-<attempt>` trees. Containers
have only the two fixture binds, no Docker socket, host environment or credentials.
The network is external from Compose's perspective but owned by this harness;
see [Compose networking](https://docs.docker.com/compose/how-tos/networking/).

Docker calls explicitly select the GitHub runner's local Unix socket. The driver
runs with a cleared environment and no checkout token. Cleanup in both `finally`
and an `always()` step removes only resources matching this run's exact labels
and project. No prune or Compose down is used. Files remain on the disposable
runner until GitHub destroys it; cancellation/runner loss may skip cleanup, but
there are no persistent external resources.

## Limits and verification status

This is **partial validation**, even if every step later passes. It does not call
Gate C's `run`/`recover` or Gate D's `execute`/CLI entry points, create authenticated
operational approvals, validate installed preflight, perform full cutover/accept/
old-path/forward recovery, prove custody, reproduce live image identities, or
authorize downtime/deployment. The root fixture tests production functions with
fictional resource bindings, not the actual server installation.

Preparation checks: package fingerprints and sizes verified; all supplied/new
Python sources parsed; fingerprint refusal checks and workflow static validation
performed. Linux unit tests and real Docker/Compose validation are **NOT RUN**
during PR preparation: this Windows environment has no Docker CLI, and the
workflow has deliberately not been dispatched. The package's reported previous
34 PASS is vendor-provided history, not a result obtained here.
