# Paired SQLite/upload backup and restore plan

**No real backup or production restore has been performed.** The tools are preparation for later Linux validation. Local synthetic tests are not evidence that a future VPS backup/offsite recovery works.

## Components and consistency

Back up the SQLite database (business records, accounts, audit, EF migration history) **and** the complete ordinary-file upload tree as one recovery set. Separately protect production env/secret/ingress configuration and the release/image identifiers. Secrets are not embedded in application-data archives. Provider VM snapshots are an additional recovery aid, never the only backup.

Use one application instance and durable local filesystem binds, not ephemeral container layers or a shared network DB. SQLite may use WAL: `app.db-wal` can contain committed data not in `app.db`; `app.db-shm` is coordination state. Do not copy only a live main file with cp/rsync. The prepared helper uses the [SQLite backup API](https://www.sqlite.org/backup.html) via [Python sqlite3.backup](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup), producing a self-contained destination with DELETE journal mode. It does not change the source journal mode. A read-only connection can create empty coordination sidecars; it does not alter business records.

SQLite backup gives a consistent **database** snapshot, but cannot coordinate uploaded files atomically. Therefore the operating strategy is a brief, scheduled **cold paired backup**: stop the frontend and backend and all one-off/provisioning/file-maintenance writers, finish the pair, then restart. `--quiesced` is an explicit operator assertion, not proof that every process has stopped. Source DB/WAL/upload inventories are checked for changes as an extra safeguard, not a substitute for stopping writes. Schedule downtime outside workshop hours and alert on overruns/failures.

## Prepared tools (Python 3.12+ stdlib and Bash)

Run these later from a reviewed root-owned release in a protected administrative session, after stopping writers:

```bash
bash "$RELEASE/scripts/backup.sh" \
  --db /opt/carserviceapp/data/app.db \
  --uploads /opt/carserviceapp/uploads \
  --output /opt/carserviceapp/backups --quiesced

# Explicit NEW temp target only; replace the example suffix per test. No production restore.
bash "$RELEASE/scripts/restore-test.sh" \
  --backup /opt/carserviceapp/backups/REPLACE_WITH_VERIFIED_BACKUP_DIRECTORY \
  --target /var/tmp/carserviceapp-restore-test-REPLACE_WITH_UNIQUE_TEST_ID
```

Backup creates `backup-<UTC>-<random>/` containing `database.sqlite`, `uploads.tar.gz`, bounded `manifest.json` (file hashes/sizes and allowlisted table counts), and `SHA256SUMS`. It checks database integrity/FKs, source stability and output checksums. Publication uses a completed-directory rename; incomplete work remains `.partial-*` for operator review and is not a successful backup. An exclusive `.backup.lock` prevents overlapping jobs. A crashed job's stale lock needs explicit review, not blind deletion. Root-owned output is mode 0700; artifacts 0600. Checksums detect corruption, **not authenticity** against an attacker who can rewrite the entire set. Preserve trusted encrypted/offsite provenance.

The restore test verifies artifact hashes, validates archive member names/types/sizes, refuses links/special files/traversal and existing targets, restores only under `/tmp` or `/var/tmp` with a `carserviceapp-restore-test-` basename, then verifies SQLite integrity/FKs/table counts and each file hash. The parent must already exist; nested parents below the system temp root must be operator-owned and not writable by other accounts. It never starts an application or overwrites production. Default upload expansion ceiling is 1 GiB, above the app's 256 MiB managed quota; a larger approved legacy set needs an explicit reviewed `--max-upload-bytes` value and disk capacity. Files are restored with safe operator ownership/modes, not tar-supplied owners. Empty upload directories/ACLs are not a portable recovery artifact; application deployment permissions are prepared separately. Failed tests retain their isolated target for inspection; only a successful `RESTORE_VERIFIED.json` indicates completion.

Source/output/target paths must be explicit absolute paths without links/parent traversal. DB/uploads/output must not overlap. Tools log status and artifact directory names, not record contents/passwords/tokens. Do not enable shell tracing. Future Linux UID/mode/durability, real filesystem failure, offsite transfer and full application recovery checks still must run.

## Daily automation and retention (design, not installed)

Initial policy: daily quiet-window paired backup; encrypted off-VPS copy after each successful set; 14 daily, 8 weekly and 12 monthly offsite snapshots, subject to capacity/owner review. Keep local completed sets for about seven days once offsite copies and a restore have been verified. Local tools intentionally do **not** prune anything. Never delete the only validated recovery set or count `.partial-*` as one.

Later install a root-owned timer/wrapper which obtains one maintenance lock, stops both services using the exact production Compose/env/release context, invokes backup, restarts both in a failure-safe trap, checks health, transfers the completed set and reports each result. Do not run a generic cron `cp app.db`. A failure to transfer is a backup incident even if the local pair succeeds. Test restart-on-failure before enabling a schedule. No timer/service was installed here.

Recommended offsite mechanism: a separately administered **Restic encrypted repository**, on storage outside the VPS failure/account boundary, using root-only credential/password files or a protected credential provider. Do not put passwords in arguments, Git or environment dumps. Later commands use operator-configured `RESTIC_REPOSITORY`/`RESTIC_PASSWORD_FILE` and destination credentials; no endpoint/account was created here:

```bash
# Future operator-owned configuration only; successful completed set selected explicitly.
restic backup /opt/carserviceapp/backups/REPLACE_WITH_COMPLETED_SET --tag carserviceapp
restic snapshots --tag carserviceapp
restic check
# Review selection first; this command is non-destructive.
restic forget --tag carserviceapp --group-by host,tags --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --dry-run
```

Group by host/tags because each completed backup has a new timestamped path; grouping by paths would isolate every set and defeat this retention policy. Only separately approved maintenance removes snapshots/prunes after review; it must not overlap backup. [Restic retention documentation](https://restic.readthedocs.io/en/stable/060_forget.html) describes grouping and pruning semantics. Do not assume an offsite success until a snapshot can be listed, checked and restored. Encryption keys/repository access must remain recoverable if the VPS is lost.

## Restore verification and incident order

1. Contain an incident and stop writes. Preserve the failed system/data for investigation; do not overwrite it as the first step.
2. Select a trusted paired set and matching application release/image IDs. Restore an offsite copy to a protected isolated location; verify authenticity/access and checksums.
3. Run `restore-test.sh` against a fresh temp target. Review integrity/FK/count/file checks, then perform application smoke tests in a **separate isolated Compose project**, with synthetic replacement secrets and no public traffic. Its audit remains historical evidence, not data to edit.
4. For actual production recovery, obtain explicit operator approval; plan replacement of the entire matched DB/upload pair, correct 1654 ownership and safe modes while services remain stopped. Preserve the prior pair; never mix current uploads with an unrelated older DB. The prepared script deliberately does not automate this destructive step.
5. Start the correct release against the reviewed pair, let required migrations fail closed, verify login/roles/records/audit/images/print and backup freshness, then restore traffic. If compromise involved secrets, rotate/revoke appropriately; restoring a DB may resurrect old user/session state, so deliberately revoke/rotate before public access.

Target recovery assumptions: daily backup implies up to roughly one day of data loss; recovery time is unmeasured until a full drill. Quarterly restore drills and a drill before important schema upgrades are recommended. Disk-full can stop migrations, uploads or required audit-backed writes; monitor DB/WAL/upload/local-backup/offsite capacity and alert before exhaustion. No claimed backup SLA or legal retention conclusion is made.
