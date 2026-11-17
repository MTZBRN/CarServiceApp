# Gate D execution package — candidate, not execution approval

`gate-d.py`: **31,451 bytes**, SHA256:

```text
14bd29fd4d4a1724327361a7e72c5e77448b3701fffc22ef78a3ccf1307cb957
```

Dependency `gate-c.py` must sit beside it unchanged, SHA256 `a0fae6538c6b64e4160041c274cc4f8662e38e93b677504f867026f0f8208989`. Runtime storage helper remains `/usr/local/sbin/ops_storage.py`, SHA256 `90ddda01a6aba871c10441900506889d819571069d03f2d764c867ca9940f2dc`. `ops_storage.fixture.py` is an exact reviewed copy for local fictional tests ONLY; do not install it or execute it against application data. Gate C includes the documented mount-order correction; see ../gate-cd/FAILURE-44137909902.md.

Contract: merged [MIGRATE_TEST_STORAGE.md](https://github.com/MTZBRN/CarServiceApp/blob/5200ede3b9dee3cfa7d5d4ad697029f445d91264/ops/test-deploy/MIGRATE_TEST_STORAGE.md) and the accepted Gate D preparation sheet. Existing CI, Phase 6F.3, native Compose, installed artifacts, mirror, network, capacity and overlap evidence are carried forward. No broad infrastructure audit is requested.

## One operator checklist

1. **Review implementation and disposable evidence before Gate C downtime.** Accept this package, old/new recovery paths and fixture results independently. The real Docker lifecycle test must run only on a dedicated VM/isolated runner, never the production VPS daemon. Current tests are fictional filesystem/SQLite and mocked lifecycle tests; root credential-dropping, native Compose creation, real image UID access, cutover/recovery and installed preflight still need disposable validation. Do not mark `gate_d_ready` or old-path recovery verified solely because local tests pass. Final package/script hashes can be bound in Gate C's readiness record once reviewed. Gate C and Gate D execution approvals remain distinct.
2. **Resolve private inputs, do not invent them.** Prepare reviewed root:root 0600 old-path baseline outside the mutable worktree; new-path baseline exactly `/etc/carservice-test-deploy/baseline/compose.json`; actual same-revision environment exactly `/etc/carservice-test-deploy/environment`; expected ordered migration-history JSON; concrete TEST-only ingress/custody/smoke/reopen steps; protected PROD before/after identity/network comparison evidence without customer data; named decision-maker and UTC windows. Bind each file by SHA256 in an operation-specific approval. Baselines must be self-contained JSON, same exact images, external existing network, normalized long-form ports/binds with `bind.create_host_path=false`, no build/env_file/includes/extends/configs/secrets/host configuration binds. Old/new baselines may differ ONLY in the two backend storage sources. Environment values must match the reviewed existing configuration; no secret is guessed or exported here.
3. **After separately approved Gate C PASS, bind the run-specific evidence.** Populate `cutover.template.json` with original Gate C approval fingerprint, approved `gate-c-pass.json` hash, `source-capture.json` hash and pair `SHA256SUMS` hash. These values do not exist until the real Gate C run; no fake pair is supplied. The script validates the Gate C implementation fingerprint and exact original stopped IDs/images/network, restores the exact pair into fresh private scratch again, compares full history/counts/uploads and a complete private database-content digest, then exclusively materializes new storage. An approved window must include copy, initial startup, deliberate verification stop, stable verification and resumed health checks.
4. **Approve and run `cutover` only.** Confirm closed TEST ingress, continuous custody, no competing automation, disabled GitHub gate and absent server activation/deployment markers. Use the exact authenticated launcher below. Its tty token is `APPROVE-GATE-D-CUTOVER`. Backend starts before frontend using exact immutable image IDs, `--no-deps --no-build --pull never --wait`. Both NEW containers are then deliberately stopped frontend-first/backend-second for stable full verification. They resume backend-first with health checks. Cutover PASS leaves ingress CLOSED and deployment disabled; it does not accept storage or reopen traffic. On any error, preserve journals/partial trees and use the separately approved recovery decision below; never rerun cutover into partial destinations.
5. **Accept NEW authority separately.** Perform the reviewed isolated smoke/synthetic checks and protected PROD metadata comparison; record all deliberate validation writes. Fill `acceptance-evidence.template.json` with actual private verification references and flags, and `accept.template.json` with exact new IDs from the private `current-ids.json`, original Gate D approval fingerprint, a NEW validity window and reviewed evidence hash. `accept` rechecks live IDs/images/binds/health and runs the pinned installed strict preflight. It refuses missing/changed packages, mirror/configuration or storage prerequisites; never weaken preflight. Successful acceptance creates an irreversible script-level NEW authority marker. Only afterward may the decision-maker separately approve TEST-only ingress reopening and record the write boundary. The script itself never reopens ingress.
6. **Use the correct independently approved recovery.** Before required new writes and before NEW authority acceptance/forward declaration, `old-path-recover` can stop the approved current TEST IDs, verify retained OLD data against immutable Gate C evidence, and recreate backend then frontend using the reviewed exact-image old-path model. It requires explicit approval that no required writes will be lost and that deliberate validation writes may be discarded. After required new writes, acceptance, or forward-authority declaration, NEVER restart old data: use `forward-capture`, incident-specific reviewed forward repair, then `resume-new` with a new approval and verified fresh forward-pair evidence. Exact details are below.
7. **Only after accepted storage and recovery readiness, prepare first deployment activation.** Preserve both deployment gates disabled through this package. Remaining activation is the separately reviewed restricted SSH/sudo identity/denial tests, protected release/environment policy, required credentials, per-release approval bound to exact SHA and successful push CI, strict preflight, and explicit activation authorization from the existing bootstrap/README. This package creates no SSH account/key, deploy credential, token, release approval, workflow dispatch, `actions-enabled` or GitHub gate change. Do not substitute same-image storage cutover for a release deployment approval.

## What the executable operations enforce

- Fixed project `carserviceapp-test`, network `carserviceapp-test_workshop`, ID `6e4eaf575df61b771a31e7cadae785dd345a3f3ebae9b999e7c51c7524be9469`, subnet/gateway `172.30.91.0/24` / `172.30.91.1`, backend `.2`, frontend `.3`, loopback frontend `127.0.0.1:5174 → 8080/tcp`, no backend publication. Gate C dependency carries the exact historical IDs and approved image IDs. No tags/builds/pulls, additional TEST services, default daemon selection or shared network recreation.
- `cutover` requires the exact historical pair EXITED. Actual replacement IDs are accepted only after the recorded Compose create intent, then validated against exact project/service/image/layout/network/ports. Each subsequent operation instead requires explicitly approved full `current_ids` and `current_layout`, bound to the original Gate D authorization fingerprint. An ambiguous create/stop is never retried automatically; resolve the engine request and review actual state before new approval.
- Fresh state `/var/lib/carservice-test-deploy/gate-d`, root:root 0700; records 0600. New Gate D run refuses an existing state directory. Recovery/acceptance attempts have exclusive approval-ID subdirectories. C and D share the existing operation flock, never a deployment gate. Windows are checked before disruptive actions, during health waits and between phases. In-progress I/O may finish after expiration; no subsequent authorized action starts. New recovery approvals have their own windows and do not modify/extend the original approval.
- Pair artifacts must be the four reviewed root-private files, with approved checksum inventory. Pinned helper verifies the pair and restores to `/var/tmp/carservice-gate-d-<approval_id>/carserviceapp-restore-test-gate-d`. New `/srv/carserviceapp-test/data` and `uploads` must be absent. Materialization copies into a fresh root-private staging child of `/srv/carserviceapp-test`, refuses links/hardlinks/special files/cross-device entries, creates every file exclusively, checks complete copied DB bytes/logical contents, full migrations/integrity/FKs/counts/upload digests, assigns ownership only in NEW leaves, fsyncs, and publishes with Linux `renameat2(RENAME_NOREPLACE)`. Publication of the TWO directories is not atomic as a pair: second-publication failure intentionally leaves an inert partial installation and blocks retry.
- New leaves are 1654:1654, directories 0700/files 0600; the private host parent remains root:root 0700. No chown/chmod of `/opt`, legacy data, shared parents or existing application sources occurs. DB read verification uses a child with pre-opened directory descriptors and drops credentials to the storage owner, avoiding ROOT-owned application WAL/SHM while keeping host parent permissions unchanged. It computes a private streaming logical digest of schema AND all database rows, never printing row values. Scratch artifacts remain root-private. Source/copy invariance is not inferred from counts alone.
- SQLite access to legacy data may create sidecars as the existing owner under explicit migration/recovery approval. Old recovery refuses unreadable/inconsistent source rather than repairing legacy permissions. A root-run forward backup can create ROOT-owned sidecars ONLY in the NEW storage: the code assigns the documented application owner only to that operation's newly created regular WAL/SHM, and refuses a newly created nonempty WAL. It never truncates/discards WAL or changes original source permissions.
- The initial application startup is a write-risk boundary even with identical images. After startup the new pair is quiesced and compared, including full logical DB digest, to the verified pair. A mismatch holds maintenance. A second startup can write too: reviewed smoke/schema/data acceptance evidence and explicit acceptance are still required. Health alone is insufficient.
- The private old/new baselines must remain identical except storage; actual native normalized Compose models are revalidated before initial cutover/old recreation. No `.env.test`/mutable legacy Compose root execution. All subprocess stdout/stderr are captured, not printed. No environment values, SQL rows or customer filenames go to public logs.

## Approval files

Every operation needs its OWN filled template, reviewed SHA256, `approved=true`, unique 8–64 character lowercase/digit/hyphen `approval_id`, named decision-maker/reference and NEW UTC `window_start_utc`/`window_end_utc`. Keep all flags false until the respective decision is approved. Reusing a directory/approval ID fails; a new ID alone is not permission to retry.

Common inputs: `ingress_closed`, `custody_continuous`, `github_gate_disabled`, `no_other_automation`; original Gate C approval fingerprint; file paths AND hashes for `old_model`, `new_model`, `runtime_environment`, `expected_history`; positive reviewed `max_upload_bytes`. Expected history is ordered JSON `[[MigrationId, ProductVersion], ...]`, never inferred from image tags. Referenced files and ancestors must be root-controlled, non-linked and not group/other writable; files 0600. Native baseline field shape must meet the code's contract. Runtime paths are documented contract paths, not private values invented here.

Operation-specific bindings:

| Operation | Additional required inputs |
|---|---|
| `cutover` | `gate_c_pass_sha256`, `source_capture_sha256`, `pair_checksums_sha256` |
| `old-path-recover` | Original `gate_d_approval_sha256`, current exact IDs/layout, `source_capture_sha256`, `no_required_new_writes=true`, `discard_validation_writes_approved=true`, `ambiguous_operations_settled=true` |
| `forward-capture` | Original D approval fingerprint, current exact NEW IDs/layout, `new_source_authoritative=true`, reviewed incident-specific `forward_repair_procedure` path/hash |
| `resume-new` | Original D fingerprint, exact stopped NEW IDs/layout, `new_source_authoritative=true`, `repair_completed_and_accepted=true`, `forward_evidence` path/hash from latest successful forward capture |
| `accept` | Original D fingerprint, exact NEW IDs/layout, `new_source_authoritative=true`, `required_checks_accepted=true`, private `acceptance_evidence` path/hash |

Acceptance evidence binds original D approval fingerprint and current IDs; requires smoke PASS, unchanged startup migrations, reviewed validation writes, new-data verification and unchanged protected PROD metadata. Supply concrete private records, not merely mechanically set flags. The code also requires its own stable-verification/cutover-health records and unchanged recorded IDs, rechecks live health, authenticates installed preflight/deploy-helper hashes, and requires actual preflight exit 0 before acceptance.

## Exact PowerShell → gta-test → authenticated interactive sudo

This is a future OPERATOR procedure, not permission for Codex to run it. After independent review and the selected operation's explicit approval, place the reviewed `gate-d.py`, dependency `gate-c.py` and a filled `gate-d-approved.json` in the Windows working directory. Do NOT copy `ops_storage.fixture.py` into runtime directories.

```powershell
$script = Join-Path (Get-Location) 'gate-d.py'
$dependency = Join-Path (Get-Location) 'gate-c.py'
$approval = Join-Path (Get-Location) 'gate-d-approved.json'
if ((Get-FileHash -LiteralPath $script -Algorithm SHA256).Hash.ToLowerInvariant() -ne '14bd29fd4d4a1724327361a7e72c5e77448b3701fffc22ef78a3ccf1307cb957') { throw 'STOP: script fingerprint' }
if ((Get-Item -LiteralPath $script).Length -ne 31451) { throw 'STOP: script length' }
if ((Get-FileHash -LiteralPath $dependency -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'a0fae6538c6b64e4160041c274cc4f8662e38e93b677504f867026f0f8208989') { throw 'STOP: dependency fingerprint' }
$approvalHash = (Get-FileHash -LiteralPath $approval -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output "Reviewed operation approval SHA256: $approvalHash"
ssh -o BatchMode=yes gta-test 'mkdir -m 0700 -- "$HOME/gate-d-14bd29fd"'
if ($LASTEXITCODE -ne 0) { throw 'STOP: directory exists or SSH failure' }
scp -o BatchMode=yes $script $dependency $approval 'gta-test:gate-d-14bd29fd/'
if ($LASTEXITCODE -ne 0) { throw 'STOP: transfer failure' }
ssh -tt -o BatchMode=yes gta-test
```

The new directory is operator-owned, not a runtime installation. If it exists, do not overwrite it. Later operations need new separately reviewed approval filenames/transfers; reuse the same authenticated script/dependency or use another absent directory. Do not overwrite prior approvals. No credentials, SSH settings or sudo rules are created.

Define at the remote prompt:

```sh
gate_d_operator () {
  sudo -k -- /usr/bin/python3 -I -B -c '
import hashlib, os, stat, sys
path = sys.argv[1]
fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
with os.fdopen(fd,"rb") as f:
    s = os.fstat(f.fileno())
    if not stat.S_ISREG(s.st_mode) or s.st_nlink != 1 or s.st_size != 31451:
        sys.exit("STOP: invalid script file")
    code = f.read(65537)
if hashlib.sha256(code).hexdigest() != "14bd29fd4d4a1724327361a7e72c5e77448b3701fffc22ef78a3ccf1307cb957":
    sys.exit("STOP: script fingerprint")
sys.argv = [path] + sys.argv[2:]
exec(compile(code,path,"exec"),{"__name__":"__main__","__file__":path})
' "$HOME/gate-d-14bd29fd/gate-d.py" "$@"
}
```

For initial cutover ONLY, paste the independently reviewed Windows approval fingerprint:

```sh
printf 'Reviewed CUTOVER approval SHA256: '
IFS= read -r gate_d_approval_hash
gate_d_operator cutover --approval "$HOME/gate-d-14bd29fd/gate-d-approved.json" --approval-sha256 "$gate_d_approval_hash"
gate_d_status=$?
printf 'Gate D exit code: %s\n' "$gate_d_status"
```

Other operations use the SAME launcher with `old-path-recover`, `forward-capture`, `resume-new` or `accept`, and a NEW operation-specific approval file/hash. Example form (values deliberately required, never guessed):

```sh
: "${reviewed_operation:?Set the independently approved operation}"
: "${reviewed_approval_file:?Set its new transferred approval path}"
: "${reviewed_approval_sha256:?Paste its reviewed Windows fingerprint}"
gate_d_operator "$reviewed_operation" --approval "$reviewed_approval_file" --approval-sha256 "$reviewed_approval_sha256"
```

Interactive tokens: `APPROVE-GATE-D-CUTOVER`, `APPROVE-GATE-D-OLD-PATH-RECOVER`, `APPROVE-GATE-D-FORWARD-CAPTURE`, `APPROVE-GATE-D-RESUME-NEW`, `APPROVE-GATE-D-ACCEPT`. Typing a token without the corresponding named decision-maker approval is not authorization.

## Recovery boundary details

- Before Gate D creates its journal/replaces anything, retain original exact-ID Gate C recovery with a separately authenticated new window. Do not improvise recovery just because a transfer/admission failed.
- Once Gate D has a journal, old-path recovery can operate on explicitly approved current IDs/layout. Before write-risk/reference creation, missing D data-reference is allowed ONLY if there is no write-risk marker and the exact original exited pair remains on old storage. Otherwise the full recorded logical reference is required. Partial destination publication is retained, never merged or deleted to retry.
- After original IDs are replaced, old-path recovery recreates from the reviewed old-path exact-image baseline; Gate C exact-ID recovery is no longer applicable. It checks old source fingerprints, complete history/counts/uploads/logical reference and source inode/link metadata before recreation. Required new writes must be absent; validation-write discard must be explicitly approved. Startup can write; recovery PASS is health only, and ingress reopening needs separate reviewed acceptance.
- `accepted-authority.json` or `new-authority-boundary.json` permanently forbids scripted old-source recovery. `forward-capture` records NEW authority before stopping, then captures CURRENT counts/history/uploads/logical digest, produces a fresh paired backup and verifies it in isolated scratch. It never compares required new writes to stale C counts, overwrites source or starts old data. It leaves TEST stopped with private evidence. Integrity failure preserves partial evidence and refuses; an incident-specific forensic/repair procedure is required, never a generic destructive restore.
- Perform ONLY the separately reviewed incident-specific forward repair under explicit approval. No actual unknown business/schema repair is invented or executed by this package. After repair, run another independently approved `forward-capture` to verify the latest authoritative pair. `resume-new` requires that exact fresh evidence/hash, restores it into new isolated scratch again, verifies the STILL-STOPPED source against it, then starts the approved NEW IDs backend-first. Startup/health failure never triggers rollback/retry. Accept recovery/smoke and reopening separately; old-source restart remains prohibited.
- CLI stop/create timeouts are ambiguous, not proof of cancellation. Stop immediately, hold ingress/custody, preserve intent records and establish actual engine settlement/current IDs privately. New recovery approval must explicitly accept settled state and exact IDs. No broad stop filters, compose down, network deletion, pull/build, automatic source restore or lock/marker deletion is supplied.

## Tests and concrete execution limits

`python3 -I -B test_gate_d.py`: **34 PASS**. Fictional real SQLite tests use the exact pinned helper for backup, restore and materialization, owner-reader integrity/FK/full migration/count/upload/logical checks, committed WAL, byte/row corruption, symlink/hardlink/FIFO/dangling-link refusal, exclusive rename and partial publication. Mocked lifecycle tests cover exact flags, backend-first creation/resume, frontend-first exact-ID stop, timeout/failure/expiry refusal, old-recovery layout transitions and irreversible authority barriers. Authorization tests cover false/wrong-operation refusal and the reviewed C implementation binding. Ownership tests adapt only the fixture UID/GID/root-admission checks to the unprivileged current user; production checks remain intact.

NOT performed: real Docker/Compose lifecycle, actual image UID 1654 traversal, root credential dropping, installed preflight, PowerShell execution, live migration/cutover/recovery, PROD/STAGING access or activation. Existing accepted tests are reused, not described as proof of these NEW branches. Real disposable validation remains required on the dedicated runner; never test by stopping live TEST or using the shared VPS daemon. A passing unit suite is not Gate C/D execution approval.

All exact file hashes/byte counts are in `FILE-FINGERPRINTS.txt`. Fill only concrete private values and run-specific hashes; this package invents no secrets, private baseline digest, live replacement ID, migration list, maintenance date or incident repair.
