# Security Stage 3B — Dependency and runtime upgrade

Scope: SEC-015 only. Baseline: clean commit `2b00430` (`Harden production security configuration`).
The dependency enumeration was run before editing manifests. No unrelated local changes were present.
The previously committed test-admin recovery files and Program.cs recovery block remain unchanged.
No commit, deployment, public HTTPS/domain configuration, database rewrite or provider change occurred.

## Runtime baseline

| Component | Before | After |
|---|---|---|
| Application/test target | net9.0 | net10.0 |
| Validation SDK | 9.0.308 | 10.0.403 |
| Validation ASP.NET/.NET runtime | 9.0.11 | 10.0.14 |
| Backend/root Docker SDK | 9.0 family | 10.0.403-noble |
| Backend/root Docker runtime | 9.0 family | 10.0.14-noble |
| Frontend/root Docker build Node | 20 / 18 | 24.22.2-bookworm-slim |
| Local Node used for verification | 24.22.1 | 24.22.2 |
| npm used for verification | 11.19.1 | 11.19.1 |
| Static frontend image | nginx:alpine | nginx:1.30.6-alpine |

.NET 10 is the supported LTS path with the smallest forward runtime-major change. As of this audit,
.NET 9 is still in maintenance, ending November 10, 2026; it is not yet unsupported. .NET 10 support
ends November 14, 2028. See Microsoft's [support policy](https://dotnet.microsoft.com/en-us/platform/support/policy).

Node 24.22.2 is supported LTS and preserves the workstation's existing major version.
[Node 26 has also just entered LTS](https://nodejs.org/uk/blog/release/v26.13.0), but introducing it
is unnecessary for Vite 7/Playwright compatibility. The
selected patch is documented in the [official Node release](https://nodejs.org/en/blog/release/v24.22.2).

global.json pins SDK 10.0.403 with latestPatch roll-forward and no previews. .node-version and both
npm manifests specify Node 24.22.2 (engines permit later 24.x patches). Builds now require those
baselines; the old machine-wide SDK alone cannot build net10.0.

For validation, official .NET/Node archives were downloaded into
`C:\CarServiceApp\.stage3b-tools`, outside the repository, and verified against Microsoft's SHA512
and Node's SHA256 release metadata before use. Commands prepend those portable tool directories to
their process PATH and set DOTNET_ROOT for child processes. Machine-wide SDK/Node installations
were not replaced. This temporary tools path is not embedded in application/project configuration.

## Backend dependencies

| Direct dependency | Before | After / disposition |
|---|---|---|
| Microsoft.AspNetCore.Authentication.JwtBearer | 9.0.0 | 10.0.14 |
| Microsoft.EntityFrameworkCore.Sqlite | 9.0.12 | 10.0.14 |
| Microsoft.EntityFrameworkCore.Tools | 9.0.12 | 10.0.14, PrivateAssets retained |
| Microsoft.AspNetCore.Mvc.Testing | 9.0.12 | 10.0.14 |
| Microsoft.EntityFrameworkCore.InMemory | 9.0.0 | 10.0.14, required by existing tests |
| Swashbuckle.AspNetCore | 10.1.0 | 10.3.1 |
| Microsoft.EntityFrameworkCore.SqlServer | 9.0.12 | Removed: no consumer/provider configuration |
| Microsoft.VisualStudio.Web.CodeGeneration.Design | 9.0.12 | Removed: no scaffolding consumer |

The EF/runtime packages move together to the same supported patched major/minor. SkiaSharp and its
Linux native assets remain 4.153.1, BCrypt.Net-Next remains 4.0.3, and unaffected test frameworks remain
unchanged. No preview packages are used. Searches found only UseSqlite in application startup and
UseInMemoryDatabase in the existing isolated controller tests; there is no SQL Server runtime path.

EF tooling is preserved. A repository-local dotnet-tools.json pins dotnet-ef 10.0.14; `dotnet tool
restore` and `dotnet ef --version` pass. There is no dependency on globally installed dotnet-ef.
EF Design is still provided by EF Tools. Existing migrations and the model snapshot were not edited.

## Backend advisories: before and after

Five unique vulnerable transitive package identities were reported before changes. The same inherited
findings appeared in the test project's graph. Neither project had a vulnerable direct package entry.

| Package before | Severity | Path / actual exposure | After |
|---|---|---|---|
| SQLitePCLRaw.lib.e_sqlite3 2.1.10 | High | EF SQLite native runtime, used on every database operation | 2.1.13; no reported advisory |
| Microsoft.OpenApi 2.3.0 | High | Swashbuckle; Development document generation, no supplied OpenAPI import endpoint | 2.7.5; no reported advisory |
| Microsoft.Build.Tasks.Core 17.7.2 | High | Design/scaffolding tool graph; no API-driven project build | Absent |
| NuGet.Packaging 6.12.1 | Low | Design/scaffolding dependency resolution; no API package-upload/install feature | Absent |
| NuGet.Protocol 6.12.1 | Low | Design/scaffolding package acquisition; not an application API path | Absent |

The old SQLite advisory requires crafted SQL/aggregate expressions; this application uses EF queries
and does not accept arbitrary SQL. The native component was still patched because it is runtime
reachable. The loaded native library was measured with `SELECT sqlite_version()` as **3.53.3** on
Windows x64, above the 3.50.2 fix baseline for CVE-2025-6965. The managed provider is
Microsoft.Data.Sqlite.Core 10.0.14; bundle/core/provider/native SQLitePCLRaw packages resolve to 2.1.13.
See [SQLite release history](https://www.sqlite.org/changes.html) and the
[package advisory](https://github.com/advisories/GHSA-2m69-gcr7-jv3q).

Microsoft.OpenApi's circular-reference parsing advisory is fixed in 2.7.5. No attacker-supplied OpenAPI
reader route exists here, and Swagger remains Development-only. The upgraded generation path is
tested directly. See the [Microsoft advisory](https://github.com/microsoft/OpenAPI.NET/security/advisories/GHSA-v5pm-xwqc-g5wc).

Final `dotnet list package --vulnerable --include-transitive --format json` scans of both app and
test projects report **no vulnerable packages**. No suppressions, advisory exclusions or forced
dependency overrides were introduced.

## Frontend direct updates

These are resolved versions, rather than just manifest minimum ranges.

| Package | Before | After |
|---|---|---|
| axios | 1.13.3 | 1.21.0 |
| react / react-dom | 19.2.3 | 19.3.1 |
| react-router-dom | 7.18.4 | 7.18.5 |
| date-fns | 4.1.0 | 4.4.0 |
| react-big-calendar | 1.19.4 | 1.20.0 |
| react-to-print | 3.2.0 | 3.3.0 |
| vite | 7.3.1 | 7.3.7 |
| @vitejs/plugin-react | 5.1.2 | 5.2.0 |
| @types/node | 25.0.9 | 24.19.2, aligned with Node 24 |
| @types/react | 19.2.8 | 19.3.0 |
| @types/react-dom | 19.2.3 | 19.3.0 |
| eslint / @eslint/js | 9.39.2 | 9.39.5 |
| eslint-plugin-react-hooks | 7.0.1 | 7.1.1 |

Playwright 1.64.1 was already current and remains unchanged. TypeScript 5.9.3, Lucide 0.563.0,
React Big Calendar types 1.16.3, globals 16.5.0 and React Refresh lint plugin 0.4.26 remain unchanged.
The update stays within existing compatible major ranges; no Vite 8, TypeScript 7, Lucide 1 or
ESLint 10 migration was introduced merely to update version numbers.

Unused frontend bcryptjs and @types/bcryptjs were removed after import/code searches. Password
hashing remains exclusively backend BCrypt.Net-Next; no password behavior was moved to the browser.

## Frontend advisories: classification and resolution

Initial npm audit: **21 affected package entries: 15 high, 5 moderate, 1 low; 0 critical**.
Counts describe affected package entries, not distinct CVEs or demonstrated application exploits.
Final npm audit, after npm ci: **0 reported advisories**.

| Package | Severity | Direct/transitive; manifest class | Before -> after | Reachability in this application |
|---|---|---|---|---|
| axios | High | Direct; production | 1.13.3 -> 1.21.0 | Browser API client is used; many advisories concern Node proxy/HTTP adapters absent from static production; prototype/config gadgets need an additional pollution/input path not demonstrated here |
| follow-redirects | Moderate | Transitive; production | 1.15.11 -> 1.16.2 | Axios Node adapter; no production Node API server |
| form-data | High | Transitive; production | 4.0.5 -> 4.0.6 | Axios Node multipart implementation; browser uses native FormData |
| lodash | High | Transitive; production | 4.17.21 -> 4.18.1 | Calendar internals; no application-supplied template source or arbitrary mutation paths found |
| lodash-es | High | Transitive; production | 4.17.22 -> 4.18.1 | Calendar internals; same qualification as lodash |
| moment | Moderate | Transitive; production | 2.30.1 -> 2.31.0 | Alternative calendar localizer; app uses dateFnsLocalizer and supplies no locale filename to Moment |
| vite | High | Direct; development | 7.3.1 -> 7.3.7 | Developer server exposure/file/editor paths; absent from static production runtime |
| @babel/core | Low | Transitive; development | 7.28.6 -> 7.29.7 | Build/source-map processing; no API accepts build source |
| @humanfs/node | Moderate | Transitive; development | 0.16.7 -> 0.16.8 | Lint/tooling filesystem operations |
| ajv | Moderate | Transitive; development | 6.12.6 -> 6.15.0 | Tool configuration/schema validation; no server-side API validator using this package |
| baseline-browser-mapping | Moderate | Transitive; development | 2.9.14 -> 2.11.34 | Build compatibility metadata processing |
| brace-expansion | High | Transitive; development | 1.1.12 -> 1.1.21 | Tooling glob patterns; no public glob-input endpoint |
| browserslist | High | Transitive; development | 4.28.1 -> 4.29.5 | Build target/config/statistics processing |
| flatted | High | Transitive; development | 3.3.3 -> 3.4.4 | Lint cache/tooling serialization |
| js-yaml | High | Transitive; development | 4.1.1 -> 4.3.2 | Tool configuration parsing; app has no YAML upload/parser feature |
| minimatch | High | Transitive; development | 3.1.2 -> 3.1.5 | Tooling glob matching |
| nanoid | High | Transitive; development | 3.3.11 -> 3.3.20 | Build dependency generator; no API-controlled generator sizes |
| postcss | High | Transitive; development | 8.5.6 -> 8.5.32 | Build CSS/source-map processing; app does not compile uploaded CSS |
| rollup | High | Transitive; development | 4.55.1 -> 4.66.0 | Bundler filesystem output; no remote build endpoint |
| source-map-js | High | Transitive; development | 1.2.1 -> 1.2.2 | Tooling source-map parser |
| zod | High | Transitive; development | 4.3.5 -> 4.6.7 | React lint tooling; no API validation uses this Node graph |

Production/development labels above come from the lockfile, not assumptions that every installed
production dependency is bundled/reachable. Node-only Axios subdependencies are specifically
distinguished. Tooling vulnerabilities can still affect a developer handling malicious source or
configuration; lack of a production API path does not make those packages universally safe.

The Axios client constructs a fixed application API base URL and passes application requests; no
server-side user-selected outbound URL/proxy feature exists. Calendar uses date-fns with fixed
Hungarian locale configuration. These facts limit the demonstrated exploit paths, but are not a
substitute for applying the available patches.

## Root npm graph and cleanup

Initial root npm audit: **3 affected entries (2 high, 1 moderate)**: direct Axios 1.13.2 plus its
transitive form-data 4.0.5 and follow-redirects 1.15.11. This duplicate graph had no root scripts,
source directory/application entry point or required consumer. The real application, Vite config,
tests and TypeScript project reside in Frontend and resolve their own dependencies.

Removed root dependencies: axios, bcryptjs, lucide-react, @types/bcryptjs, @types/date-fns,
@types/node, @types/react, @types/react-big-calendar, @types/react-dom and typescript. The root
manifest remains private with the Node engine declaration; its npm-generated lockfile is retained.
No unrelated root configuration file was deleted. Root npm ci and npm audit pass with zero findings.

All npm lockfile changes were generated through npm uninstall/install/update; none were hand-edited.
No npm audit fix --force or cross-major override was used. Compatible transitive refreshes followed
the deliberately selected direct updates. Frontend and root npm ci verify the final lockfiles.

## Container images

Both backend build paths use the same pinned SDK/runtime tags. Both frontend build paths use the
same pinned Node 24 patch and `npm ci` in place of nondeterministic `npm install`. The production
frontend remains static Nginx; no Node server was introduced.

All four selected official image manifests (SDK, ASP.NET, Node, Nginx) were queried successfully
(HTTP 200). Nginx 1.30.6 is the patched stable family described in the
[upstream release/security news](https://nginx.org/). Existing security-header includes, proxy
settings, environment restrictions, volumes, ports and networks are unchanged.

Docker/Nginx/image-scanning tools are unavailable on this machine. Images were not built, run or
scanned. Tag existence and manifest review do not demonstrate vulnerability-free images or verify
Linux native execution. No such claim is made. Container hygiene and deployment remain separate work.

## Breaking-change and compatibility review

The [ASP.NET migration guide](https://learn.microsoft.com/en-us/aspnet/core/migration/90-to-100?view=aspnetcore-10.0)
and [EF Core 10 breaking changes](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/breaking-changes)
were reviewed against the repository. The resulting checks are:

- Authentication/JWT: explicit bearer policy, HS256, issuer/audience, zero skew, account/role/session
  validation remain unchanged. Existing expired/forged/retired/stale token and revocation tests pass.
- Forwarded headers: existing bounded trusted-proxy configuration remains; no arbitrary proxy trust
  was added. Rate limiter configuration and password/login-abuse behavior remain unchanged and tested.
- System.Text.Json/API behavior: existing DTO, validation, enum/number/date and status-code tests pass;
  no permissive serializer switches or new model binding behavior were introduced.
- Exception handling: existing sanitized response/logging checks pass on .NET 10; no diagnostics
  relaxation or exception-detail exposure was needed.
- EF/SQLite: existing migration chain runs, data-preservation/duplicate-rejection test passes, model
  consistency reports no pending change, and concurrency/trigger/relationship tests pass. EF 10's
  timestamp reader changes were reviewed; the application uses EF DateTime fields, not custom
  GetDateTimeOffset readers or REAL DateTimeOffset columns. Calendar timestamp regressions are covered
  by browser tests; no legacy compatibility switch was enabled.
- Vite/Node: compatible Vite 7 patch, same environment/API handling and CSP configuration. Node is a
  build/test runtime only. The strict TypeScript and built SPA checks pass.
- React/Router/calendar/print: compatible-major releases; existing page code, route guards, calendar
  model, forms, history and printing code were not redesigned. Complete Chromium verification includes
  the Production CSP print-iframe and image workflow.
- Playwright: already-current pinned 1.64.1 and its browser remain in use.

Only the disposable test backend launcher's target-output path required compatibility adjustment:
net9.0 -> net10.0. The existing DLL variable is reused for launching. No application/controller/page
logic was changed to accommodate an upgrade.

## Tests and verification

Two focused tests were added in Stage3BCompatibilityTests.cs:

1. Query the loaded native SQLite version and enforce the known patched baseline.
2. Generate Swagger using the upgraded library in Development and verify Production does not serve
   its OpenAPI document.

No existing test assertion, fixture role policy or workflow expectation was weakened. No existing test
source was edited. Existing app/test project targets and the browser server's DLL path were updated.

| Required check | Result |
|---|---|
| dotnet restore app/test project graph, including forced restore | Passed |
| Local EF tool restore/version | Passed, 10.0.14 |
| Backend build | Passed |
| Complete backend suite | 122 passed, 0 failed, 0 skipped (120 existing + 2 new) |
| Migration/model consistency | Passed in existing upgrade/data-preservation/HasPendingModelChanges coverage |
| Frontend npm ci | Passed |
| Root npm ci | Passed |
| Strict TypeScript | Passed |
| Frontend production build | Passed |
| Complete Chromium suite | 78 passed, 0 failed (3.2 minutes) |
| npm audit frontend/root | 0 / 0 findings |
| .NET advisory scan app/test graph | No vulnerable packages reported |
| git diff --check | Passed |

Tests use fresh disposable SQLite databases and synthetic accounts/uploads. Application startup,
migrations, native queries, JWT/auth/security controls and UI behavior are exercised without opening
or modifying the workshop's real database. No migrations were created, rewritten or reset.

Before/after raw scan evidence is retained outside the repository under
`C:\CarServiceApp\.stage3b-tools` (frontend/root-before.json, frontend/root-after.json,
dotnet-before.json, dotnet-app-after.json, dotnet-tests-after.json). The tables above record the
portable project findings without requiring those local evidence files.

## Changed/new/removed files

Modified:

- Backend/CarServiceShop/CarServiceShop/CarServiceShop.csproj
- Backend/CarServiceShop/CarServiceShop.Tests/CarServiceShop.Tests.csproj
- Backend/CarServiceShop/Dockerfile
- Dockerfile
- Frontend/Dockerfile
- Frontend/package.json
- Frontend/package-lock.json
- Frontend/scripts/start-test-backend.mjs
- package.json
- package-lock.json

New:

- global.json
- .node-version
- dotnet-tools.json
- Backend/CarServiceShop/CarServiceShop.Tests/Stage3BCompatibilityTests.cs
- SECURITY_STAGE_3B_REPORT.md

Removed files: none. Removed dependency entries are listed above. Existing migrations, Program.cs,
recovery files, security policy files, settings and frontend page components are unchanged.

## Remaining warnings and limitations

- No advisory findings are intentionally left unresolved. Zero scanner findings do not establish
  zero risk: advisories lag, reachability is contextual and container/OS components were not scanned.
- ESLint 9.39.5 is end-of-life and npm emits a deprecation warning. Its lint-only graph is patched
  and has no reported advisory, but future maintenance is limited. It is not shipped as the static
  production runtime and is not required by the build command. A separate ESLint 10 configuration
  migration was deliberately avoided under the instruction to avoid unrelated major upgrades.
  See [ESLint support policy](https://eslint.org/version-support/).
- The existing CS8618 User.Role warning remains on a fresh backend compile; no unrelated model change
  was made to suppress it. Incremental final builds can report zero warnings because compilation is cached.
- npm reports esbuild's known postinstall script as not covered by allowScripts; clean installation
  and the actual Vite build succeed. No blanket script approval or security-warning suppression was added.
- Browser tooling emits a cosmetic NO_COLOR/FORCE_COLOR warning. It does not affect test results.
- Linux/container native library execution and image vulnerabilities remain unverified locally.
- Developers need the .NET 10 SDK and selected Node 24 patch on PATH for ordinary commands. Validation
  used the portable copies described above; the old machine-wide defaults remain installed.

SEC-009 pagination/general resource quotas, SEC-017 repository/container hygiene and SEC-018 audit
trail are explicitly deferred. No Stage 3C, deployment, monitoring platform, public HTTPS/domain work
or unrelated application feature was started.

## Scoped gate

**Security Stage 3B scoped gate: PASS**, with the ESLint maintenance warning and container/image
verification limitations documented above. All required executable checks pass, and no known
package advisories remain in the final scans. This is a Stage 3B dependency/runtime gate only;
it is not an overall public-deployment approval. All changes remain uncommitted for review.
