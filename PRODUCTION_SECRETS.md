# Production secrets — future operator procedure

Do not execute these against a production environment during Stage 4A. No future production value was generated/saved here. Existing integration/staging validation uses disposable synthetic values only.

Use a protected administrative session with `set +x`, no terminal recording, no screenshots/tickets/chat pasting, and `umask 077`. Docker access is root-equivalent. Long-lived production config belongs at `/etc/carserviceapp/.env.production` (root:root, 0600), outside Git, image builds and public uploads. `.env.production` is ignored; only its fake example is tracked. Encrypted backups of the config need equivalent protection; do not archive plaintext secrets into routine application-data artifacts.

## JWT key

Generate **64 cryptographically random bytes**, base64 encoded. Application minimum is 32 bytes with weak-material checks; use randomness rather than a passphrase or re-encoding an old exposed key. After copying the template once to its protected destination, this future command updates only `JWT_KEY` without displaying it:

```bash
# FUTURE VPS ONLY. File must already be a protected, reviewed regular template copy.
sudo python3 - <<'PY'
import base64, os, pathlib, secrets, stat, tempfile
p = pathlib.Path('/etc/carserviceapp/.env.production')
info = p.lstat()
if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077:
    raise SystemExit('Refusing unprotected or linked config')
lines = p.read_text().splitlines()
if sum(line.startswith('JWT_KEY=') for line in lines) != 1:
    raise SystemExit('Expected exactly one JWT_KEY line')
key = base64.b64encode(secrets.token_bytes(64)).decode('ascii')
fd, temp = tempfile.mkstemp(prefix='.env-new-', dir=p.parent)
try:
    with os.fdopen(fd, 'w') as out:
        out.write('\n'.join('JWT_KEY='+key if line.startswith('JWT_KEY=') else line for line in lines)+'\n')
        out.flush(); os.fsync(out.fileno())
    os.replace(temp, p)
finally:
    if os.path.exists(temp): os.unlink(temp)
PY
```

Edit issuer/audience to stable installation-specific absolute URI/URN identifiers, not the rejected example values. They are identifiers, not a requirement to host a URL. `JWT_KEY`/scope shell variables override Compose env-file values; ensure no stale exported values mask the protected file. Do not run unredacted `docker compose config`, `docker inspect` environment dumps or shell tracing with real secrets.

Rotation: prepare/protect a new unrelated key, schedule re-login, recreate the backend with the new environment, verify new login and rejection of an old test session, then protect/retire old config copies. Signing-key rotation invalidates **all** existing JWTs; scope changes can also invalidate tokens. Account password changes/logout separately revoke that account's sessions. If a key is exposed, rotate promptly and treat compromised accounts/host access separately; no dual-key refresh infrastructure exists.

## Initial administrator password

Use a password manager's CSPRNG to generate/store at least 32 ASCII random characters, or generate an equivalent protected local password-manager import using Python `secrets.token_urlsafe(24)` (32 ASCII chars, below 72 UTF-8 bytes). Do not print a generated value into a recorded terminal. Never reuse browser fixture/test passwords or a historical sample credential.

Optional future OS command for a **new** root-only transfer file (refuses overwrite, prints no value):

```bash
sudo python3 - <<'PY'
import os, pathlib, secrets
os.umask(0o077)
with pathlib.Path('/etc/carserviceapp/initial-admin-password.once').open('x') as out:
    out.write(secrets.token_urlsafe(24)+'\n')
PY
```

Transfer through a protected password-manager workflow, then remove that exact temporary file after confirmed secure retention/provisioning. Ordinary deletion is not a guarantee of secure erasure on SSDs/snapshots; protect the host and any copies throughout. Do not put the file in source, logs or the application-data backup directory.

Provisioning is **explicit only** and requires an empty Users table. Use an interactive, non-recorded admin shell to enter the chosen login/password with hidden password input, pass environment **by name**, then unset it. Exact commands and checks are in [PRODUCTION_DEPLOYMENT_RUNBOOK.md](C:/CarServiceApp/CarServiceApp/PRODUCTION_DEPLOYMENT_RUNBOOK.md). The password is not a CLI argument, YAML value or long-lived backend env entry. Privileged host/Docker operators can still inspect a running one-off container's environment; this is a trusted administrative boundary. `--rm` removes the one-off container after completion, not that trust requirement.

No automatic startup/default account is created. Existing accounts are never overwritten by provisioning. A success exit on an already populated Users table does not mean a new admin was created. Verify account inventory and actual login. The development-only local recovery command is not a production reset procedure.
