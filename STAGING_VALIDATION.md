# Disposable Stage 4A container validation — prepared, not executed here

Docker/Nginx runtime verification remains outstanding. Local non-container tests cannot prove effective Linux identities, bind permissions, image contents, TLS forwarding or backup recovery on the future VPS.

## Prerequisites and command

Use a reviewed checkout on an **isolated Linux host**, local rootful Docker Engine/modern Compose, Bash, iproute2 (`ip -j`) and Python 3.12+ with sqlite3. Review the scripts first; root/Docker access is privileged. Check free RAM/disk for SDK/Node builds and compatibility with local/VPN subnets. It may pull public base images but never connects to a VPS, creates DNS or requests certificates. It is not a production deployment script.

```bash
# FUTURE DISPOSABLE LINUX ENVIRONMENT ONLY. No production env file is accepted.
sudo bash /absolute/reviewed/checkout/scripts/stage4a-validate.sh --port 15173
```

The runner refuses non-Linux/non-root execution, remote SSH/TCP Docker contexts, invalid/public port selection and any unexpected service/mount/host exposure in the resolved Compose configuration. Every engine operation explicitly pins the checked local Unix socket with `--host`; inherited `DOCKER_CONTEXT` is cleared so it cannot redirect operations. It creates its own `/tmp/carserviceapp-stage4a-*` directory, synthetic CSPRNG signing key/password and issuer/audience, and substitutes only disposable DB/uploads. It clears conflicting inherited production interpolation variables, never reads `.env.production`, and validates the resolved paths **before building/starting anything**. Documented production `/opt/carserviceapp` paths cannot satisfy its temp-root checks.

The runner resolves the existing Compose file to private JSON instead of maintaining a second deployment definition. It retains all hardening, uses unique project/image tags and a subnet avoiding existing Docker networks and specific host IPv4 routes, and publishes **only 127.0.0.1:15173** (or the chosen unprivileged port). It never changes existing networks/containers/data. Concurrent route/VPN changes and reserved local ranges still need operator review; do not alter production networking to force this test through. Rootless/remapped Docker needs a separate permission design, not weakened modes.

## Checks it will execute when Docker is available

1. Quiet Compose validation and both image builds with pull.
2. Backend startup/migrations on an empty disposable DB; no automatic/default user.
3. Stop backend, explicit one-off test-admin provisioning, then healthy frontend/backend startup.
4. `nginx -t`; effective UID/GID 1654/101; rootfs/capability/no-new-privileges settings, memory/CPU/PID/tmpfs controls and host port bindings.
5. Actual intended data/upload/tmp writes and denial in protected application/config paths.
6. Anonymous API denial, Production Seed unavailability, test login, customer/vehicle/worksheet create/edit, normalized PNG upload/headers and admin audit read.
7. Service restart, saved worksheet and image persistence with the original session.
8. Stop all test writers, paired synthetic backup and isolated restore verification (DB/audit/files).

The runner removes **only its own uniquely named Compose project** in `finally`. It retains the protected temp root, synthetic env, logs and `VALIDATION_PASSED.json` for review. A success marker is written only after checks succeed; always inspect exit/cleanup result too. If interrupted, inspect project labels and exact root before cleanup. No recursive data-directory deletion is built into the runner. Operators may remove their exact disposable paths after review; never substitute production paths or use broad wildcards.

Output/log files may contain synthetic config/identity and must stay private. Do not reuse the synthetic key/password/database for business. A passing run still does **not** verify public DNS/TLS/firewall, offsite storage credentials, production backup/restore, real storage durability or alert delivery. Those have separate release gates.

Local safety/unit checks:

```bash
bash -n scripts/backup.sh scripts/restore-test.sh scripts/stage4a-validate.sh
python3 scripts/tests/test_ops_storage.py -v
python3 scripts/tests/test_stage4a_safety.py -v
```

Stage 4A records actual local results in PREPRODUCTION_STAGE_4A_REPORT.md. No `VALIDATION_PASSED.json` is asserted without executing the real container runner.
