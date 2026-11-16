# Existing TEST storage migration and inactive installation

The accepted [storage rehearsal #2](https://github.com/MTZBRN/CarServiceApp/actions/runs/43888120652) used commit `809e23a5928844f06725bd04de0097262f9371c8` and archive SHA256 `7928a63a75a943f15acd8d1a4962ef0a3f711632acf9f8009cbf16e16b692d88`. All four fictional scenarios passed. The install manifest and helper bytes come from that archive. The frozen runtime template is available. The private baseline, recovery configuration and real runtime environment require operator preparation.

The operator observed two healthy services, zero disk shortfall and only the two expected writable backend binds. The preliminary budget was 15,033,020,416 bytes against 21,175,910,400 available. The custody scan reported 15 processes in other mount namespaces and 10 timer rows. No overlapping Docker mount or visible writable host descriptor was found. The earlier metadata snapshots suffice for preparation. Execution-time admission and custody confirmation remain required.

## Layout and ownership contract

| Path | Owner / mode | Purpose |
|---|---|---|
| `/srv/carserviceapp-test` | root:root 0700 | TEST-only trusted namespace; all ancestors root-owned, no links or group/other write |
| `data`, `uploads` beneath it | 1654:1654 0700 directories, 0600 regular files | Existing application storage format; DB is `data/app.db` |
| `backups` beneath it | root:root 0700; artifacts 0600 | New paired backups; existing legacy backups retained untouched |
| `/etc/carservice-test-deploy` | root:root 0711 | Existing restricted-SSH gate needs traversal; all contents private unless explicitly executable |
| `environment` beneath it | root:root 0600 | Reviewed JWT values and confirmed network interpolation inputs; no reference to live `.env.test` |
| `docker-compose.test.yml` beneath it | root:root 0600 | Standalone future runtime template, new storage binds |
| `baseline/compose.json` beneath it | root:root 0600; baseline dir 0700 | Reviewed, self-contained, same-revision cutover baseline with exact existing image IDs; approval input, never executed by deployment helper |
| `/var/lib/carservice-test-deploy` and `home`, `source.git` | root:root 0700 | Isolated mirror, journals, locks; no worktree reuse |

Do not change `/opt/carserviceapp`, its worktree, environment, storage or backup
permissions. Do not use symlinks or bind-mount aliases from the new hierarchy to
the old one. The existing alias/submount rejection remains. A separate filesystem
mounted beneath these paths would require a separate isolation design; do not
relax mount checks to fit one. Inspect `/srv` ownership, filesystem and free space
before creating anything; never repair an unexpected ancestor automatically.

The application sees the same `/app/data` and `/app/uploads` destinations. Docker
resolves host bind sources as root; container UID 1654 accesses the mounted leaves,
not the root-private host parent. Verify this with the actual images in a disposable
Linux test before scheduling migration. Frontend storage and UID remain unchanged.

## Existing evidence and required refresh

Reported existing revision: `8b6b7ad` (short, full revision not yet established).
Project `carserviceapp-test`, network `carserviceapp-test_workshop`, subnet
`172.30.91.0/24`, backend `172.30.91.2`, frontend `172.30.91.3`, frontend published
only on `127.0.0.1:5174` to container 8080. Existing backend host binds are expected
at `/opt/carserviceapp/test-data` and `test-uploads`; service storage owner is
1654:1654. Parent is 1000:1000 0750; live env is 0:0 0600. Native Compose is reported
5.7.0, Engine 29.9.2, Python 3.12.3; gh is missing. Both activation gates are disabled.
Exact current container/image IDs, mount records, full revision, network ID/gateway,
disk budgets and source sizes must be refreshed. No inventory of customer contents
has been collected by this work. TEST and PROD share the host and daemon.

At separately approved metadata review, use only selected fields, for example:

```sh
docker ps -aq --no-trunc --filter label=com.docker.compose.project=carserviceapp-test
# For each verified TEST ID, substitute the exact ID, never an unfiltered inspect:
docker inspect --format '{{.Id}} {{.Image}} {{.State.Status}} {{.State.Health.Status}} {{json .Mounts}} {{json .NetworkSettings.Networks}} {{json .HostConfig.PortBindings}}' REVIEWED_TEST_ID
docker network inspect --format '{{.Id}} {{json .IPAM.Config}} {{json .Labels}}' carserviceapp-test_workshop
```

Before Gate C record the named custody operator and recovery decision-maker, the window, who controls UID 1000, UID 1654, root and Docker access, the reviewed timers/private namespaces/external jobs, how TEST-only ingress and all writers will be excluded, and the time at which writing can resume.

Stop for extra TEST services, wrong project labels, shared writers/storage/network,
unexpected mounts, public publishing or changed IDs. Never print Config.Env, logs,
database rows, upload names or secret values. Preflight's existing cross-project
metadata isolation check is required; it never reads PROD files or changes PROD.
Coordinate a host-wide administrative change freeze during the maintenance window;
do not disable shared host services or change PROD as a shortcut.

## Inactive staging for the actual VPS native check

After explicit approval for this root-private staging directory only, confirm in GitHub Settings that the repository variable TEST_DEPLOY_ENABLED is absent or false. Use normal Windows PowerShell to start `ssh -tt -o BatchMode=yes gta-test`. At the remote operator prompt paste this single batch. It refuses a destination collision (including a dangling link), downloads only a public archive at the accepted SHA, verifies its bytes before extraction, and checks both subordinate manifests. No credential is required for the download. A partial directory remains private for operator inspection; stop rather than overwrite or clean it automatically.

```sh
sudo -k -- /bin/bash -se <<'GATE_B'
set -eu
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
stage=/root/carservice-test-migrate-6f3
python3 -I -B - <<'PY'
import os, stat
for name in ('/', '/root', '/etc', '/usr', '/usr/local', '/usr/local/sbin', '/var', '/var/lib', '/srv'):
    s = os.lstat(name)
    if not stat.S_ISDIR(s.st_mode) or s.st_uid or s.st_mode & 0o022:
        raise SystemExit('STOP: untrusted ancestor')
for name in ('/root/carservice-test-migrate-6f3','/etc/carservice-test-deploy','/var/lib/carservice-test-deploy',
             '/srv/carserviceapp-test','/usr/local/sbin/carservice-test-deploy','/usr/local/sbin/carservice-test-preflight',
             '/usr/local/sbin/carservice-test-ssh-gate','/usr/local/sbin/ops_storage.py'):
    if os.path.lexists(name):
        raise SystemExit('STOP: existing destination ' + name)
PY
test "$(docker compose version --short)" = 5.7.0
mkdir -m 0700 -- "$stage"
cd "$stage"
curl -q --fail --silent --show-error --proto '=https' --output review.tar.gz 'https://raw.githubusercontent.com/MTZBRN/CarServiceApp/809e23a5928844f06725bd04de0097262f9371c8/ops/test-deploy/review-artifacts/phase6f3-storage-review.tar.gz'
echo '7928a63a75a943f15acd8d1a4962ef0a3f711632acf9f8009cbf16e16b692d88  review.tar.gz' | sha256sum --check --status
tar --no-same-owner --no-same-permissions -xzf review.tar.gz
sha256sum --check --status SHA256SUMS
(cd review && sha256sum --check --status ops/test-deploy/INSTALL_ARTIFACTS.sha256 && sha256sum --check --status ops/test-deploy/CUTOVER_DIAGNOSTIC.sha256)
mkdir -m 0700 home
printf '%s\n' JWT_KEY=FICTIONAL JWT_ISSUER=fixture JWT_AUDIENCE=fixture TEST_SUBNET=172.30.91.0/24 TEST_BACKEND_IP=172.30.91.2 TEST_FRONTEND_IP=172.30.91.3 > environment
/usr/bin/python3 -I -B review/scripts/test_compose_native.py check --compose "$stage/review/ops/test-deploy/docker-compose.test.yml" --env-file "$stage/environment" --project-directory "$stage/home"
GATE_B
```

Return only the sanitized PASS/STOP. This stage creates no runtime destinations and installs no package. On failure leave the new stage inert; removal of that exact staging directory can be reviewed later without affecting either service. No proof of source custody is needed to create this fictional candidate. Before capturing any real configuration, obtain exclusive custody and verify identities and digests before and after capture. Prepare separate private same-image old-path and new-path baselines, with no embedded secrets, using exact running image IDs and identical network, ports, hardening and healthchecks. Validate both with native Compose. Review the actual runtime environment and its resolved model privately before cutover.

Only after native compatibility and Gate B checks pass may a separately approved
inactive install place the reviewed helper/preflight/storage/SSH-gate artifacts in
their normal root-owned destinations, install verified gh without changing shared
Docker, and prepare the isolated read-only mirror. No live SSH/sudo activation.
Installed preflight is expected to refuse old live mounts before cutover; never
change it to accept both layouts. Do not claim installation readiness yet.

## Gate C — explicit maintenance/migration approval and downtime start

No command below is authorized by this preparation. Operator must explicitly
approve **storage migration only, same images, no application release**, with a
maintenance window and recovery operator available. Confirm both gates disabled,
no approved.json, no competing automation, two exact TEST IDs/images unchanged,
source identity and isolation, trusted destinations and available capacity.

1. Close TEST ingress using a separately reviewed TEST-only method. Do not edit
   shared proxy/PROD routes. Exclude background jobs, clients and external writers.
2. Stop only the recorded frontend ID, then backend ID, and verify both exited.
   Do not use `compose down`, delete networks, or stop containers by broad filters.
   Downtime begins here. Record health/image/mount metadata privately.
3. Establish exclusive custody of legacy TEST source entries while capturing the
   pair. UID 1000 can rename these entries even with root-owned children. Coordinate
   administrative sessions and jobs, verify unchanged directory/device/inode/link
   metadata and absence of links/hardlinks/aliases before and after capture. A
   one-time check alone is not a defense against an active mutator. Abort if custody
   is uncertain; do not change the shared parent permissions.
4. Create a paired backup using the reviewed `ops_storage.backup` implementation
   into a fresh root-private migration backup directory. Never copy only app.db or
   discard WAL. The reviewed Python API call is:

   ```python
   pair = storage.backup(Path('/opt/carserviceapp/test-data/app.db'),
                         Path('/opt/carserviceapp/test-uploads'),
                         Path('/srv/carserviceapp-test/backups'), quiesced=True)
   ```

   Run only with verified stopped writers and custody; store the returned path in
   the root-private migration record, not public logs. Backup uses SQLite backup,
   includes committed WAL, checks integrity/foreign keys, upload hashes and source
   stability. Source SQLite access may create sidecars; this belongs to the later
   explicit migration authorization, not today's read-only preparation.
5. Run `storage.restore_test(pair, scratch, max_upload_bytes=reviewed_bound)` into a
   **new** `carserviceapp-restore-test-*` child of a fresh root-private directory
   under `/var/tmp`. Default limit is 1 GiB; review real requirements before changing
   the bound. Verify checksum inventory, full DB integrity, foreign keys, migration
   history, table counts and every upload digest. Keep detailed results private.
The above are the reviewed operation sequence and API primitives, not a turnkey
live migration script. Before Gate C, the operator must review a concrete execution
sheet populated with exact IDs, scratch paths, byte bounds and baseline hashes.
Missing values cannot be filled safely from the current evidence.

## Gate D — same-revision cutover, then installed preflight

Keep TEST ingress closed. Obtain explicit operator approval to recreate only the
two TEST containers with the reviewed baseline. Verify current existing image IDs
still match, native normalized baseline matches exactly, no build/pull is required,
and network identity is unchanged. First complete these destination checks after Gate D approval:

1. Only after restore verification, materialize **new absent** `data` and `uploads`
   directories from the verified restored pair, using exclusive creation, no links,
   no merge or overwrite and no raw tar extraction. Set ownership only in the new
   leaves to 1654:1654, dirs 0700/files 0600. Never apply recursive ownership changes
   to `/srv`, `/opt`, or an existing path. Copying/publishing procedure must verify
   actual resolved destinations and same-filesystem assumptions; do not move a
   scratch directory across filesystems and assume atomicity. On partial failure,
   keep new files quarantined, do not silently retry into them.
2. Recheck copied DB integrity, exact complete migration list, table counts and
   upload inventory against the verified pair. Confirm no copied SQLite WAL/SHM
   accompanies the restored standalone DB. Preserve the pair and old source intact.

Start backend first with no dependencies,
`--no-build --pull never --wait`; then frontend. Do not build or promote a revision.
The exact image IDs avoid tag drift. Starting the existing backend can run EF
startup code: require known matching migration history beforehand and stop if it
changes. Same-image startup must not be assumed to prove no schema writes.

Reinspect actual IDs/images/binds, IPs, ports, network ID, health, DB integrity,
schema history, business counts and upload inventory. Run smoke and authorized
fictional test-user checks while ingress is isolated. Document any deliberate
validation writes and distinguish them from migration corruption.
Run `/usr/local/sbin/carservice-test-preflight` with interactive sudo. It must pass
with new storage paths, root-controlled configuration, verified gh/mirror and
existing strict isolation/space checks. No fallback to old paths, no fixture adapter.
Compare PROD container IDs/images/state and network metadata to the private baseline
without accessing their data; investigate changes, never issue compensating PROD
commands. No shared resource changes are part of cutover.

Before reopening TEST, operator accepts the new storage as authoritative and records
the write boundary time. Downtime ends only after that approval. Keep old source,
backups and both recovery baselines protected and retained; no deletion/retention
job or automation activation is included. Refresh the paired backup after acceptance
under a separate quiesced backup window, not while writers are active.

## Rollback / failure boundaries

* Before stopping TEST: abandon inactive staging; services remain unchanged.
* After stopping, before recreation/new writes: if custody/integrity of old source
  remains verified, separately approve restarting the recorded old TEST IDs. If
  containers were replaced, use the privately reviewed old-path baseline with exact
  old image IDs. Never execute the mutable legacy worktree configuration as root.
* After new startup but before traffic: first stop new TEST writers and determine
  whether startup/validation wrote anything. Old-source rollback is allowed only
  after explicit acceptance that no required writes would be lost and old schema
  and sources remain valid. A healthcheck alone cannot establish this.
* After reopening or any required new write: the new pair is authoritative. Do not
  restart old data. Quiesce TEST, take and verify a new pair, retain failure evidence,
  and approve a forward repair or a separately designed reverse migration. No
  automatic overwrite, restore or database downgrade is supplied.
* On partial copy, failed checks, changed IDs or network: remain in maintenance and
  stop at that gate. Keep private evidence and all backups. Do not clear a deployment
  in-progress marker to force a retry; investigate any unexpected marker separately.

## Approval contract and final go/no-go

The installed helper and installed preflight load the same constants. Compose,
live mount checks, DB access, backup output and recovery journals all use the new
paths. `compose_sha256` now binds the root-controlled `baseline/compose.json`, not
the legacy worktree file. `env_sha256` binds the actual new `environment`, and
`frozen_compose_sha256` binds the runtime template. Every future release approval
must include `"storage_layout": "test-root-v1"`; missing/old layout is rejected.
All prior approvals are invalid. Create none during migration. Any baseline/env/
frozen-file change requires fresh review/hashes. The former worktree is never read
by the deployment helper. Runtime backup/restore verification algorithm is unchanged;
no automatic failure recovery is added.

GO for future inactive readiness requires all of: new Linux rehearsal evidence;
native Compose PASS; reviewed exact artifact versions; exclusive source custody;
paired backup AND full restored/copy validation; same-image accepted cutover; trusted
ancestors; new exact live mounts; unchanged TEST network/ports; no shared PROD mounts;
installed preflight PASS; recovery plan accepted; TEST acceptance complete; both
deployment gates still disabled. Otherwise NO-GO. Gate C and Gate D require explicit
operator approvals even if all preceding checks pass. Future automated deployment,
SSH activation and release approval are separate actions, never inferred here.
