# Security Stage 3C — Repository and container hygiene

Scope: SEC-017 only. Baseline: clean committed Stage 3B `52ce5e1`
(`Upgrade supported runtimes and dependencies`). HEAD and the recorded upstream ref both resolved
to that commit before changes. No unrelated local edits were present. No commit or push was made.

The plan was to inventory tracked/local runtime material and current build contexts; correct ignore
rules and preserve/untrack runtime files; define non-root runtime identities and writable paths;
add compatible Compose controls and minimal health probes; then run source/build/security regressions
and static container checks. Docker is unavailable, so Linux/container execution is not claimed.

## Git hygiene

The root .gitignore is now a shorter, grouped policy covering:

- SQLite .db/.sqlite/.sqlite3 files and WAL/SHM/journal sidecars;
- backend-data, uploads and user-uploads directories;
- .env files, local configuration overrides, secrets and private-material file extensions/directories;
- node_modules, bin/obj, dist/publish/out and package/build caches;
- browser runtime data, test results, review artifacts, coverage, temporary logs and local validation tools;
- IDE/machine files and editor backups, plus the two specifically identified empty shell outputs.

The ineffective `appsettings.Development.json` rule with an inline comment was replaced by an exact
rule, with the explanation on a separate comment line. `git check-ignore -v --no-index` confirms the
Development file is ignored. Existing subordinate ignore files remain; no source directory was hidden.

Checks also confirm exclusions for sample runtime uploads, database sidecars, .env.local, browser
screenshots and a portable .stage3b-tools directory. Migrations, application source, appsettings.json,
test source, security reports and deliberately safe .env.example configuration remain eligible for
tracking. Security/business reports were not broadly ignored and no global image-extension rule hides
source assets. New files with intentionally safe private-material fixtures would require an explicit
reviewed exception; none exists or was needed in this repository.

## Files removed from future tracking, preserved locally

`git rm --cached` was used only for:

- .gitignore~
- Backend/CarServiceShop/CarServiceShop/response (empty)
- Backend/CarServiceShop/CarServiceShop/{ (empty)
- Backend/CarServiceShop/CarServiceShop/uploads/profile_1_639065315373620280.png
- Backend/CarServiceShop/CarServiceShop/uploads/profile_1_639065318061196530.png

All five working copies remain byte-identical, verified by SHA256 before/after. Profile pictures were
identified by their runtime paths and file metadata; their contents/identities were not inspected.
They may contain personal material and should not be included in future source snapshots.

The five index deletions are intentionally staged because removing tracking requires an index change;
the implementation files have not been staged or committed automatically. Historical Git objects still
contain previously committed images/files. No history rewrite, historical erasure or secret rotation
was performed or claimed. If the images require historical privacy cleanup, that is separate work.

The real local database, its WAL/SHM files and Frontend/.env.local also remain byte-identical. No real
database was opened for write, migrated, reset, copied into a container or used by regression tests.
The existing development-only administrator recovery block/helper/test are unchanged.

## Docker build contexts

Focused .dockerignore policies now exist at all three actual build-context roots:

| Context | Included build inputs |
|---|---|
| Repository root, combined image | Explicit backend application subtree and frontend package/TypeScript/Vite/src inputs |
| Backend/CarServiceShop | Application subtree and Dockerfile, without the sibling test project |
| Frontend | Package lock/manifests, TypeScript/Vite config, index/src and required Nginx/header configuration |

The allowlists then exclude runtime data, uploads, database files, secret/local config, key material,
IDE data, dependencies, bin/obj, browser/review results, logs, editor backups and local tools. Root
parent-directory exceptions are followed by child exclusions so they do not accidentally re-include
the entire Backend/Frontend trees. Source migrations and production security helpers remain included.
Nginx main/site/header configuration is retained in the separate frontend image; the combined image
serves the SPA through ASP.NET and does not need Nginx.

The root Dockerfile now publishes the explicit application csproj instead of finding an arbitrary
first project. The backend Dockerfile copies only the application subtree and publishes using its
restore step. No test project or local build output is selected. The existing multi-stage layout
still copies only publish output/static assets into runtime stages; no SDK/Node build stage is used
as the runtime stage.

Static pattern simulation over the local tree at measurement time produced these file-input estimates:

| Context | Unfiltered files / bytes | Selected files / bytes |
|---|---|---|
| Root | 23,562 / 4,301,532,124 | 143 / 874,209 |
| Backend | 2,018 / 2,849,072,144 | 59 / 242,293 |
| Frontend | 20,900 / 1,448,135,948 | 88 / 634,445 |

These are logical file-size estimates using glob/parent matching, not actual Docker transfer sizes,
compressed layers or a Docker-engine validation. Generated local output changes the unfiltered sizes.
The check asserted that required csproj/lockfiles, migrations, source and Nginx files were retained,
and runtime/test/secret categories were excluded. Docker's special handling of its Dockerfile and
ignore file can also differ from the simulation. See [Docker context documentation](https://docs.docker.com/build/concepts/context/).

## Runtime identities and filesystem permissions

Both backend Dockerfiles set USER 1654:1654. The image application root/binaries/config remain
root-owned, readable by the service and not generally writable. At build time only /app/data and
/app/uploads are created with UID/GID 1654 ownership and mode 0700. No runtime chown, sudo or root
entrypoint was added. Container defaults use /app/data/app.db and /app/uploads; local non-container
database configuration is unchanged. Both backend images declare those data volumes.

The frontend retains the selected official Nginx image but explicitly runs master/workers as
101:101. A complete static main configuration omits the root-only user directive, places PID/temp
paths under /tmp and fixes worker count at two. The root initialization entrypoint is bypassed;
configuration/content are complete at build time. It listens on unprivileged port 8080, requiring no
privileged-port capability. Host ingress stays 127.0.0.1:5173, now mapped to internal 8080. Proxy
targets, network addresses, trusted-proxy configuration, SPA routing, headers and upload serving are
preserved. See the upstream [unprivileged Nginx configuration notes](https://github.com/nginx/docker-nginx-unprivileged).

| Service | Application writable locations |
|---|---|
| Backend/combined | /app/data, /app/uploads, bounded /tmp |
| Nginx frontend | bounded /tmp for PID and client/proxy/other temporary files |

Compose keeps the exact existing backend-data/user-uploads bind sources and targets. Long bind syntax
sets create_host_path:false: missing paths fail instead of silently creating new root-owned empty
directories. Existing bind data must be deliberately made readable/writable by the runtime identity
by an operator; image directory ownership cannot override host bind permissions. No real host
directory permission or ownership was changed. Container startup is not ready until that prerequisite
is satisfied. Guidance, including a command only for NEW EMPTY Linux directories and namespace/ACL
caveats, is in CONTAINER_HYGIENE.md.

## Capabilities, security options and resource bounds

Compose sets both services to read_only:true, cap_drop:[ALL] and no-new-privileges:true. Explicit
runtime data binds remain writable. /tmp is tmpfs with rw/noexec/nosuid/nodev and mode 1777; data
directories are not world-writable. Backend HOME points into /tmp so framework-local temporary home
state does not require writing application binaries/configuration. These are application-path
controls; ordinary engine-managed Linux pseudo-filesystems are not claimed to be absent.

| Service | Memory limit | CPU quota | PID/thread limit | tmpfs bound |
|---|---|---|---|---|
| Backend | 1 GiB | 1 CPU | 256 | 128 MiB |
| Frontend | 128 MiB | 0.5 CPU | 64 | 32 MiB |

These conservative initial bounds require workload verification, especially on a small host. Nginx
does not use one worker per host CPU, avoiding conflict with the process budget. Service-level
mem_limit/cpus/pids_limit apply to local Docker Compose on supported Linux engines. This is not a
Swarm deploy specification; Swarm semantics must be reviewed separately. Limits constrain whole
containers and do not implement SEC-009 request quotas, pagination or per-user controls. See
[Compose service settings](https://docs.docker.com/reference/compose-file/services/).

Image USER and directory ownership also apply outside Compose. Read-only rootfs, dropped capabilities,
tmpfs and resource bounds are Compose settings; direct image runs must explicitly supply equivalent
controls. No claim is made that a bare docker run automatically inherits all Compose protections.

## Health checks

Added anonymous GET /healthz returns only fixed `healthy` text and Cache-Control:no-store, with
the existing security headers. It exposes no configuration, database contents, credentials or stack.
Startup still validates required security configuration and finishes required migrations before
listening. The health route performs no ongoing database query and does not certify all business
operations or disk capacity.

The backend image invokes `dotnet CarServiceShop.dll --healthcheck`: a bounded three-second loopback
HTTP client requiring 200 from port 8080. It disables redirects and proxy use, sends no credentials
and returns exit code 1 on connection/timeout/non-200 status. The exact CLI option exits before
host creation, configuration validation or migrations. It cannot select another URL or user through
request input. No curl/package installation was needed in the runtime image.

Nginx health uses the selected Alpine image's wget to retrieve its static document over loopback.
Backend interval/timeout/start-period/retries: 30s/5s/30s/3; frontend: 30s/5s/10s/3. Compose initially
waits for backend service_healthy before Nginx starts. This is a lightweight serving probe, not a
monitoring/restart platform. A live process with failed HTTP serving is unhealthy.

A separate published Production host using a fresh disposable database was started locally on
loopback 8080. The HTTP probe returned healthy; CLI probing succeeded even with deliberately invalid
startup configuration, proving it does not initialize/migrate another host. After stopping that
specific test process, the CLI returned unhealthy. No real backend process/data was stopped or used.
This verifies Windows application/probe behavior, not a Linux Docker healthcheck.

## Secret and image-content review

Before changes, 202 tracked paths were reviewed by a filename/content-pattern inventory. There were
no tracked databases/sidecars, .env files, private key/certificate files, node_modules, bin/obj or
generated browser artifact directories. The two runtime PNGs and three scratch/backup files above
were the confirmed tracking problems. Existing local IDE databases, the application database,
Frontend runtime artifacts and ignored .env.local were inventoried without deleting them.

The text scan looked for JWT literals, base64 signing-key assignments, password/secret/token/API-key
assignments, credential-bearing connection strings, provider token formats and private-key markers.
Binary profile images were not decoded. Lockfile integrity hashes were excluded from entropy-like
token matching. Fifty-two initial heuristic lines were classified as synthetic tests/test-provisioning
credentials or validation-message assignments; no likely real signing key, API token, credential
connection string or private material was confirmed. A second high-confidence scan of current
source, including new files, also found no secret candidates. No actual secret values are reproduced
here. Gitleaks/other dedicated secret scanners are unavailable; this is a scoped heuristic/current
content review, not proof that all secrets or historical exposures are absent.

Compose's external JWT key/issuer/audience placeholders remain external. No initial administrator
password, production token or private certificate was added to Dockerfiles/Compose. No real .env
file was added. No rotation or Git history rewrite was performed. Expanded real Compose environment
output was never logged; the static YAML check used the literal placeholder file.

The explicit Release publish target succeeded and its output was inspected. No source/test/SDK,
MSBuild Tasks, NuGet tooling or EF Design assembly was found in that application publish output.
Final Docker stages only copy those published files/static assets plus required Nginx configs.
Inherited shells/package managers in supported official runtime base images were not manually
removed; non-root identity, dropped capabilities and read-only rootfs constrain their runtime use.
Actual image layers and Linux binaries were not inspected or scanned without Docker/scanner tooling.

## Verification

| Check | Result |
|---|---|
| dotnet restore | Passed |
| Backend build and explicit Release publish | Passed |
| Backend tests | 129 passed, 0 failed, 0 skipped (122 existing + 7 health cases) |
| Frontend npm ci | Passed; no reported npm vulnerabilities |
| Strict TypeScript | Passed |
| Frontend production build | Passed |
| Complete Chromium suite | 78 passed, 0 failed |
| Migration/model consistency | Passed in existing migration-upgrade/preservation/HasPendingModelChanges tests |
| Git ignore/source-preservation checks | Passed |
| Untracked runtime files + real local data hashes | Unchanged |
| Compose YAML/selected controls/static COPY-input checks | Passed, static only |
| Published local HTTP/CLI health behavior | Passed against disposable data |
| git diff --check and cached diff check | Passed |
| Docker Compose config/build/up/UID/mount/capability/health verification | Not run: Docker unavailable |
| Nginx runtime syntax/permissions and image vulnerability scan | Not run: Nginx/Docker/scanner unavailable |

New Stage3CHygieneTests cover anonymous fixed/noncached health, 200 versus non-success/redirect/auth
statuses and connection/timeout failures. No existing test was weakened or changed. Stage 1–3B
password/session/JWT/authorization/CORS/header/upload/concurrency/history tests and all Chromium
workflows remain. There are no migration/model changes or dependency upgrades in this stage.

## Changed/new/removed files

Modified:

- .gitignore
- Backend/CarServiceShop/CarServiceShop/Program.cs
- Backend/CarServiceShop/Dockerfile
- Dockerfile
- Frontend/Dockerfile
- Frontend/nginx.conf
- docker-compose.yml

New:

- .dockerignore
- Backend/CarServiceShop/.dockerignore
- Frontend/.dockerignore
- Backend/CarServiceShop/CarServiceShop/Security/ContainerHealthProbe.cs
- Backend/CarServiceShop/CarServiceShop.Tests/Stage3CHygieneTests.cs
- Frontend/nginx-main.conf
- CONTAINER_HYGIENE.md
- SECURITY_STAGE_3C_REPORT.md

Removed from the index only: the five paths listed earlier. All five local files are preserved.
No business data, migrations, test sources or reports were deleted.

## Warnings, limitations and deferred work

The actual backend/frontend effective Linux UID/GID, bind permissions, SQLite/upload writes under
read-only/capability constraints, tmpfs compatibility, health states, resource enforcement and final
image-layer contents must still be verified using disposable containers on an available Docker
engine. The static simulation/YAML checks are not docker compose config, docker build, nginx -t or
a running-container security verification. No vulnerability-free image claim is made. The exact
future verification checklist is recorded in CONTAINER_HYGIENE.md.

The existing CS8618 User.Role warning, ESLint 9 deprecation, npm esbuild install-script notice and
cosmetic browser color-environment warning remain. Portable .NET 10/Node 24 tools from Stage 3B were
used for validation; they remain outside this Git repository. No unrelated recovery logic was edited.

SEC-009 application resource quotas/pagination and SEC-018 audit trail are explicitly deferred.
No Stage 3D, deployment, public HTTPS/domain/certificate setup, monitoring platform, database-provider
migration, data ownership migration or unrelated feature work was started.

## Scoped gate

**Security Stage 3C scoped source/static gate: PASS.** All executable application regressions and
static hygiene checks pass. **Docker runtime verification remains UNVERIFIED**, including effective
identity, writable mounts, capability/resource enforcement and Linux Nginx/health behavior. This
does not approve public deployment or represent a passed running-container gate. Changes remain
uncommitted for user review; only the five intentional untracking deletions are staged.
