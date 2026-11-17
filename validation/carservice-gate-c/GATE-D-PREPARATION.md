# Gate D preparation — candidate, not ready or authorized for execution

Gate C must NOT start while this preparation remains incomplete. This sheet prepares the next separate implementation from the merged `MIGRATE_TEST_STORAGE.md` design. It does not establish `gate_d_ready`, grant Gate D approval, or authorize any command below. Do not develop the missing execution package while TEST is offline.

## Private inputs and implementation still needed for a ready package

- Reviewed root-private new-path baseline JSON and actual runtime environment paths/SHA256s, old-path recovery baseline path/SHA256 and native normalized-model evidence. Use exact current image IDs, same revision/network/IPs/ports/hardening/healthchecks. No mutable worktree root execution, relative configuration, build/pull, includes/extends, secret-bearing exported baselines or staging overlays.
- Complete expected migration list known compatible with the existing backend image, Gate C's future exact returned pair path and verified report, reviewed expanded-upload bound, named decision-maker and approved Gate D window/decision deadline.
- Reviewed/fingerprinted destination materializer and exact invocation: exclusive new publication, same-filesystem/canonical-path checks, links/hardlinks/submount refusal, complete copied DB/upload verification, 1654:1654 directories 0700/files 0600, no tar extraction or merge into existing directories. The merged design describes behavior but does not supply a turnkey production copy command. Do not improvise unchecked `cp -a`, tar extraction or recursive chown over existing paths.
- Independently reviewed old-path recreation recovery after original container replacement, and a post-write forward-repair boundary. Gate C exact-ID recovery is invalid as soon as Gate D removes/replaces either original container.
- Concrete isolated smoke/synthetic tests, accounting for deliberate writes, exact acceptance criteria, ingress reopening and write-resumption authority.
- Protected existing PROD identity/network metadata baseline and exact comparison invocation, without PROD file/data access or compensating commands. Accepted production backup configuration alone is not that baseline.

Resolve these from existing private records/runbooks or separately approved preparation, not guessed values or broad diagnostic scans. No private paths, hashes or migration list are invented here.

## Fixed accepted inputs

| Item | Value |
|---|---|
| Project/network | `carserviceapp-test` / `carserviceapp-test_workshop` |
| Network ID | `6e4eaf575df61b771a31e7cadae785dd345a3f3ebae9b999e7c51c7524be9469` |
| Subnet/gateway/backend/frontend | `172.30.91.0/24` / `172.30.91.1` / `172.30.91.2` / `172.30.91.3` |
| Publication | Frontend only `127.0.0.1:5174` → `8080/tcp` |
| Backend image | `sha256:352a129e796973753451b7eaa86b7acaf85c93f33e41b3ade5607b79bf534d05` |
| Frontend image | `sha256:baa2fe08115174dce95caba06ab391e6d6b153a2babf5829a545698c3847f761` |
| New leaves | `/srv/carserviceapp-test/data`, `/srv/carserviceapp-test/uploads`, initially absent |
| Leaf permissions | 1654:1654; directories 0700; files 0600 |
| Scratch | `/var/tmp/carservice-gate-c/carserviceapp-restore-test-gate-c` |
| Backup | Exact helper-returned path recorded privately in Gate C `paired-backup.json` |
| Retained original authority | `/opt/carserviceapp/test-data`, `/opt/carserviceapp/test-uploads` |

## Required Gate D ordered execution sheet

1. Obtain explicit Gate D approval for same-image storage cutover only, not a release. Bind execution package, private baselines/environment, destination materializer and Gate C pair/report by exact hashes. Keep ingress closed and both deployment gates disabled. Gate C PASS is not Gate D approval. The Gate C decision-maker must choose this already-ready path before its decision deadline.
2. Match Gate C's exact original exited container IDs/images and network identity, continued custody, verified pair/restore, trusted target namespace and absent destination leaves. Check execution-time copy capacity. No broad audit, lock removal or marker clearing is a substitute.
3. Execute only the reviewed materializer into NEW absent data/uploads, with exclusive creation and no merging. Compare copied DB integrity/FKs/full ordered migration history/counts and every upload digest to the pair/scratch. Reject WAL/SHM beside the standalone restored DB. On partial copy retain evidence and hold; never retry into partial destinations or delete them automatically.
4. Recheck private baseline/environment hashes and normalized standalone new-path model: exact existing image IDs, same project/network/IPs/ports/hardening, only new TEST storage binds, no build or pull. Ensure old-path recreation recovery is already available BEFORE any original ID can be replaced.
5. The final package must populate authenticated private paths. These are the required guarded command FORMS, not execution approval or a ready package:

   ```sh
   # Remote operator only, AFTER separate Gate D approval and materialization.
   : "${reviewed_new_baseline:?STOP: no reviewed baseline}"
   : "${reviewed_runtime_environment:?STOP: no reviewed environment}"
   : "${reviewed_project_directory:?STOP: no reviewed private project directory}"
   /usr/bin/docker --host unix:///var/run/docker.sock compose \
     --project-name carserviceapp-test \
     --project-directory "$reviewed_project_directory" \
     --env-file "$reviewed_runtime_environment" -f "$reviewed_new_baseline" \
     up -d --no-deps --no-build --pull never --wait backend
   # Verify backend at the approved acceptance boundary before continuing.
   /usr/bin/docker --host unix:///var/run/docker.sock compose \
     --project-name carserviceapp-test \
     --project-directory "$reviewed_project_directory" \
     --env-file "$reviewed_runtime_environment" -f "$reviewed_new_baseline" \
     up -d --no-deps --no-build --pull never --wait frontend
   ```

6. Record NEW IDs/images/binds, network ID/IPs, ports and health. Verify migration history before/after startup; same-image backend startup can run EF/application writes. Health does not prove no schema/data changes. Use the reviewed stable-data verification window, not an inventory of a changing source.
7. Perform isolated smoke/synthetic checks and account for deliberate writes. Run installed strict preflight only after actual new storage/configuration, mirror/tooling and recovery prerequisites satisfy its contract. Do not weaken it to accept legacy paths or fixtures. Compare only accepted protected PROD identity/network metadata, never PROD contents or compensating PROD actions.
8. Decision-maker explicitly accepts NEW storage as authoritative, records write boundary/time and separately approves reviewed TEST ingress reopening. Then release custody/end downtime. Retain original sources, pair, scratch, both baselines and journals. No workflow dispatch, deployment approval, `actions-enabled` or `TEST_DEPLOY_ENABLED=true` is included.

## Failure boundaries that must be executable BEFORE Gate C approval

- Before replacement/new writes: separately approve exact original restart only while Gate C's original IDs still exist, old source custody/integrity is established and no other authority has required writes.
- After original IDs replaced: separately approved recreation requires the reviewed exact-image OLD-PATH baseline. Never substitute new IDs into Gate C recovery or run mutable legacy Compose as root.
- New startup/validation before traffic: first quiesce new writers under reviewed approval and determine whether startup/tests wrote anything. Old-source recovery requires explicit acceptance that no required writes will be lost; health is insufficient.
- After required new writes or accepted reopening: NEW pair is authoritative. No old-source restart/restore or automatic downgrade. Quiesce TEST, verify/retain a fresh paired backup and approve forward repair or separately designed reverse migration.

After concrete inputs, copy code, verification/startup commands and both recovery paths complete review and disposable validation, record the FINAL execution-package hash in Gate C's `gate_d_procedure_sha256` and attest readiness. This candidate sheet alone must never be used to set `gate_d_ready=true`. Readiness permits scheduling Gate C; Gate D execution remains a separate decision.
