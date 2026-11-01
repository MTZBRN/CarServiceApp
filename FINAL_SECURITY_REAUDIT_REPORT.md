# Final security re-audit — post-remediation gate

Date: **2026-11-01**. Repository: `C:\CarServiceApp\CarServiceApp`.

## 1. Baseline, scope and result

Baseline HEAD: **`c610e35117aeb83f54e5c7bfd09208f633420177`** (`Add security and business audit trail`). The working tree was clean and the recorded upstream ref resolved to the same commit. This confirms agreement with the locally recorded upstream; no fresh remote fetch/push was performed. No unrelated local recovery edits were present.

The re-audit reviewed the Security Stage 1, 2A, 2B, 3A–3E reports, their scope/gate/limitation claims, current controllers, request contracts, authentication, migrations, security helpers, frontend data/auth/rendering paths, tests and container/proxy configuration. Closure below is based on **current code and executable checks**, not report assertions alone.

One uncovered direct-JobParts aggregate-validation bypass was confirmed with a failing disposable integration test, then corrected under the task's allowance for small, low-risk fixes. The final assessment applies to **baseline plus that uncommitted correction**, not an unchanged checkout of `c610e35`. No migration, package upgrade, secret rotation, real database mutation, deployment, domain/certificate setup, Git-history rewrite or commit was performed.

| Gate | Conclusion |
| --- | --- |
| A. Code/application security | **PASS WITH NON-BLOCKING WARNINGS** |
| B. Ready for real business data | **YES WITH OPERATIONAL PREREQUISITES** |
| C. Ready for public internet exposure | **YES AFTER OPERATIONAL DEPLOYMENT CONTROLS** |

These conclusions do **not** authorize exposing the current HTTP/loopback setup publicly. Actual TLS ingress, container execution, permissions, production secrets, backups/restoration and operational controls remain unverified. Required regressions passed: **171 backend tests, 85 Chromium tests**, restore/build, model/upgrade checks, clean frontend install, strict TypeScript, production build and whitespace checks.

## 2. Final architecture and trust boundaries

```text
Browser: memory/UI state + localStorage bearer JWT
  -> React production SPA (same-origin /api, text rendering, route guards for UX)
  -> intended TLS ingress [not configured/verified here]
  -> Nginx frontend container (:8080; host binding 127.0.0.1:5173)
  -> ASP.NET API on private container network (:8080; no published backend port)
  -> signature/issuer/audience/HS256/lifetime validation
  -> database user + role + SessionVersion validation on authenticated requests
  -> authoritative backend authentication/role/history checks
  -> parameterized EF Core / SQLite in /app/data
       -> transactional business mutation + bounded audit event
  -> separate /app/uploads volume: generated normalized raster images
       -> public basename-restricted static serving + sandbox/nosniff
```

The workshop is shared, with no per-customer tenant/assigned-mechanic isolation model. Mechanics intentionally read shared customer/vehicle/service information and perform active operational work. Frontend hidden controls and `RequireAdmin` are UX only; fallback authentication, controller role attributes and completed-history checks enforce access at the API.

SQLite and audit history share one persistence/backup boundary. Profile files are a separate filesystem boundary, not part of the database transaction. Both containers use non-root identities, read-only root filesystems, explicit writable storage/tmpfs, dropped capabilities and no-new-privileges in the supplied Compose configuration. Privileged filesystem/database access can bypass application policy; this audit does not claim otherwise.

## 3. SEC-001–SEC-019 closure matrix

`CLOSED` means the original application weakness is addressed within its documented scope; it does not mean there is no residual risk or no operational prerequisite. Tests named below are in the current backend test project and passed in this run.

| Finding | Classification at final tree | Current evidence and limits |
| --- | --- | --- |
| SEC-001 signing keys | **CLOSED** | [SecurityRules.cs:8](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Security/SecurityRules.cs:8) requires external base64 material ≥32 bytes with weak/example checks; [Program.cs:132](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Program.cs:132) fails startup on invalid key. No current tracked signing value. `InvalidSigningKeyFails`, `MissingKeyFailsActualStartup`, wrong/retired-key token tests pass. Actual production generation/injection/rotation remains operational. |
| SEC-002 predictable admin | **CLOSED** | [InitialAdmin.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Data/InitialAdmin.cs) provisions only through explicit CLI/configuration, never ordinary startup, never overwrites accounts, validates password and audits. `FreshProductionHasNoDefaultAccount_ProvisionIsExplicitAndNeverOverwrites` passes. Browser fixture credentials belong to disposable test hosts, not runtime defaults. |
| SEC-003 active upload | **CLOSED** | [ProfileImages.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Security/ProfileImages.cs), [AuthController.cs:147](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/AuthController.cs:147), [Program.cs upload middleware](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Program.cs:178): actual raster decode/re-encode, limits, generated names, allowlisted serving, sandbox/nosniff. Existing upload/security/browser tests pass. Filesystem ownership and Linux native decoder execution still need runtime validation. |
| SEC-004 transport/TLS | **OPERATIONAL VERIFICATION STILL REQUIRED** | Same-origin production client, private backend, loopback-only frontend binding and trusted-forwarder configuration exist. [Nginx config](C:/CarServiceApp/CarServiceApp/Frontend/nginx.conf) remains HTTP and uses its own `$scheme`/`$remote_addr`; outer TLS/client-IP propagation must be designed and verified. No actual public TLS/redirect/HSTS result is claimed. |
| SEC-005 login/password abuse | **CLOSED** | [SecurityRules.cs:20](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Security/SecurityRules.cs:20), [LoginThrottle.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Security/LoginThrottle.cs), source limiter in [Program.cs:125](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Program.cs:125). Unicode scalar/UTF-8 limits, bounded counters, four active BCrypt verifications, uniform failure and source limits. Current abuse/password tests pass; no permanent lockout or MFA was added. |
| SEC-006 revocation | **CLOSED** | [AuthController.cs:74](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/AuthController.cs:74), [Program.cs:51](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Program.cs:51): password/logout version changes and database checks. Password, replacement login, logout-only-own-user, deleted-user and role-mismatch tests pass. Offline/failed logout cannot guarantee server revocation. |
| SEC-007 entity graphs | **CLOSED** | [WriteRequests.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Requests/WriteRequests.cs), explicit controller construction, new child IDs. `NestedGraphsAndChildIdsCannotCreateOrOverwriteUnintendedRecords` passes. Unknown JSON properties are safely ignored, not persisted as EF graphs. |
| SEC-008 validation | **CLOSED after correction** | DTO annotations/custom checks and FK/relationship validation remain. This re-audit found FINAL-001 in direct appends; [JobPartsController.cs:30](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/JobPartsController.cs:30) now applies the shared aggregate ceiling. New failing-before/passing-after regression plus all Stage 2A invalid-input cases pass. |
| SEC-009 exhaustion/bounds | **CLOSED within bounded scope** | [CollectionQuery.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Requests/CollectionQuery.cs), [RequestBounds.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Security/RequestBounds.cs), dashboard/rate/quota/cache controls. Current Stage 3D tests pass, including unknown-length bodies and alternate append cap. No total business/audit database quota or universal per-route limiter is claimed. |
| SEC-010 uniqueness/concurrency | **CLOSED** | [Integrity.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Data/Integrity.cs), [ApplicationDbContext.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Data/ApplicationDbContext.cs), [IntegrityGuards migration](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Migrations/20261029000200_IntegrityGuards.cs). Matching ASCII normalization, unique index, last-admin trigger and explicit version CAS. Concurrent creation/deletion/update and atomic child tests pass. |
| SEC-011 destructive/history access | **CLOSED** | Admin DELETE attributes; completed worksheet checks in [ServiceJobsController.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/ServiceJobsController.cs) and [JobPartsController.cs:27](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/JobPartsController.cs:27). Mechanic/admin matrix, database relationship guards and appointment-history tests pass. |
| SEC-012 Production Seed | **CLOSED** | Non-Development controller removal and explicit Production/non-Development path denial in [Program.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Program.cs); fixed host environment, not request input. Production 404/no mutation and intentional Development admin tests pass. |
| SEC-013 CORS | **CLOSED** | [Program.cs:90](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Program.cs:90): no Production cross-origin grants, two explicit Development origins, no credentials wildcard. Environment/origin matrix passes. CORS does not replace authentication. |
| SEC-014 browser headers | **CLOSED at application/static-config level** | [ProductionHardening.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Security/ProductionHardening.cs), [security-headers.conf](C:/CarServiceApp/CarServiceApp/Frontend/security-headers.conf). CSP/header parity tests and actual built-SPA production print/image browser case pass. Deployed Nginx/HSTS still operationally unverified. |
| SEC-015 dependency/runtime risk | **PARTIALLY CLOSED** | Production npm and application/test NuGet graphs have zero reported advisories; supported .NET 10/Node 24 and native SQLite baseline verified. Six current moderate npm entries concern the dev ESLint/minimatch chain (FINAL-002). OS/container image scans remain outstanding. |
| SEC-016 startup/errors | **CLOSED** | Required migration/security configuration failures propagate before serving; sanitized exception handler, no sensitive request logging added. Invalid-scope/key/migration failure, sanitized unexpected DB/exception and expected 400/404/409/401/403 tests pass. |
| SEC-017 repo/container hygiene | **OPERATIONAL VERIFICATION STILL REQUIRED** | Current tracked secret/runtime-artifact scan and Dockerignore/static controls pass review; [Compose](C:/CarServiceApp/CarServiceApp/docker-compose.yml), [backend Dockerfile](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/Dockerfile), [frontend Dockerfile](C:/CarServiceApp/CarServiceApp/Frontend/Dockerfile). Actual images, UID/GID bind permissions, effective hardening and Nginx execution are unverified without Docker. |
| SEC-018 audit | **CLOSED within stated scope** | [AuditWriter.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Security/AuditWriter.cs), all current mutation call sites, [AuditController.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/AuditController.cs), admin page. Transaction-failure, privacy, role, paging and XSS-rendering tests pass. Sampling/manual retention/application-level immutability limits remain explicit. |
| SEC-019 JWT scope | **CLOSED** | [Program.cs:58](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Program.cs:58), issuance in [AuthController.cs:116](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/AuthController.cs:116). Issuer/audience, signed HS256 only, expiration/lifetime and zero skew. All nine scope/algorithm variants pass. |

No unresolved regression was found that restored anonymous business-data access, mechanic administration, completed-history mutation or active-file execution. FINAL-001 was an uncovered validation gap, corrected here; the earlier stage gate assertions alone did not detect it.

## 4. Complete backend API authorization inventory

**39 explicitly declared controller endpoints**, including one Development-only Seed endpoint (38 routed in Production). `Auth` below means the backend fallback/default authenticated-user policy, with database-backed JWT validation. All writes use explicit DTOs or the single authenticated image input. GET collection rows are bounded; singleton/detail routes are identified separately. Ordinary staff ID access is intentional shared-workshop access, not tenant/ownership isolation.

| Method | Route | Effective access | Data / additional guard |
| --- | --- | --- | --- |
| POST | `/api/Auth/login` | Anonymous | Credential verification, throttling, sampled failure/success audit, token issuance |
| GET | `/api/Auth/me` | Auth | Own safe session identity; no user entity/hash response |
| POST | `/api/Auth/change-password` | Auth | Own password verified; replaces own hash/version and audits |
| POST | `/api/Auth/logout` | Auth | Revokes current identity's sessions only; SQL + audit transaction |
| POST | `/api/Auth/upload-profile-picture` | Auth | Own account image; normalized, quota/rate/size guarded |
| GET | `/api/Customers` | Auth | Paged customer PII/vehicle counts |
| GET | `/api/Customers/{id}` | Auth | One shared-workshop customer |
| POST | `/api/Customers` | Auth | Explicit customer create + audit |
| PUT | `/api/Customers/{id}` | Auth | Customer update; optional body ID must match; audit |
| DELETE | `/api/Customers/{id}` | Admin | Rejects dependent vehicles; database guard; audit |
| GET | `/api/Vehicle` | Auth | Paged/filterable vehicles + customer context |
| GET | `/api/Vehicle/{id}` | Auth | One vehicle/owner; unused history include removed |
| POST | `/api/Vehicle` | Auth | Valid existing customer; explicit fields + audit |
| DELETE | `/api/Vehicle/{id}` | Admin | Rejects appointment/service history; database guard; audit |
| GET | `/api/Appointments` | Auth | Bounded date overlap + paging; minimal worksheet link |
| GET | `/api/Appointments/{id}` | Auth | One appointment/vehicle |
| POST | `/api/Appointments` | Auth | Existing vehicle, dates/notes validated; audit |
| PUT | `/api/Appointments/{id}` | Auth | Version and ID checks; linked worksheet locks vehicle; audit |
| DELETE | `/api/Appointments/{id}` | Admin | Detaches worksheet link, preserves history; audited transaction |
| GET | `/api/ServiceJobs` | Auth | Paged worksheet rows, complete cost aggregate, ≤20 child previews |
| GET | `/api/ServiceJobs/{id}` | Auth | One full saved worksheet, including printable line snapshots |
| GET | `/api/ServiceJobs/ByAppointment/{appointmentId}` | Auth | At most one linked full worksheet |
| GET | `/api/ServiceJobs/ByVehicle/{vehicleId}` | Auth | Paged service history, not a full-table escape |
| POST | `/api/ServiceJobs` | Auth | Existing/matching vehicle/appointment; bounded lines/total; create audit |
| PUT | `/api/ServiceJobs/{id}` | Auth; completed target requires Admin | Version/relationship/total checks; atomic child replacement and audit; mechanic may complete active work |
| DELETE | `/api/ServiceJobs/{id}` | Admin | Worksheet/history deletion explicitly privileged and audited |
| POST | `/api/JobParts` | Auth; completed target requires Admin | Parent version, ≤500 lines, per-line and now aggregate total checks; parent audit |
| GET | `/api/parts` | Auth | Paged/filterable inventory |
| POST | `/api/parts` | Auth | Validated inventory create; no automatic stock consumption; audit |
| PUT | `/api/parts/{id}` | Auth | Version/ID/value checks; audit |
| DELETE | `/api/parts/{id}` | Admin | Destructive inventory action + audit; saved worksheet snapshots remain |
| GET | `/api/Users` | Admin | Paged safe projection: ID/name/login/role, total admin count |
| POST | `/api/Users` | Admin | Password/role/field validation, unique normalized login, create audit |
| DELETE | `/api/Users/{id}` | Admin | Final-admin database trigger; audit; known owned-image cleanup |
| GET | `/api/Settings` | Auth | Singleton company/print/pricing data, intentionally shared for workshop work |
| POST | `/api/Settings` | Admin | Version/value checks; zero prices/VAT accepted; atomic audit |
| POST | `/api/Seed` | Development Admin only; Production unavailable | Sample data mutation, aggregate audit/transaction; no request can select environment |
| GET | `/api/Dashboard` | Auth | SQL aggregate counts, ≤6 rows per panel |
| GET | `/api/Audit` | Admin | Paged/filterable safe audit events; no event mutation API |

Authoritative sources are the current controller directory, [fallback policy](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Program.cs:85) and JWT validation, not React routes. No user/vehicle role-edit or alternate mutable entity endpoint was found.

Non-business surfaces: `/healthz` is intentionally anonymous and returns a fixed no-store liveness result; static SPA/fallback HTML is anonymous and does not expose protected JSON; canonical profile images are intentionally public. Swagger/OpenAPI is anonymous **only in Development** and removed from Production behavior. Development CORS preflight can be anonymous without returning business data. Unknown GET paths may resolve to SPA HTML; this is not an API authentication bypass.

## 5. Authentication and authorization recheck

JWT issuance uses an externally supplied validated symmetric key, explicit issuer/audience and HS256, seven-day expiry, user ID/name/role and SessionVersion claims. Validation requires signed tokens, the exact issuer/audience, HS256, expiration/lifetime and zero clock skew. Every authenticated request checks user existence, exact current database role and matching SessionVersion. Changing browser role storage or unsigned payload claims cannot grant admin access.

Password change verifies the old password and atomically stores a new BCrypt hash, new SessionVersion and audit event, returning a replacement token. Logout's current-user SQL version assignment and event share a transaction. Deleted users and changed roles fail subsequent requests. Already admitted/in-flight requests are not retroactively cancelled by revocation. Tokens signed under a retired key or older incompatible scope/session configuration are rejected; coordinated release/re-login is expected.

BCrypt.Net-Next 4.0.3 is used with its **default work factor 11**, confirmed in the installed package documentation; the application does not specify a custom factor. Passwords require ≥12 Unicode scalars and ≤72 UTF-8 bytes. Creation/change/provisioning/recovery enforce that rule; login rejects overlong values. Unknown accounts use a process-local random dummy hash; known/unknown wrong-credential status/body are uniform.

Login limits: default 30 attempts/source/minute, clamped configuration; ten attempts/minute per fixed-size hashed account stripe and four active BCrypt checks. There is no persistent account lockout. Temporary throttling can deny login for a minute, and stripe collisions are deliberate bounded-memory tradeoffs. Correct source forwarding and operational abuse detection still matter; no claim is made that public rate limits prevent distributed attacks.

Username normalization was checked for a possible Unicode mismatch and found **consistent**: both C# and SQLite trim U+0020 and fold ASCII a–z only. Non-ASCII case distinctions remain intentional/documented. The virtual normalized column has a database unique index; parallel inserts have one winner. Duplicate historical normalized groups abort the migration without choosing/deleting accounts. Existing unsupported legacy roles should be reviewed operationally before real use; new account DTOs allow only admin/mechanic.

The last-admin DELETE trigger is atomic under SQLite's serialized writers, beyond the friendly controller count. There is no role-demotion HTTP endpoint bypassing that invariant. The local recovery command is Development-only, requires explicit process arguments, an existing database/account and interactive hidden password input, never starts an HTTP listener, and audits its system action. It is not remotely enabled through a request/header; it still requires privileged local access and should not be used as Production provisioning.

## 6. Write contracts, injection and data integrity

All API writes were rechecked for entity/navigation binding. DTOs expose intended scalars and line snapshots; entities are constructed/updated explicitly. Nested Customer/Vehicle/ServiceJob objects, arbitrary child IDs and protected user fields cannot create/update related records. Optional body IDs on updates must match routes; create IDs are not trusted. FK existence, appointment/vehicle consistency and linked-appointment vehicle immutability remain server-side.

Limits include customer name 200/phone 50/email 254/address 500; vehicle plate 64/make-model 100/VIN 50 and sane years/dates; appointment note 5000 and increasing dates; worksheet description 10000, ≤500 lines, positive quantity ≤10000, unit/labor values ≤100000000 and aggregate ≤1000000000000; inventory stock 0–1000000 and bounded prices; company rate 0–1000000 and VAT 0–100 with zero valid. Supplied email format is checked where used. JSON type/overflow/model failures return controlled 400; recognized missing/conflict/auth cases retain 404/409/401/403.

FINAL-001 corrected the direct-append aggregate escape. SQL `SUM` uses 64-bit multiplication over at most 500 bounded lines, adds persisted labor and the proposed line, then rejects over-limit totals before changing the parent or appending an event. Existing parent-version CAS prevents two competing appends/worksheet updates from both committing against the same state.

No request-controlled raw SQL, command execution, dynamic SQL expression, unsafe HTML parsing or mutable navigation graph was found. Query/search filters use typed parameterized EF LINQ. Migration SQL is fixed schema/integrity logic, not user-supplied SQL; raw SQL in tests targets disposable fixtures. SQLite foreign keys/triggers and transaction constraints remain authoritative. Business information is shared with all authorized mechanics by design; guessing IDs does not cross a tenant/owner boundary that this app claims to provide.

## 7. Upload, filesystem and privacy recheck

Upload accepts declared PNG/JPEG MIME and **successfully decoded** single-frame PNG/JPEG content only. MIME/extension mismatch cannot force active output: the accepted pixels are re-encoded to a generated GUID PNG. The original name is not used for a path. Input ≤2 MiB, multipart ≤2162688 bytes, dimensions ≤2048×2048, normalized output ≤16 MiB. SVG/script/polyglot content that cannot decode as allowed raster is rejected; raster ancillary metadata is not blindly preserved.

Storage is limited to 256 MiB of managed generated names, with bounded top-level accounting (1024 `profile_*` entries), one in-flight upload and no waiting queue. Replacement excludes only the current owner's known previous basename from the quota; temporary overhead can be one 16 MiB output. Successful replacement/account deletion attempts narrow owned-basename cleanup; failed cleanup leaves counted orphans, without deleting arbitrary files. Historical cleanup remains manual ownership/reference review, as documented in [UPLOAD_STORAGE_MAINTENANCE.md](C:/CarServiceApp/CarServiceApp/UPLOAD_STORAGE_MAINTENANCE.md).

Public serving accepts only canonical/legacy generated raster basenames, with sandbox CSP and nosniff. Paths/traversal strings do not satisfy that allowlist. Quota accounting explicitly rejects generated-name reparse points. **Serving is not a general symlink/hardlink sandbox**: the static provider does not add an independent link-target ownership check. There is no HTTP mechanism to create such a link; protection depends on trusted upload-root ownership and no untrusted filesystem writers. A misconfigured/shared writable volume could bypass this assumption. Linux bind ownership, effective links/permissions and native decoder behavior were not runtime-tested here and belong in the operational validation list, not a claimed unauthenticated exploit.

Customer names/contact details/addresses, registrations/VIN, service notes/history and charges are intentional protected business data. Mechanics receive that shared context; staff login lists and audit records require admin. Current user/auth response projections omit password hashes, normalized login and SessionVersion; the latter is a signed token claim used for validation, not a signing secret. `User.PasswordHash` is still a public entity property without a JsonIgnore attribute, but no current controller returns a User entity; future endpoints must preserve the safe projection rather than serialize it.

Profile images are publicly retrievable by their generated URL; they should contain no sensitive workshop documents. Audit actor snapshots and linked IDs remain personal/operational information after source deletion. Database/filesystem/backups are not encrypted by this application. Access control, protected backups and appropriate host/storage controls remain operational responsibilities. No legal conclusion is made.

## 8. Browser, CORS, CSP and errors

Production uses same-origin `/api` and grants no cross-origin CORS access. Development origins are exactly `http://localhost:5173` and `http://127.0.0.1:5173`, with explicit methods/headers and metadata-header exposure. No AllowAnyOrigin/AllowCredentials combination exists. Bearer tokens are attached from localStorage, not ambient cookies; conventional cookie-CSRF does not authenticate a forged cross-site request. CORS is a browser read policy, not protection against a caller already holding a bearer token.

Exact Production CSP, shared by backend and static Nginx policy:

```text
default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'
```

Inline styles remain the documented compatibility allowance for calendar/layout/printing; Production does not allow unsafe-eval or arbitrary external scripts. Self frames support printing while frame-ancestors none/X-Frame-Options DENY prevent framing the application. Nosniff, no-referrer, restrictive Permissions-Policy and no-store API caching remain. HSTS is conditional on HTTPS semantics and needs verification at the actual TLS edge. Upload responses retain their stricter `default-src 'none'; sandbox` policy.

The source re-scan found **zero** app-source matches for dangerouslySetInnerHTML, eval, new Function or document.write. React renders customer/worksheet/company/audit text as text. App links use fixed internal paths/IDs, profile sources encode the basename under `/uploads/`, and customer dial links use a fixed `tel:` scheme. No arbitrary user-provided HTML/javascript URL sink was found. The installed print library's internal mechanics are not misclassified as application-controlled HTML injection; actual saved-data printing under Production CSP passes.

LocalStorage remains script-readable: an independent same-origin XSS, malicious browser extension or compromised device can steal a JWT. This is a residual bearer-token architecture risk, not a newly discovered XSS. Revocation, CSP, safe rendering and session generation guards reduce it. Logout clears local state even when network revocation fails; that failure does not magically invalidate the remote token. Re-login/logout invalidate cached generations so delayed responses cannot cross sessions.

Required migration, initialization and mandatory key/scope failures occur before serving. Unexpected API failures use sanitized ProblemDetails with server trace ID, not stack/SQLite/path/secret detail. Normal client errors remain useful. The fixed server error logger avoids sensitive exception messages/request bodies; no password/JWT/provisioning input logging was added. Swagger and diagnostics behavior remain Development-scoped; accidental Development is still an operational misconfiguration to prevent.

## 9. Fresh dependency/runtime scan

| Check | Current result |
| --- | --- |
| `npm audit --json` | **6 moderate entries**, all dev-tool chain; exit 1 indicates findings, not a scan crash |
| `npm audit --omit=dev --json` | **0 findings**, exit 0 |
| Application `dotnet list ... package --vulnerable --include-transitive --format json` | **No vulnerable packages reported** |
| Test project same transitive scan | **No vulnerable packages reported** |
| NuGet freshness | Restore repeated with `--no-http-cache`, then both graphs rescanned successfully |
| Native SQLite executed by test host | **3.53.3**, detailed native-version test passed |
| .NET | Target net10.0; SDK 10.0.403 / ASP.NET and runtime 10.0.14 used |
| Node/npm | 24.22.2 / 11.19.1 executed; Node 24.22.2 pinned in frontend build image |
| SkiaSharp | Direct managed and Linux native assets 4.153.1; no NuGet advisory reported; Linux binary execution unverified |
| Browser/build tools | Playwright 1.64.1, Vite 7.3.7, TypeScript 5.9.3; tooling graph distinguished from browser runtime |
| Nginx | Dockerfile pins 1.30.6-alpine; no actual image/binary/OS-layer scan possible here |

The six npm entries comprise direct dev dependencies `eslint` and `eslint-plugin-react-refresh`, plus transitive `minimatch`, `@eslint/config-array`, `@eslint/eslintrc`, `@eslint-community/eslint-utils`. They trace to **one** [GHSA-g3hv-75wg-m249 advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249), not six independent remote exploits. Installed minimatch is **3.1.5**; the advisory describes amplified pattern preprocessing in 10.2.6 with optimizationLevel ≥2. Those named preprocessing/optimization symbols were absent in the installed older branch. The scanner's affected range still includes it; exploitability of that specific mechanism on the older branch was not demonstrated. More decisively, workshop/API input does not reach ESLint glob processing, and dev tools are not the served production runtime. See FINAL-002.

The [official .NET download page](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) currently identifies 10.0.14/SDK 10.0.403; the [Node release page](https://nodejs.org/en/blog/release/v24.22.2) identifies 24.22.2 LTS. The [Nginx advisory list](https://nginx.org/en/security_advisories.html) lists 1.30.6 as fixed for its latest listed affected branches. That does not scan Alpine/Ubuntu libraries or prove the resolved Docker image contents. Image pulls, OS/SBOM scanning, provenance and actual Linux native libraries remain operational verification tasks. No npm force fix, dependency update or package-warning suppression was performed.

## 10. Resource and abuse recheck

- Main collection reads: default 50, max 100, stable ordering, count/page headers, page 1–100000, search max 200, typed filters, valid dates. Out-of-range empty pages skip unnecessary deep-offset materialization.
- Appointments: paired ordered start/end, max 93 days, sensible default window, visible calendar range + small buffer, paging for crowded windows. Vehicle history is paged. Dashboard counts are aggregates with at most six rows/panel. Audit shares the collection contract and admin boundary.
- General API bodies: 1 MiB, login 4096 bytes, upload 2162688 bytes. Declared and unknown/chunked lengths are checked; safe tests confirm 413 without persistence. DTO bounds still apply after body limits.
- Worksheet: max 500 lines on both full save and direct append, per-line numeric/text bounds, complete aggregate ceiling including labor now consistent. Collection previews max 20; detail/print retains complete saved snapshots.
- Collection/search/dashboard/audit: default 240/account/minute (clamped 30–600), max eight in-flight per process; uploads ten/account/minute and one in-flight; worksheet create/update/direct append 120/account/minute and four in-flight; all have no waiting queue. No permanent lockout is introduced.
- Shared frontend cache: at most 64 query-specific variants plus fixed resources, canonical pending sharing, debounce/cancellation, session isolation and affected-variant invalidation. Current Stage 2.2/3D tests pass.

Bounded results are not constant-time queries: substring searches/counts may scan rows. Single-record detail/ByAppointment routes do not carry the collection limiter; newly written worksheets are nevertheless capped, while oversized historical legacy records are not truncated or repaired here. Not every authenticated customer/inventory/account/settings mutation has a rate policy, and business/audit database growth is not globally capped. These are explicit scoped residual risks rather than claims of universal DoS prevention. A malicious/stolen authenticated account can still consume resources or corrupt data within its operational permissions. Shared concurrency permits can also temporarily deny other users when saturated; proxy timeouts/client abort behavior and operational abuse controls require validation. No high-load or destructive test was run.

## 11. Concurrency/history and audit consistency

Unique normalized login and last-admin triggers remain database-enforced. Four business record types use explicit SQLite-compatible version tokens, stamped on modifications and checked by writes. User-controlled versions are expected preconditions, not permission to overwrite a newer record; guessed/old versions cannot bypass exact matching plus EF CAS. Concurrent worksheet tests still have one winner and preserve the successful child lines. Direct append participates in the same parent CAS, including after the aggregate correction.

Admin-only destructive routes and completed-history rules remain authoritative. Mechanics can create/edit/complete active worksheets, but cannot reopen/edit/delete completed history or append lines to it. Admins retain explicit correction/reopen/deletion. Customers/vehicles with dependent history are rejected by application and database guards; appointment deletion detaches rather than erases saved service history. Inventory deletion does not erase historical line snapshots.

Audit records are created by internal server operations, not user audit requests. High-value operations save their business change and event in one transaction; generated IDs require two SaveChanges calls within that transaction. Required audit failures roll back worksheet edit/delete, user delete, settings and SQL revocation in integration tests. New FINAL-001 rejection also leaves audit count/version/children unchanged. No later raw-SQL bypass was found: current logout explicitly audits SQL revocation; fixed migrations are maintenance; local provisioning/recovery and multi-save Development Seed explicitly append within their own transactions. Raw external SQL/maintenance is not an automatically audited event source.

Audit metadata is allowlisted and bounded; actor snapshots derive from validated claims/database context, not request actor fields. There are no edit/delete/arbitrary-create API routes. EF tracked audit modification/deletion is rejected. Mechanics receive 403, anonymous callers 401. Failed login evidence is globally sampled (one/minute, twenty/hour/process) without attacker-keyed memory growth; unknown attempted usernames are not stored. Sampling can be consumed or miss events, resets on restart and is not a full intrusion-detection record. Sampled write failure is best effort with a fixed safe warning; required mutation/login-success audit is fail-closed.

Retention remains indefinite in code, with a documented recommended 24-month online policy and separately authorized maintenance review. No automatic audit-history deletion exists. Privileged DB/filesystem access can change records outside application safeguards; no external immutable store or cryptographic chain is claimed. The audit page is safely text-rendered and bounded, and does not recursively log reads. See [AUDIT_TRAIL_OPERATIONS.md](C:/CarServiceApp/CarServiceApp/AUDIT_TRAIL_OPERATIONS.md).

## 12. Repository, secrets and container review

Tracked-file scans covered likely credential assignments, private-key blocks, token-like material, credentialed connection strings, .env files, databases, private certificate extensions and runtime upload paths, without printing values. Current matches were code/configuration variable names or isolated synthetic test credentials; **no current tracked deployable secret, runtime database, uploaded image or private-key/certificate file was found**. No tracked .env configuration exists. Current appsettings contains only logging/hosts/SQLite path; launch settings explicitly describe local Development profiles. There is no ignored Development appsettings file at the inspected path. The ignored frontend `.env.local` contains a non-secret-named `VITE_API_URL` setting; its literal value has zero matches in the generated JS bundle. The inspected audit-shell signing/configuration environment and repository-root env files do not supply production secrets. This does not inspect an absent future production secret store.

Historical signing material remains in an older committed appsettings revision; only its presence/location was checked and compared, without reproducing it. It is not in current tracked configuration and is not the current audit-shell environment value. Historical sample credentials also remain in history/test fixtures. Do not treat old material as secret or derive a new production key from it. Actual production key generation/rotation/use is unverified; use unrelated fresh random material. No history rewrite or secret rotation was attempted.

Dockerignore policies exclude local secrets/env, runtime databases/uploads, builds/tests/tool artifacts and machine files; frontend context is an allowlist and backend context excludes tests/unrelated roots. Runtime images do not intentionally copy browser fixture provisioning scripts. Static controls:

| Component | Reviewed controls / remaining proof |
| --- | --- |
| Backend image | SDK 10.0.403-noble → aspnet 10.0.14-noble; USER 1654:1654; owned 0700 data/uploads; fixed bounded loopback HTTP health probe |
| Frontend image | Node 24.22.2 build → Nginx 1.30.6-alpine; USER 101:101; direct Nginx entrypoint; no privileged entrypoint setup; static HTTP healthcheck |
| Compose backend | No published host API port; data/upload bind mounts with create_host_path false; read-only root; 128 MiB noexec/nosuid/nodev tmpfs; ALL capabilities dropped; no-new-privileges; 1 GiB/1 CPU/256 PIDs |
| Compose frontend | Host 127.0.0.1:5173 only; read-only root; 32 MiB hardened tmpfs; capabilities/security flags; 128 MiB/0.5 CPU/64 PIDs; healthy backend dependency |
| Network/trust | Fixed private subnet and backend/frontend addresses; backend trusts configured frontend address with ForwardLimit 1, not arbitrary forwarders; default loopback trust remains |
| Nginx | Port 8080, two workers, temp paths under /tmp, bounded bodies, production headers, upload streaming; syntax/effective directives have not been executed here |

Docker and Nginx executables were unavailable; **no live container/Nginx validation is claimed**. The fixed health result is liveness, not a continuous database-write/readiness guarantee.

An important topology prerequisite remains: current Nginx forwards **its own** `$scheme` and `$remote_addr`. With a separate HTTPS terminator forwarding HTTP to this container, those values describe the inner HTTP/proxy hop, not necessarily the original HTTPS/client. Blindly trusting arbitrary incoming forwarding headers is not a safe remedy. The final ingress must tightly define trusted hops, strip spoofed inputs, preserve verified scheme/client address, provide public HTTPS redirects/HSTS, and test that login rate partitions do not collapse all clients into one proxy address. This is an unresolved deployment topology verification under SEC-004, not a claim that TLS is already working. Nginx's [proxy header documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header) explains its explicit header replacement behavior.

## 13. Attack-scenario replay

| Entry | Current defenses → remaining path → result | Assessment |
| --- | --- | --- |
| Fresh-install unauthenticated attacker | No default admin, protected writes/reads, throttled login, Production Seed absent → guess credentials/DoS attempts only → no tested business-data/admin access without credentials | **BLOCKED** for original default-admin/anonymous-data paths |
| Repository/config reader | No current signing key/real deployable credential, old material historical → need separately injected live secret or host access → repository access alone cannot forge a current token | **MATERIAL RISK REDUCED**; live secret/host controls required |
| Compromised mechanic | Backend admin/complete-history guards, versions, DTOs and audit → may still read shared PII, edit active operational data, complete work or abuse allowed creates → cannot administer users/settings/audit or erase protected completed history through tested APIs | **MATERIAL RISK REDUCED**; trusted-staff misuse still possible |
| Stolen JWT | Scope/signature/lifetime and current database session checks → replay until revocation/expiry while account remains valid → password/logout/delete/role change cuts off subsequent use, but failed offline logout or already admitted requests remain relevant | **STILL POSSIBLE** before revocation; original indefinite stale-session path reduced |
| Malicious employee | Bounded/validated operational writes, admin-only destruction, transactional audit → can perform authorized harmful changes or copy shared data → audit attribution assists review but does not replace staff/device controls | **STILL POSSIBLE** within assigned role |
| Upload attacker | Authenticated own-image route, decoder/re-encoder, limits/quota/generated paths/sandbox → malformed/overquota uploads rejected; normalized raster public → no tested script/file-path execution path | **BLOCKED** for original active-file/traversal path; native/filesystem controls still required |
| Network attacker | Local Compose exposes only loopback HTTP, intended external TLS edge → real traffic could be intercepted if publicly exposed before TLS → readiness scaffolding is not encryption | **REQUIRES OPERATIONAL CONTROL** |
| Developer-route attacker | Production Seed controller/path unavailable, Swagger dev-only, recovery CLI local/interactive/Development → environment/host misconfiguration remains route to diagnostic/admin sample tools, still credential-gated where applicable | **BLOCKED** in tested Production; environment/local access control required |

## 14. New findings and corrective action

### FINAL-001 — direct JobParts append bypassed aggregate worksheet ceiling

- **Severity:** LOW. **Classification:** confirmed authenticated business-validation/security weakness. **Status:** **FIXED in uncommitted tree**.
- **Affected:** `POST /api/JobParts`; [JobPartsController.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/JobPartsController.cs); shared validation in [WriteRequests.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Requests/WriteRequests.cs).
- **Evidence:** baseline checked each line, parent version/status and line count, but not persisted parts + labor + proposed line against the full-save aggregate limit. The new regression reached the exact ceiling, then appended one additional unit: expected 400, actual **200** before correction.
- **Realistic exploit:** a malicious authenticated employee bypasses the normal full-save workflow with crafted direct append calls to persist totals the normal DTO refuses.
- **Impact:** inconsistent extreme charges and subsequent full-save rejection until the record is corrected. No new privilege, SQL execution, data disclosure or numeric overflow was established. The employee already has broad active-charge editing rights; this limits severity.
- **Likelihood:** low; requires credentials and deliberate direct API use with extreme values.
- **Correction:** one shared `WorksheetTotalMax` constant; typed SQL 64-bit subtotal plus persisted labor/proposed amount checked before modifying/saving. Existing CAS and atomic audit remain.
- **Verification:** [FinalSecurityReauditTests.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop.Tests/FinalSecurityReauditTests.cs) fails before/passes after, accepting exact boundary and verifying over-limit 400, unchanged version/children/audit count. Full backend/Chromium suites pass afterward.
- **Gate:** no remaining blocker **provided the correction is included in the release**. An unchanged `c610e35` checkout still has the gap.

### FINAL-002 — current development dependency advisory / unsupported lint branch

- **Severity in this application:** LOW; npm's upstream classification is moderate. **Classification:** non-blocking dependency/tooling maintenance warning; no application-reachable exploit demonstrated. **Status:** OPEN for a separate tested tooling update.
- **Affected:** [Frontend/package.json](C:/CarServiceApp/CarServiceApp/Frontend/package.json), [Frontend/package-lock.json](C:/CarServiceApp/CarServiceApp/Frontend/package-lock.json); ESLint/minimatch chain described in section 9.
- **Evidence:** fresh full npm scan reports six linked moderate entries; production-only scan reports zero. ESLint 9.39.5 is deprecated. The installed minimatch branch lacks the particular optimized preprocessor named by the advisory; broad scanner range/reachability uncertainty is explicit above.
- **Scenario/impact:** attacker-influenced lint/glob inputs in a development/CI context could merit review; workshop requests do not invoke lint tooling. A reachable resource-amplification exploit was not established here. This is not evidence of a public API DoS vulnerability.
- **Likelihood:** low for this application topology; tooling maintenance exposure remains.
- **Recommendation/verification:** plan a supported ESLint/tooling upgrade compatible with a patched dependency graph; review actual advisory applicability and rerun lint/type/build/browser checks. Do not apply npm audit fix --force or override major transitives blindly. npm currently reports no automatic fix.
- **Gate:** non-blocking for the reviewed production application; keep tracked maintenance and fresh build/image scans.

No unresolved Critical/High application vulnerability was confirmed. Conditional filesystem-link assumptions, process-local limits, bearer storage, audit retention and unverified infrastructure are recorded explicitly rather than inflated into proven remote exploits. This is a source/local-test re-audit, not a penetration-test guarantee that no undiscovered issue exists.

## 15. Full regression evidence

| Required operation | Result |
| --- | --- |
| dotnet restore | PASS; also refreshed with `--no-http-cache` |
| Backend/test build | PASS, zero errors; pre-existing CS8618 User.Role warning |
| Baseline complete backend suite | 170 passed before new gap test |
| New focused security regression | Failed before fix with 200 vs expected 400; passed after correction |
| Final complete backend suite | **171 passed, 0 failed, 0 skipped** |
| Migration/model consistency | PASS within unchanged upgrade/integrity tests and Stage 3E prior-schema upgrade/HasPendingModelChanges checks; no new schema change |
| npm ci | PASS; no package/lockfile version changes |
| Strict TypeScript | PASS |
| Frontend production build | PASS |
| Baseline complete Chromium | 85 passed |
| Final complete Chromium after fix | **85 passed, 0 failed, no retries (3.4 minutes)** |
| Fresh full/production npm scans | Completed; 6 moderate dev entries / 0 production |
| Fresh application/test transitive NuGet scans | Completed; no vulnerabilities reported |
| Native SQLite detail check | PASS, loaded 3.53.3 |
| git diff --check / new-file whitespace | **PASS**, no whitespace errors |
| Docker/Nginx/image runtime validation | **UNVERIFIED — tools unavailable**, not passed by static review |

Tests use disposable SQLite/upload roots and isolated synthetic accounts. Existing 235-record paging/SQL/response-size sanity checks, 500-line detail/preview checks, calendar dates, role/session matrices, upload tests, concurrent writes, audit rollback and Production CSP/print tests all remain in the passing suites. No destructive/high-load/external-system test or real-data mutation was performed. No earlier assertion was weakened or existing test file changed.

## 16. Code blockers and operational prerequisites

**Remaining code blockers: none in the corrected, tested working tree.** Review/include FINAL-001 and its regression in the release candidate; no commit was made automatically. FINAL-002 is non-blocking maintenance. No new migration is required by this correction.

**Before real business data:** validate a restorable protected backup procedure and consistent DB/upload storage, correct filesystem permissions, strong independent production secrets/accounts, restricted network access/TLS appropriate to use, upgrade on a copy of existing data, and an operator policy for audit/upload growth and incident/session revocation. Do not substitute the test hosts/known test credentials for real provisioning.

**Before public production exposure, the following remain mandatory operational blockers:**

1. **Isolated container trial:** build/run the reviewed images, validate Compose syntax/resolved settings, execute `nginx -t`, verify health/restart behavior, Production environment, private API exposure and effective non-root/read-only/capability/no-new-privileges/resource controls. Record actual built/resolved images and scan their OS/native contents; package scans are not image scans.
2. **Persistent paths and permissions:** create intended bind paths with verified Linux UID/GID ownership (backend 1654), least privilege, SQLite DB/sidecar and upload writes, tmpfs behavior and no unintended untrusted writers/links. Exercise failure/full-storage behavior without real customer data.
3. **TLS/domain/firewall ingress:** choose the real trusted termination topology, DNS/domain and certificates, HTTPS redirect/HSTS, upstream scheme/client-IP handling and spoofed-forwarding rejection. Confirm public HTTP cannot carry credentials/business traffic, rate limits see intended client identities, and backend/storage ports remain private. Configure/check host firewall and access to management services.
4. **Production configuration/secrets/accounts:** inject fresh unrelated random signing material and explicit issuer/audience persistently without committing/building secrets, verify retired/wrong tokens fail, and provision a strong unique administrator through the supported explicit path. Remove test fixture credentials/data from the deployment workflow; verify actual existing roles/normalized identifiers and a migration dry run on a backup/copy.
5. **Backup and restore:** create consistent protected/off-host database and upload backups, prove restoration of business data, user/session state, audit and images in an isolated environment, and define recovery ownership. A statement that backups exist is not a restore test. This re-audit did not inspect or validate any production backup.
6. **Operations and trial run:** establish lightweight health/error/auth-abuse/disk/backup/expiry alerting and log/audit/upload retention/capacity review; avoid logging tokens/passwords/request bodies. Complete an operator workflow trial under the intended ingress, printing, roles, concurrency, uploads and revocation before onboarding customer data/public traffic. No monitoring platform was built here.

These are evidenced gaps in execution/configuration validation, not invented claims that deployment controls were completed. Full internet exposure should remain disabled until they pass.

## 17. Exact recommended next stage and change inventory

Recommended next stage: **PRE-PRODUCTION OPERATIONAL VALIDATION IN AN ISOLATED STAGING ENVIRONMENT**, after reviewing/including the small FINAL-001 correction. Its deliverable should be execution evidence for the six operational groups above and a separate release decision. Start with container/image/Nginx/storage and backup/restore validation; do not jump directly to public deployment. This report does not start that stage or configure HTTPS/DNS.

This re-audit changes only:

- [JobPartsController.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Controllers/JobPartsController.cs): aggregate validation on direct append.
- [WriteRequests.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop/Requests/WriteRequests.cs): shared existing ceiling constant.
- [FinalSecurityReauditTests.cs](C:/CarServiceApp/CarServiceApp/Backend/CarServiceShop/CarServiceShop.Tests/FinalSecurityReauditTests.cs): new focused regression.
- [FINAL_SECURITY_REAUDIT_REPORT.md](C:/CarServiceApp/CarServiceApp/FINAL_SECURITY_REAUDIT_REPORT.md): this report.

No source files/migrations/packages/configuration were removed or upgraded; no unrelated recovery code was edited. The four disposable browser database/upload/build-copy directories created by the two re-audit runs were removed after server shutdown, with resolved paths verified inside the test-data root; earlier local artifacts and real data were preserved. Generated validation artifacts are ignored and are not release inputs. Final HEAD remains `c610e35`; changes are uncommitted and unstaged. Work stops after this re-audit.
