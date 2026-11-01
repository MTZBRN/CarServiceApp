# Production deployment runbook — future execution only

No VPS has been purchased/configured. These steps are **not executed by Stage 4A**. Real customer data, real secrets and public traffic must wait for the later operational gate. Use one supported Linux VPS, rootful Docker Compose and one backend instance. All commands below are for a future protected administrative root shell; SSH normally uses a named key-based account plus controlled sudo.

## 1. Host, release and empty storage

1. Select/provision the Linux VPS later; update OS/time sync, create deployment admin, configure/test SSH keys and recovery console before disabling password/root SSH. Apply/review the firewall plan in SERVER_HARDENING_CHECKLIST.md. No application port becomes public.
2. Install supported Docker Engine/Compose from official distribution instructions. Verify daemon/socket access is restricted, no public Docker API, and Compose supports `config --format json` and `up --wait`. Install Python 3.12+ with sqlite3 and Bash for reviewed operator tools. Caddy/TLS installation comes only after the later ingress design validation.
3. Review/commit the intended release and all test results. Clone/copy that exact commit into `/opt/carserviceapp/releases/<full-sha>` using a read-only repository access method. Do not put tokens into clone URLs/history. Root owns release/config; UID 1654 must not write source. Record commit and image IDs; do not deploy a dirty worktree.
4. **For a new empty installation only**, create real (non-link) paths:

```bash
install -d -o root -g root -m 0755 /opt/carserviceapp /opt/carserviceapp/releases
install -d -o root -g root -m 0700 /etc/carserviceapp /opt/carserviceapp/backups
install -d -o 1654 -g 1654 -m 0700 /opt/carserviceapp/data /opt/carserviceapp/uploads
```

For existing paths/data, stop and inspect canonical paths, backups, ownership/ACLs and rootless/user-namespace behavior first. These commands are not authorization for recursive chmod/chown or replacing existing data. No chmod 777, DB resets or public DB/share.

## 2. Explicit configuration context

Set `RELEASE` to the actual reviewed release directory and `PRODUCTION_ENV=/etc/carserviceapp/.env.production`. Copy `.env.production.example` **once** to a new root-owned 0600 protected file; refuse overwrite if it exists. Replace fake values using PRODUCTION_SECRETS.md, choose installation-specific issuer/audience, correct absolute paths and set `APP_IMAGE_TAG` to the release's full Git SHA. Keep `ASPNETCORE_ENVIRONMENT=Production` fixed in Compose. Never deploy the template placeholders.

Use this explicit helper in the protected root shell (no xtrace):

```bash
set +x
umask 077
RELEASE=/opt/carserviceapp/releases/REPLACE_WITH_FULL_REVIEWED_COMMIT
PRODUCTION_ENV=/etc/carserviceapp/.env.production
dc() {
  env -u JWT_KEY -u JWT_ISSUER -u JWT_AUDIENCE -u DATA_PATH -u UPLOADS_PATH \
      -u FRONTEND_BIND_PORT -u APP_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME -u COMPOSE_PROFILES \
      docker compose --project-directory "$RELEASE" --env-file "$PRODUCTION_ENV" \
      -p carserviceapp -f "$RELEASE/docker-compose.yml" "$@"
}
dc config --quiet
```

The helper prevents stale host-shell interpolation values masking the protected file. Do not use unredacted `dc config`/Docker environment dumps with real secrets. Verify expected real binds and loopback-only ports through a redacted review; config syntax success alone cannot validate placeholder semantics or host permissions.

## 3. Images and isolated gate

Build both release-specific images with `dc build --pull`, recording immutable image IDs, base-image resolved digests and scan results. Alternatively use a separately reviewed pull-by-digest release process later; do not mix arbitrary tags/code. Keep previous validated release images and source for rollback. Building SDK/Node images can use more memory than runtime limits; validate capacity and use a maintenance window or later build pipeline rather than assuming a tiny VPS can build under load.

Before production, run the disposable procedure in STAGING_VALIDATION.md on an isolated Linux environment. `nginx -t`, UID/GID/mount/hardening/health/migration/login/upload/work/audit/restart tests must actually pass; Docker was unavailable during Stage 4A. Perform IMAGE_SECURITY_SCANNING.md checks and resolve HIGH/CRITICAL findings before go-live.

## 4. First database and exact initial administrator procedure

The backend calls `Database.Migrate()` **before serving**, then `--provision-admin` invokes the supported explicit provisioning path and exits without an HTTP listener. Required JWT config is still validated for that command. Users must be empty; existing accounts are never overwritten. The command is not a general reset/demotion/last-admin bypass.

Deliberately verify the protected env binds the **new intended empty** `/opt/carserviceapp/data` and uploads, not a development or existing DB. Use a unique administrative login, with a 32-character CSPRNG ASCII password already retained securely in a password manager. In the protected root shell:

```bash
if (
  set +x
  trap 'unset InitialAdmin__Email InitialAdmin__Password' EXIT
  IFS= read -r -p 'New administrator login: ' InitialAdmin__Email || exit 1
  IFS= read -r -s -p 'New administrator password (hidden): ' InitialAdmin__Password || exit 1
  printf '\n'
  export InitialAdmin__Email InitialAdmin__Password
  # Run only after the intended empty data path and image/config have been verified.
  dc run --rm --no-deps -e InitialAdmin__Email -e InitialAdmin__Password backend --provision-admin
); then
  printf '%s\n' 'Provisioning command completed; verify account inventory and actual login.'
else
  printf '%s\n' 'Provisioning failed; stop and inspect protected diagnostics.' >&2
  exit 1
fi
dc up -d --wait --wait-timeout 180
```

The temporary values are scoped to the subshell and unset on exit. Password values are not arguments/YAML/long-lived service env and are not printed. A privileged Docker operator can still inspect a short-lived container environment; protect that access. The service definition does not map temporary InitialAdmin values into normal web containers. If Users is already populated, provisioning returns without creating anything, so exit 0 is **not proof** of first-admin creation.

Verify login through the intended secure access path, role=admin, the admin account inventory and the `Auth.InitialAdminProvisioned` audit event. Confirm no fixture/default/sample account exists. Do not try guessed test credentials against production. Create personal mechanic/admin accounts with least required roles; do not share the initial credential. The Development-only recovery CLI is not the production reset runbook.

## 5. Migration procedures

**A. New installation:** empty reviewed binds, validated config/images, explicit one-off provisioning performs required migrations and creates the first admin. Normal startup also migrates, but never creates a default admin. Keep traffic closed until health/login/data checks pass.

**B. Upgrade / C. Existing production database:**

1. Review migration/schema diff and current applied history, selected release and compatibility. On an isolated restored copy, run the candidate's startup migration and tests first. Duplicate normalized usernames or other migration errors must be investigated; never silently merge/delete users.
2. Keep a validated paired backup and previous release/image IDs. Stop frontend and backend and all one-off writers; make/verify a fresh paired backup using BACKUP_AND_RESTORE_PLAN.md. Do not copy only a live DB. Keep public traffic at the maintenance edge.
3. Select/build the candidate's release-specific image tags and protected env context, then `dc up -d --wait --wait-timeout 180`. Startup migration failure must fail the deployment; on a failed health wait, explicitly `dc stop` and investigate. The unless-stopped policy otherwise retries exited containers; do not leave that initialization loop unattended, disable validation or force healthy status.
4. Check logs without exposing secrets, health and actual business reads/writes/audit/images/print. Health is liveness, not proof of DB writes. Complete RELEASE_CHECKLIST.md before traffic returns.
5. If startup/migration fails, stop the candidate, preserve failed data/diagnostics and do not allow a second app writer. If schema remains compatible, the reviewed old image/release may be selected; otherwise obtain approval to restore the **pre-upgrade DB/upload pair** and matching old release. Use isolated restore verification first. No automatic down-migration, EnsureDeleted, table reset or blind DB overwrite is permitted.

Explicit image tags matter: an old source checkout pointing to a newly overwritten image tag is not rollback. Record and retain both the old image IDs and paired backup; set the old reviewed tag/config deliberately. Restoring old DB state can restore old sessions/accounts, requiring security review before opening traffic. No new migration was needed or created in Stage 4A.

## 6. Ingress, smoke tests and go-live

After isolated gates pass, implement the reviewed host TLS/DNS/firewall and **two-hop client-IP/proto trust** design from TLS_INGRESS_PLAN.md in a later authorized stage. Current Nginx forwarding is intentionally not changed to trust arbitrary outer headers. Do not merely add a TLS edge and assume backend HTTPS/rate-limit identity works.

Validate actual certificate/renewal, redirect/HSTS, spoofed-header rejection, distinct source rate limits, private backend and actual Linux permissions. Then test login/session/logout, admin/mechanic restrictions, customers/vehicles/appointments, worksheet save/concurrency/completion/reopen/print, normalized upload, zero pricing/VAT settings and admin audit. Use synthetic trial records first.

Create an offsite backup, retrieve it and prove a restore/application trial in isolation. Verify monitor/alert delivery, disk/backup/certificate/restart checks and maintenance ownership. Only after an explicit separate release decision should real business data/public go-live occur. Stage 4A stops at preparation.
