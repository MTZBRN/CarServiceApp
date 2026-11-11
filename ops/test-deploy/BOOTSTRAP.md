# Operator bootstrap (prepared, not executed)

Keep `TEST_DEPLOY_ENABLED` unset/false and `actions-enabled` absent throughout.
These commands are for a later authorized local operator session, first on the
disposable VM. They are not permission to access or change the VPS now.

1. Record the protected release tip, CI push run URL and installed helper hashes.
   The supplied status is candidate `7d958d1`, running TEST `8b6b7ad`; use full SHAs
   obtained from GitHub at activation. Any promotion of this change produces a new
   candidate requiring new push CI and approval. Local tracking refs are stale.
2. Inspect only Docker metadata for existing TEST names, IPAM, mounts, image IDs,
   health, loopback port and network ownership. Confirm no alternate daemon,
   host job or external writer shares TEST storage. Do not inspect customer files
   or any `prod-data` / `prod-uploads` tree. Preserve the old TEST Compose and env
   privately for recovery, without overwriting the existing worktree Compose.
3. Use a root-owned reviewed staging directory containing only the deployment
   scripts and template. Install OS packages by the OS/vendor-supported method:
   Python 3.12+, Git, GitHub CLI, Docker Engine, Compose v2, sudo, OpenSSH, tar.
   Confirm Compose supports `config --format json` and `up --wait`. Do not install
   or upgrade shared-VPS packages without a separate maintenance decision.
4. Inspect ancestors for symlinks/unsafe ownership before installation. Existing
   paths must be root-owned and non-writable by group/other; stop on discrepancies.
   On a fresh installation, from the reviewed staging directory as root:

   ```sh
   umask 077
   install -d -o root -g root -m 0711 /etc/carservice-test-deploy
   install -d -o root -g root -m 0700 /var/lib/carservice-test-deploy
   install -d -o root -g root -m 0700 /var/lib/carservice-test-deploy/home
   install -d -o root -g root -m 0700 /opt/carserviceapp/test-backups
   install -o root -g root -m 0755 scripts/test_deploy.py /usr/local/sbin/carservice-test-deploy
   install -o root -g root -m 0644 scripts/ops_storage.py /usr/local/sbin/ops_storage.py
   install -o root -g root -m 0755 scripts/test_deploy_preflight.py /usr/local/sbin/carservice-test-preflight
   install -o root -g root -m 0755 ops/test-deploy/ssh-gate /usr/local/sbin/carservice-test-ssh-gate
   install -o root -g root -m 0600 ops/test-deploy/docker-compose.test.yml /etc/carservice-test-deploy/docker-compose.test.yml
   ```

   These are explicit installation destinations, not a recursive chown procedure.
   Do not blindly rerun over a prior installation or change live storage ownership.
   Existing TEST data/uploads must match image UID:GID `1654:1654`; preflight
   rejects group/other writable entries. Resolve any mismatch separately with the
   operator. Preserve frontend UID:GID `101:101` from its image.
5. Review `/opt/carserviceapp/.env.test` privately, root:root 0600. It must contain
   `JWT_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE` and the existing TEST network's
   `TEST_SUBNET`, `TEST_BACKEND_IP`, `TEST_FRONTEND_IP`. No value is guessed here.
   The explicit project is `carserviceapp-test`, network
   `carserviceapp-test_workshop`, frontend `127.0.0.1:5174 -> 8080`, backend has no
   published port. Only `/opt/carserviceapp/test-data` and `test-uploads` are bound.
   Do not use the base Compose subnet unless metadata confirms it belongs to TEST.
   Image health checks are inherited. No build, includes, env_file, host config
   binds, or staging overlays are used. JSON syntax in the `.yml` file is intentional.
6. Create the root-private bare mirror only if absent, using the fixed HTTPS URL:

   ```sh
   HOME=/var/lib/carservice-test-deploy/home git clone --bare https://github.com/MTZBRN/CarServiceApp.git /var/lib/carservice-test-deploy/source.git
   chmod 0700 /var/lib/carservice-test-deploy/source.git
   ```

   Provision read-only HTTPS credentials separately if needed. Audit Git config
   and hooks; no URL rewrites, proxy commands or executable hooks. Provision the
   Actions-read token and per-release approved.json per README, both root:root
   0600. Never put secrets in command arguments, shell history or CI artifacts.
7. Run `/usr/local/sbin/carservice-test-preflight` as root. This does not deploy,
   fetch, read database rows or require activation. It checks installed protected
   paths, packages/Compose, TEST model/IPAM, live container isolation and health,
   storage metadata/ownership, symlinks/hardlinks/submounts and free space. It fails
   closed. It is also called automatically before deployment.

   Disk budgets are aggregated per filesystem: Docker 10 GiB, build state 2 GiB,
   backup and restore scratch each `2 * TEST file bytes + 1 GiB`. This is a minimum
   admission reserve, not a build-size guarantee. Reserve CPU/RAM separately;
   the existing verifier's 1 GiB expanded-upload bound still applies. No filesystem
   traversal touches another project's storage. Verify network IP choices are
   unoccupied; preflight matches subnet and trusted proxy, not all possible writers.
8. Finish all rehearsal cases in REHEARSAL.md and archive synthetic evidence.
   Then provision the restricted SSH account, root-managed keys/sshd and no-args
   sudo rule from README. Validate `sshd -t`, `visudo -c`, effective Match rules and
   command denial locally. The CI identity must not have Docker membership or
   write access to runtime paths. No SSH/key is needed for the offline tests.

## Workflow-only registration on main

`register-main.patch` adds only `.github/workflows/deploy-test.yml`, byte-for-byte
from this review. The live main-path lookup returned 404; recheck before applying.
The patch contains no application, CI, runtime scripts or secrets. Its jobs cannot
run from main because the authorize job explicitly requires protected test-deploy.
There is no push trigger. The standalone SSH job does not need scripts on main.

After explicit authorization to prepare a branch against a freshly fetched main:

```sh
git worktree add -b bootstrap/register-test-dispatch ../register-test-dispatch origin/main
git -C ../register-test-dispatch apply --check /absolute/path/to/register-main.patch
git -C ../register-test-dispatch apply /absolute/path/to/register-main.patch
git -C ../register-test-dispatch diff --name-only
git -C ../register-test-dispatch diff --check
```

Require exactly the one workflow path in the diff; compare its contents to the
reviewed release workflow. Stop if it already exists or main has moved in a way
that changes assumptions. Do not merge test-deploy or cherry-pick the application
merge into main. Review a workflow-only PR; commit/push/merge need authorization.
No worktree, branch, commit, push or merge was created by this preparation.

## Activation checklist (all pending operator execution)

- [ ] Linux rehearsal and paired recovery evidence accepted.
- [ ] Current full release SHA has successful exact push Workshop CI.
- [ ] PR-only protected test-deploy, required CI, no force push/deletion/bypass;
      single-maintainer review settings and plan capabilities verified.
- [ ] Workflow-only main registration reviewed and explicitly authorized/merged.
- [ ] VPS metadata matches template; resource headroom and maintenance confirmed.
- [ ] Installed root files and preflight pass; mirror/token/approval reviewed.
- [ ] SSH restrictions and denial tests pass; independently verified host key.
- [ ] isolated-test branch-only environment and single-maintainer policy configured;
      environment secrets added only after those controls are verified.
- [ ] Separate activation authorization received. Only then create root-owned
      `actions-enabled`, set repository `TEST_DEPLOY_ENABLED=true`, dispatch at
      test-deploy with exact approved SHA, and approve the environment if available.
- [ ] Observe journal, health, revision, paired backup, migrations, SPA/API and
      authenticated synthetic smoke checks before reopening TEST traffic.
