# Corrected Gate C and independent recovery — NOT APPROVED FOR VPS EXECUTION

`gate-c.py`: **32,710 bytes**, SHA256:

```text
f05282c07805c251b52bb6541320bbfa376759a92e9f4a1fd2fdbdf8a02a4e4e
```

This replaces the older 23,274-byte script with fingerprint `5b235d7822f336873f602ca29e24ccb9a747cdd7f42b07afee55914e3f942686`. Do not use the older launcher. These corrections do not authorize execution. Both approval templates remain unapproved. No VPS, shared Docker daemon or application data was accessed during this correction.

Contract: [MIGRATE_TEST_STORAGE.md at merged commit 5200ede3b9dee3cfa7d5d4ad697029f445d91264](https://github.com/MTZBRN/CarServiceApp/blob/5200ede3b9dee3cfa7d5d4ad697029f445d91264/ops/test-deploy/MIGRATE_TEST_STORAGE.md). Installed `/usr/local/sbin/ops_storage.py` must still hash to `90ddda01a6aba871c10441900506889d819571069d03f2d764c867ca9940f2dc`. Its existing algorithms are unchanged; verified bytes are compiled in memory under isolated Python.

## Accepted evidence and exact identities

Carry forward exact-SHA push CI SUCCESS, Phase 6F.3 4/4 PASS, native Compose VPS staging PASS, installed/verified inactive artifacts, installed isolated mirror, healthy historical TEST pair, verified network, capacity PASS and Docker-overlap PASS. Do not repeat infrastructure audits. Immediate identity/admission checks before disruption remain mandatory.

| Item | Pinned input |
|---|---|
| Merge | `5200ede3b9dee3cfa7d5d4ad697029f445d91264` |
| TEST project | `carserviceapp-test` |
| Backend ID | `54711d72a221cc11f51621e5729cd97944885b83309059a6fc6fac9cafe8223a` |
| Backend image | `sha256:352a129e796973753451b7eaa86b7acaf85c93f33e41b3ade5607b79bf534d05` |
| Frontend ID | `1d43ef14056134965e33f95153d0cec5de45f4b5c25380c08a5ae06d8a134696` |
| Frontend image | `sha256:baa2fe08115174dce95caba06ab391e6d6b153a2babf5829a545698c3847f761` |
| Network | `carserviceapp-test_workshop` |
| Network ID | `6e4eaf575df61b771a31e7cadae785dd345a3f3ebae9b999e7c51c7524be9469` |
| Subnet/gateway | `172.30.91.0/24` / `172.30.91.1` |
| Backend/frontend IPs | `172.30.91.2` / `172.30.91.3` |
| Publication | Frontend only, `127.0.0.1:5174` → `8080/tcp` |
| Legacy TEST binds | `/opt/carserviceapp/test-data` → `/app/data`; `/opt/carserviceapp/test-uploads` → `/app/uploads`, RW |
| Legacy source roots | `1654:1654`, 0700 |
| Legacy parent | `/opt/carserviceapp`, `1000:1000`, 0750; account `deploy` controls renames |
| New namespace/backups | `/srv/carserviceapp-test`, `/srv/carserviceapp-test/backups`, root:root 0700 |
| Scratch parent | `/var/tmp/carservice-gate-c`, root:root 0700 |
| Scratch target | `/var/tmp/carservice-gate-c/carserviceapp-restore-test-gate-c` |
| Private journal | `/var/lib/carservice-test-deploy/gate-c`, root:root 0700, records 0600 |
| Operation lock | `/var/lib/carservice-test-deploy/gate-c-operation.lock`, root:root 0600, flock held throughout run/recovery |

The journal, namespace and scratch parent must initially be absent, including dangling links. No future live `data`/`uploads` leaves are created by Gate C. Refuse collisions, aliases/submounts and partial installations; never merge, delete or repair existing paths automatically.

Accepted source budget: 126,976 bytes. The documented aggregate additional reserve is `14 GiB + 5*S`: Docker/build 12 GiB, backup and scratch each `2*S + 1 GiB`, destination `S`. This yields 15,033,020,416 bytes at the accepted size. Existing source retention is already allocated. Execution rechecks TEST file metadata totals before/after stopping; no compression credit or invented separate-filesystem allowance.

Production backup configuration was confirmed to use intended production sources with no direct TEST reference. This is accepted configuration evidence, not proof of all possible writers. Do not inspect/change PROD/STAGING data, stop their backup services or change shared ingress.

## Readiness required BEFORE Gate C approval

Gate C deliberately leaves TEST stopped. **Do not approve Gate C while Gate D or verified old-path recovery is still being developed.** `GATE-D-PREPARATION.md` is a candidate sheet, not proof of readiness.

The Gate C approval must bind by exact hash:

1. A reviewed, actionable Gate D execution package: exact private new-path baseline/environment hashes, verified destination materialization code, same-image startup, acceptance checks and rollback boundaries. Gate D execution remains separately approved later.
2. A reviewed, verified old-path recovery procedure, including missing-capture and expired-original-window recovery, exact-image startup and incident boundaries. Possessing a baseline file alone does not establish recovery readiness.
3. A real disposable Docker metadata/recovery-lifecycle PASS report for these EXACT script bytes, reviewed for compatibility with the target Engine. Unit mocks cannot substitute. Such a report was NOT produced in this sandbox.
4. The private reviewed old-path baseline and SHA256.

Require named available operators, an approved window and a `decision_deadline_utc` strictly inside it, early enough for recovery. Before that deadline the decision-maker must choose the already prepared Gate D path or separately authorized recovery. The script refuses new Gate C phases after its decision deadline/window. In-progress helper work may finish after expiry, but must not trigger another phase or automatic restart. Budget stop, backup (SQLite phase up to five minutes), verification and recovery time. Never leave TEST down to develop Gate D.

## Gate C approval fields

Copy `gate-c-approval.template.json` to `gate-c-approved.json`. Resolve nulls from reviewed records; do not invent values.

| Fields | Required meaning |
|---|---|
| `gate` | Exactly `C-only` |
| `maintenance_reference` | Explicit same-image capture/restore approval; no application release |
| `custody_operator`, `recovery_decision_maker` | Named available people and authority |
| `window_start_utc`, `window_end_utc` | Approved UTC ISO timestamps, offset zero or `Z` |
| `decision_deadline_utc` | Approved decision deadline inside the window, allowing recovery |
| `old_path_baseline`, `old_path_baseline_sha256` | Reviewed root-private 0600 self-contained JSON baseline outside the mutable worktree, exact images, old binds/network/ports/hardening |
| `ingress_close_procedure`, `ingress_closed_verification`, `ingress_reopen_procedure` | Exact reviewed TEST-only steps, established-connection handling, local/direct backend bypass exclusion, verification and reversal |
| `writer_exclusion_and_custody_plan` | Continuous exclusion of unauthorized deploy/UID1000, UID1654, root/Docker, timers/jobs/private namespaces/external writers; no daemon restart/recreation; write-resumption authority |
| `max_upload_restore_bytes` | Reviewed positive expanded-upload bound; neither helper default 1 GiB nor paired budget is automatically approved |
| `gate_d_procedure`, `gate_d_procedure_sha256`, `gate_d_ready` | Root-private ready Gate D package and digest; true only after complete review/readiness |
| `old_path_recovery_procedure`, `old_path_recovery_procedure_sha256`, `old_path_recovery_verified` | Root-private verified recovery procedure and digest; true only with verification evidence |
| `stopped_docker_test_evidence`, `stopped_docker_test_evidence_sha256`, `stopped_docker_tests_verified` | Root-private real-harness PASS JSON, exact script hash/all required checks; review actual Engine compatibility |
| `github_gate_disabled_confirmed` | True only after confirming `TEST_DEPLOY_ENABLED` absent/false immediately before execution |
| `gate_c_approved` | True only after explicit approval and every readiness input above |

Referenced files must be root:root 0600 with trusted root-owned non-writable ancestors, no symlinks/hardlinks. The baseline is never executed by Gate C. No live environment capture is included. Server `actions-enabled`, deployment `approved.json`, `in-progress` and `deploy.lock` must be absent. The separate operation flock file may persist; never delete it to defeat a running operation.

No reviewed TEST ingress mechanism was supplied. Its exact closure/verification/reopen steps remain approval inputs, performed manually elsewhere, never eval'd from JSON. Loopback publishing alone is not closure. Do not improvise shared Caddy edits or PROD service stops. A journal lock or metadata scan is not exclusive custody over a UID1000-owned parent.

## Windows PowerShell → gta-test → interactive sudo

Only after complete review/readiness and Gate C approval, download the exact LF script and fill/review the separate approval. Do not overwrite an earlier remote candidate. Transfer only operator files to the SSH operator's home:

```powershell
$gateScript = Join-Path (Get-Location) 'gate-c.py'
$gateApproval = Join-Path (Get-Location) 'gate-c-approved.json'
$expected = 'f05282c07805c251b52bb6541320bbfa376759a92e9f4a1fd2fdbdf8a02a4e4e'
if ((Get-FileHash -LiteralPath $gateScript -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    throw 'STOP: script fingerprint mismatch'
}
if ((Get-Item -LiteralPath $gateScript).Length -ne 32710) { throw 'STOP: script length mismatch' }
$approvalHash = (Get-FileHash -LiteralPath $gateApproval -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output "Reviewed Gate C approval SHA256: $approvalHash"
ssh -o BatchMode=yes gta-test 'test ! -e "$HOME/gate-c-f05282c0.py" && test ! -L "$HOME/gate-c-f05282c0.py" && test ! -e "$HOME/gate-c-approved-v2.json" && test ! -L "$HOME/gate-c-approved-v2.json"'
if ($LASTEXITCODE -ne 0) { throw 'STOP: remote collision or SSH error' }
scp -o BatchMode=yes $gateScript 'gta-test:gate-c-f05282c0.py'
if ($LASTEXITCODE -ne 0) { throw 'STOP: script transfer failed' }
scp -o BatchMode=yes $gateApproval 'gta-test:gate-c-approved-v2.json'
if ($LASTEXITCODE -ne 0) { throw 'STOP: approval transfer failed' }
ssh -tt -o BatchMode=yes gta-test
```

At the remote prompt define this narrow launcher. Fresh interactive sudo authenticates each invocation. Root verifies one bounded script snapshot and compiles those same bytes, including its verified execution fingerprint:

```sh
gate_c_operator () {
  sudo -k -- /usr/bin/python3 -I -B -c '
import hashlib, os, stat, sys
path = sys.argv[1]
fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
with os.fdopen(fd, "rb") as f:
    s = os.fstat(f.fileno())
    if not stat.S_ISREG(s.st_mode) or s.st_nlink != 1 or s.st_size != 32710:
        sys.exit("STOP: invalid script file")
    code = f.read(65537)
expected = "f05282c07805c251b52bb6541320bbfa376759a92e9f4a1fd2fdbdf8a02a4e4e"
if hashlib.sha256(code).hexdigest() != expected:
    sys.exit("STOP: script fingerprint mismatch")
sys.argv = [path] + sys.argv[2:]
exec(compile(code, path, "exec"), {"__name__": "__main__", "__file__": path,
     "__verified_script_sha256__": expected})
' "$HOME/gate-c-f05282c0.py" "$@"
}
```

Paste the reviewed approval hash printed in Windows, not a newly accepted hash of an unreviewed remote file:

```sh
printf 'Reviewed Gate C approval SHA256 from Windows: '
IFS= read -r gate_c_approval_hash
gate_c_operator run --approval "$HOME/gate-c-approved-v2.json" --approval-sha256 "$gate_c_approval_hash"
gate_c_result=$?
printf 'Gate C exit code: %s\n' "$gate_c_result"
```

## Exact Gate C sequence

1. Validate approval/hash/window/deadline, ready Gate D and verified recovery references, real Docker report, private baseline/helper hashes and inactive markers. Acquire the operation flock and repeat admission. Refuse changed identities, sources, unexpected TEST services/network peers or transitional states. Never discover substitute IDs.
2. At `/dev/tty`, execute approved TEST-only ingress closure elsewhere and verify writer exclusion. Type `INGRESS-CLOSED CUSTODY-HELD GATE-C-ONLY` only with continuous custody and both gates disabled.
3. Check source metadata, restore bound and aggregate capacity. Exclusively create private journal, namespace/backups and scratch parent. Record approval fingerprint, script fingerprint and selected metadata. Existing source permissions remain unchanged.
4. Type `STOP-EXACT-TEST-IDS` to approve downtime. Revalidate both IDs before each stop. Stop frontend then backend, exact IDs only, `--time 60`; record intent durably BEFORE each command, then exited confirmation or ambiguous error. Docker may kill at the 60-second limit; that bound requires approval. Refuse a restarted frontend before stopping backend. No automatic restart follows failure.
5. With both exited, type `WRITERS-STOPPED CUSTODY-HELD CAPTURE-PAIR`. This authorizes private offline SQL integrity/FK/count/migration checks, upload digests and possible SQLite sidecars. Capture stable source history/count/inventory/DB-WAL fingerprints/identities in `source-capture.json`; repeat stopped timestamps/source checks.
6. Call only pinned `storage.backup(DB, UPLOADS, BACKUPS, quiesced=True)` on legacy TEST. Save exact returned pair path privately. Never copy app.db alone, discard WAL or overwrite source. Preserve partial artifacts on failure.
7. Recheck validity, call `storage.restore_test(pair, SCRATCH, max_upload_bytes=reviewed_bound)`. Verify full restored history/counts/uploads against source in addition to helper checksum/integrity/FK verification. Recheck unchanged source and exited containers.
8. Type `CUSTODY-CONTINUOUS GATE-D-NOT-APPROVED` only with uninterrupted exclusion. Final validity precedes `gate-c-pass.json`. Exit 0 means capture/restore PASS only: originals stay stopped, source retained, ingress CLOSED, deployment disabled. Choose separately approved READY Gate D or independent recovery by the decision deadline.

Never print private counts, migration rows, upload names/inventories, secrets, complete inspect objects or health logs. Root-private backup/restore artifacts contain TEST data under explicit operator approval. No PROD/STAGING data is accessed.

## Independent recovery after expiration or partial failure

Each `recover` attempt requires a NEW reviewed recovery authorization, fingerprint, UTC validity window, decision-maker/authority and tty confirmation. The original Gate C window is NOT consulted. Bind the original recorded Gate C approval fingerprint; never extend its timestamps or replace the original journal. Each recovery ID creates an exclusive `gate-c/recovery-<id>` directory, with authorization/hash persisted before disruptive recovery actions. The operation flock prevents concurrent run/recovery. A fresh ID alone does not authorize retry: review the changed state and issue a new approval/hash.

Fill a copy of `gate-c-recovery.template.json`:

| Fields | Required meaning |
|---|---|
| `gate` | Exactly `C-recovery-only` |
| `recovery_id` | New unique lowercase letters/digits/hyphens, 8–64 characters, never reused |
| `approval_reference`, `reason` | Separate approved incident/recovery decision and failure boundary |
| `gate_c_approval_sha256` | Original reviewed Gate C approval fingerprint, matching journal |
| `decision_maker`, `decision_maker_authority` | Named approver and authority record; normally pre-named person, or explicitly approved reassignment; fresh root authentication/hash remains mandatory |
| `custody_operator`, `custody_and_stop_settlement_evidence` | Continuous custody and concrete resolution of all Docker stop requests, including timeouts/errors |
| `window_start_utc`, `window_end_utc` | NEW UTC recovery window, which may follow original expiration |
| `mode` | Exactly `frontend-only`, `existing-capture` or `fresh-quiesced` |
| `quiesce_if_required` | True only for fresh mode and explicit approval to stop remaining ORIGINAL TEST writers frontend-first/backend-second |
| `expected_migration_history`, `expected_migration_history_sha256` | Fresh mode: root-private 0600 reviewed ordered JSON list of `[MigrationId, ProductVersion]` compatible with existing image/schema |
| `fresh_source_verification_approved` | True only to authorize fresh stopped-source evidence acquisition, not proof of historical business-data equality |
| Safety booleans | `custody_continuous`, `ingress_closed`, `github_gate_disabled_confirmed`, `original_source_authoritative`, `no_gate_d_or_source_overwrite`, `stop_requests_settled`, `backend_startup_approved`, `recovery_approved`: ALL true based on reviewed facts |

`frontend-only`: Backend was never stop-requested and remains healthy with its recorded start timestamp. Restart retained frontend only; no DB/upload source reads.

`existing-capture`: Both original writers exited and operations settled. Require complete original capture; reverify source identities, DB/WAL, integrity/FKs/counts, full migration history and uploads before startup.

`fresh-quiesced`: Missing capture, interrupted capture, ambiguous stop or partial recovery. Separately approve fresh verification and known-compatible expected migrations. If expressly selected, stop remaining original writers first; otherwise both must already be exited. Require two stable exited-state snapshots, offline integrity/FK/count checks, stable DB/WAL/upload hashes, full expected history and continuous custody. If a complete published original capture exists, it MUST also match; fresh mode never bypasses a mismatch or corrupt published snapshot. Save new evidence privately before startup. Original source remains authoritative, with no source restore, overwrite or implied loss of required writes.

Every mode rechecks original IDs/images/binds/network/ports/restart policy and private baseline hash. New authorization is checked before/after confirmation, before quiescing/starts, throughout health waits and before PASS. Startup is backend first, healthy within 180 seconds AND the NEW window, then frontend. Application startup can write/migrate: approve schema compatibility beforehand; health alone is not proof. No ingress reopening or source restore is automatic.

## Failure boundary → exact recovery decision

| Boundary | Separately approved path |
|---|---|
| Before any stop intent | Containers unchanged by script. Verify interruption boundary privately; decision-maker may approve only reviewed TEST ingress reversal. |
| Frontend stopped; backend never stop-requested | New frontend-only authorization; verify unchanged healthy backend/start timestamp and exact frontend. No source reads. |
| Backend stopped before complete capture | New fresh-quiesced authorization, known expected migrations and continuous custody. Verify stable stopped source fully, save new evidence, then approve original startup. Never manufacture the missing original snapshot. |
| Pair succeeded; scratch restore failed | Retain artifacts/failure evidence. New existing-capture authorization verifies original source against capture; restart originals, never overwrite source from unverified restore. |
| Original window/deadline expired during backup/verification | Hold ingress/custody. Do not edit original timestamps or resume C. New recovery fingerprint/window; use existing-capture if complete, fresh-quiesced otherwise. Completed late helper output is retained but cannot authorize another C phase. |
| Docker stop error/timeout | CLI failure is NOT proof of exit or cancellation. Independently prove engine request settled and actual states. Transitional/restarting/paused/dead states refuse. Frontend-only is permitted only if backend never stop-requested; otherwise existing-capture with both exited, or fresh-quiesced with explicit quiesce approval if any writer runs. Never start against a pending stop. |
| Recovery fails/expires after backend start | No further start/reopen. Preserve evidence. New reviewed attempt/window; expressly approve quiescing if fresh offline verification needs backend stopped. No automatic retry. |
| Published capture corrupt, lost custody, changed source, failed integrity, replaced IDs or unknown Docker operation | Hold maintenance. Obtain incident-specific reviewed evidence/procedure and old-path baseline. Do not delete a snapshot or overwrite source to force checks. A script cannot infer historical validity without evidence. |
| Gate D replaced originals or another authority has required writes | Gate C recovery no longer applies. Use separately reviewed Gate D pre-write/post-write recovery, never restart stale old data. |

An ambiguous backend stop with no capture can therefore recover through fresh mode after explicit settlement evidence and verification. A valid original capture can never be waived. Corrupt published journals/source or lost custody require an incident-specific procedure, not a weakened check.

## Exact recovery transfer and execution

On Windows create a NEW reviewed recovery file. The example assumes the remote destination is absent; use a separately reviewed new filename for later attempts instead of overwriting a previous authorization. Never change original Gate C approval timestamps.

```powershell
$recovery = Join-Path (Get-Location) 'gate-c-recovery-approved.json'
$recoveryHash = (Get-FileHash -LiteralPath $recovery -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output "Reviewed NEW recovery authorization SHA256: $recoveryHash"
ssh -o BatchMode=yes gta-test 'test ! -e "$HOME/gate-c-recovery-approved.json" && test ! -L "$HOME/gate-c-recovery-approved.json"'
if ($LASTEXITCODE -ne 0) { throw 'STOP: recovery transfer collision or SSH error' }
scp -o BatchMode=yes $recovery 'gta-test:gate-c-recovery-approved.json'
if ($LASTEXITCODE -ne 0) { throw 'STOP: recovery transfer failed' }
ssh -tt -o BatchMode=yes gta-test
```

Define the SAME verified `gate_c_operator` function above in that remote shell if needed:

```sh
printf 'Reviewed NEW recovery authorization SHA256 from Windows: '
IFS= read -r gate_c_recovery_hash
gate_c_operator recover --authorization "$HOME/gate-c-recovery-approved.json" --authorization-sha256 "$gate_c_recovery_hash"
gate_c_recovery_result=$?
printf 'Recovery exit code: %s\n' "$gate_c_recovery_result"
```

Only separate decision-maker approval permits typing `APPROVE-RECOVERY-ORIGINAL-TEST-ONLY`. Recovery PASS means retained originals healthy; ingress remains CLOSED. Separately accept recovery, authorize reviewed TEST-only reopening, record write-resumption time, then release custody. Retain source/pair/scratch/journals. No automatic cleanup, retention job, Gate D, deployment gate, workflow dispatch or source restore is included.

## Focused tests: performed and NOT performed

Performed: **32 unprivileged unit/regression tests PASS**, including real fictional SQLite history/hash checks, stopped metadata variants (active network fields cleared/retained, stale/absent health), wrong image/ID/static-address/network/public-port refusal, new recovery windows after original expiration, missing capture/fresh verification, capture mismatch refusal, frontend-only without source reads, explicit ambiguous-stop quiescing, timeout intent records, exact stop/start order, backup/restore failures, and expiration during backup/verification. Docker, host ownership and custody are mocked in unit lifecycle tests; this is NOT real Docker or VPS evidence.

```sh
python3 -I -B test_gate_c.py
```

NOT performed: real Docker lifecycle tests, root-installed execution, live source capture, backup, restore, stops, recovery, Gate D or activation. Rootless Docker tooling is present, but sandbox `unshare --user --map-root-user --net /usr/bin/true` returned `Operation not permitted`. No isolated daemon could be started here; no shared daemon was contacted and no privilege escalation requested.

`test_gate_c_docker.py` is an opt-in real lifecycle test for an EMPTY dedicated disposable Linux daemon, NEVER gta-test/the shared VPS. Require a current-user-owned 0700 directory `/tmp/carservice-gate-c-docker-<unique>` containing its user-owned socket `docker.sock`, daemon data root exactly sibling `data`, daemon label `carservice.gate-c.fixture=true`, no containers/non-default networks, and an already loaded Python fixture image by immutable SHA256. Provision ONLY on a disposable VM/runner with available rootless namespaces; do not weaken this sandbox or install shared VPS packages. The harness never pulls an image.

On that disposable runner only, replace both explicit unresolved fixture values with its reviewed socket and existing immutable fixture image ID, not a CarServiceApp image:

```sh
python3 -I -B test_gate_c_docker.py \
  --disposable-socket /tmp/carservice-gate-c-docker-UNRESOLVED/docker.sock \
  --fixture-image sha256:UNRESOLVED_FIXTURE_IMAGE_ID \
  --output /tmp/gate-c-disposable-result.json \
  --i-confirm-disposable-daemon
```

The unresolved example refuses. The harness creates unique labelled fictional containers/network and fresh fictional files, records actual selected running/frontend-stopped/both-stopped inspect fields (configured IPAM, NetworkID, IP/gateway and health), exercises real inspect/check_pair/check_network/stop_exact and recovery starts/health, and verifies wrong-network/image refusal. Source/custody prerequisites for recovery are explicitly mocked; this is real Docker lifecycle validation, not migration/custody proof. Cleanup is limited to exact labelled fixture objects; cleanup failure cannot produce PASS. Review Engine compatibility, actual stopped fields and both recovery cases before accepting report/hash. Never hand-write a PASS.

Until this real report, ready Gate D package and verified old-path recovery package are accepted, leave readiness/approval booleans FALSE. Historical Phase 6F.3 remains accepted; it does not verify the corrected stopped-state implementation.
