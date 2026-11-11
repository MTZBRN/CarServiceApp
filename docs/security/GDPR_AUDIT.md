# Phase 7A — GDPR and application data-security audit

Audit date: 2026-11-11. Repository: MTZBRN/CarServiceApp.

## Phase 7B verified update — 2026-11-11

**GAP-01 is fixed in this working tree.** The Phase 7A evidence and results below are retained as historical baseline findings; statements about public image access and intentionally failing tests describe the original revision, not the current implementation. No deployment or legal compliance claim is made.

* `B/Controllers/ProfileImagesController.cs` now handles GET/HEAD for `/api/ProfileImages/{name}` and the legacy `/uploads/{name}`. Both require a live authenticated session. Only the owning account or an administrator may read its **current database-referenced** image. Other accounts, malformed names, missing files, symlinks and stale/orphaned files are not served. Cross-account denial is 404 to avoid confirming existence. PNG and legacy JPG/JPEG remain supported.
* `B/Program.cs` removes the upload static provider and excludes `/uploads` and `/api` from ordinary webroot static serving, preventing stray copies from bypassing authorization. `B/Security/ProductionHardening.cs` adds `Cache-Control: no-store` and the restrictive image sandbox CSP to image routes, including denied responses. Successful image responses have no ETag/Last-Modified or enabled range processing.
* `F/auth/useProfilePicture.ts` retrieves bytes through the existing session-aware API client with an Authorization header, then produces an in-memory data URL for Settings/Sidebar. Data URLs are already permitted by the unchanged production CSP, so no deployment/header configuration change is necessary. No token is placed in a URL and no image is stored in localStorage. Cleanup aborts network/file-reader work; identity/filename checks reject stale results. Data URLs need no object-URL revocation and disappear with component/session state.
* Upload decoding, limits, generated names, replacement cleanup and audit behavior are unchanged. A failed old-file cleanup still needs operational attention (GAP-09), but its stale filename is now unreachable through the image controller, including for admins. Files/backups are not deleted by the new retrieval code.

Verified locally with fictional data:

| Check | Phase 7B outcome |
|---|---|
| Full backend suite (.NET 10.0.403) | **201 passed, 0 failed, 0 skipped**; `test-results/phase7b/phase7b-backend.trx` |
| Privacy suite | **20 cases passed**, including both original failing cases (no longer tagged KnownPrivacyGap); GET/HEAD route matrix, owner/admin/cross-account, anonymous/query-token/revoked/expired reads, stale image and webroot bypass, missing files, legacy JPEG, account deletion and audit minimization |
| Frontend typecheck + production build (Node 24.22.2) | **Passed** |
| Focused Chromium regressions | **7 passed**: new local Production image test, existing password/upload/reload workflow and five session/logout tests. Actual image decoding worked under production CSP. Delayed image responses did not reappear after logout. Network requests carried tokens only in Authorization headers. |

Backend command: `dotnet test Backend/CarServiceShop/CarServiceShop.Tests/CarServiceShop.Tests.csproj --no-restore --logger "trx;LogFileName=phase7b-backend.trx" --results-directory test-results/phase7b`.

Frontend commands: `npm run build`; `npx --no-install playwright test tests/profile-image-privacy.spec.ts tests/idle-session.spec.ts tests/stage2a.spec.ts tests/stage27.spec.ts --project=chromium --grep "profile images|personal password and profile image|warns with a dirty|wake after deadline|429 activity|replacement identity|logout clears" --reporter=list`.

Changed files in Phase 7B (including updates to uncommitted Phase 7A artifacts):

* Backend: `Backend/CarServiceShop/CarServiceShop/Controllers/ProfileImagesController.cs` (new), `Backend/CarServiceShop/CarServiceShop/Program.cs`, `Backend/CarServiceShop/CarServiceShop/Security/ProductionHardening.cs`.
* Frontend: `Frontend/src/auth/useProfilePicture.ts` (new), `Frontend/src/api/client.ts`, `Frontend/src/components/layout/Sidebar.tsx`, `Frontend/src/components/Pages/Settings.tsx`.
* Tests: `Backend/CarServiceShop/CarServiceShop.Tests/GdprPrivacyTests.cs`, `Frontend/tests/profile-image-privacy.spec.ts` (new), `Frontend/tests/stage27.spec.ts`.
* Documentation: `docs/security/GDPR_AUDIT.md`, `docs/security/DATA_INVENTORY.md`, `docs/security/REMEDIATION_PLAN.md`.

Lint limitation: the default ESLint invocation needs missing `jiti`; the native TypeScript-config loader alternative runs but the existing configuration does not match these TS/TSX files, so lint did not validate them. No dependencies or lint configuration were changed. TypeScript typecheck and the production build did validate the frontend code.

Remaining limits: no VPS/TEST/PROD or deployed reverse-proxy verification; existing Nginx routing was not modified. Previously cached/downloaded images cannot be recalled by no-store, nor can bytes already delivered before revocation. Concurrent requests authorized before logout may finish. Backup confidentiality/recovery, localStorage bearer-token risks, cleanup failure reporting and business/legal policy gaps remain. NuGet vulnerability metadata remained unavailable (NU1900); the existing User.Role nullable warning remains. No runtime dependencies, migrations, retention/deletion jobs, commits, pushes or deployments were introduced.

## Scope and evidence boundary

Audited baseline: locally recorded `origin/test-deploy`, commit `8b6b7ad11b5182d7508deae1c2683a95136d8d2c`. Isolated worktree: `C:/CarServiceApp/gdpr-audit`, branch `feature/gdpr-audit`. The original `feature/test-deploy-bootstrap` tree was clean before isolation and was not switched. No fetch was performed; remote freshness and review approval were not independently verified. No HANDOFF.md or AGENTS.md was present in the audited tree or its workspace parents.

Inspected actual controllers, request DTOs, models, migrations, authentication/session/upload/audit helpers, frontend API/state/auth/print/privacy code, Dockerfiles, compose, Nginx/Caddy examples, backup/restore/orchestration scripts and existing tests. Phase 6D/6E deployment changes on the separate branch are **not** part of this baseline. No deployment, workflow, infrastructure, application runtime or dependency file was changed. No customer database, VPS, TEST or PROD endpoint was accessed. Tests create fictional records and disposable local databases/images.

This is a technical gap analysis, not a legal compliance determination. “Confirmed” means supported by this revision's code and, where indicated, a local reproduction. “Potential” means the impact depends on unverified operating conditions. “Decision” requires the controller/business and legal advisers to settle scope or policy. No Critical or High exploitable application vulnerability was confirmed. Medium findings remain actionable; absence of a finding is not proof of security.

All source paths below are repository-relative; line numbers refer to the baseline. `B` means `Backend/CarServiceShop/CarServiceShop`; `F` means `Frontend/src`. See [data inventory](DATA_INVENTORY.md) and [remediation plan](REMEDIATION_PLAN.md).

## Findings, ranked

| ID | Severity | Classification | Finding |
|---|---|---|---|
| GAP-01 | Medium | Confirmed, local HTTP reproduction | Staff profile images are public by URL and lack no-store caching |
| RISK-02 | High if backup stolen or sole copy lost | Potential deployment exposure; confirmed code limitation | Plaintext backups, no implemented off-host copy or encryption in these scripts |
| RISK-03 | High if restored credentials become usable | Potential restore exposure; confirmed snapshot behavior | Restore preserves historical identity, session and deleted-record state |
| GAP-04 | Medium | Confirmed access breadth; business decision | Every authenticated workshop account can read all customers/vehicles/history; broad list projections |
| GAP-05 | Medium | Confirmed capability gap; policy decision | No retention/restriction/hold/subject-export workflow; ordinary deletion is not a rights workflow |
| GAP-06 | Medium | Confirmed operational gap | Draft privacy notice and uncontrolled browser/paper export lifecycle |
| RISK-07 | Medium | Potential exploit prerequisite | Bearer token and staff identity persist in localStorage |
| GAP-08 | Low | Confirmed observability limitation | Reads/prints and authorization denials are not structured security audit events |
| GAP-09 | Low | Confirmed cleanup limitation | Profile cleanup failures are silently ignored; old files need operator review |

### GAP-01 — Public staff images and cache persistence

**Evidence:** `B/Program.cs:192–211` serves files and then invokes authentication/authorization. The `/uploads` name filter permits `profile_<id>_<alphanumeric>.png/jpg/jpeg` but does not authenticate the caller. `B/Security/ProductionHardening.cs:36` applies `no-store` only to `/api`. `Frontend/nginx.conf:74` proxies `/uploads/` without adding authentication. `F/api/client.ts:4` builds ordinary image URLs.

**Reproduction:** run `GdprPrivacyTests.UploadedStaffPhotoMustNotBeAvailableAnonymouslyAfterLogout`. A synthetic administrator uploads a 2×2 PNG, logs out, and a separate client with no Authorization header fetches the returned path. Observed **HTTP 200**. `UploadedStaffPhotoMustHaveNoStoreCachePolicy` observes no `Cache-Control: no-store` on the image response. Both desired-protection tests intentionally fail, tagged `KnownPrivacyGap`; they are not skipped or inverted into assertions that bless the defect.

**Impact/limits:** someone who obtains a URL can access an employee image without a current session. Generated GUIDs make blind discovery difficult; no directory listing or arbitrary file traversal was demonstrated. Legacy alphanumeric filenames are also accepted, but their real population/predictability was not examined. Cacheability is confirmed; actual caching duration depends on the client/proxy. A photograph is personal data, but this code does not perform biometric identification.

**Remediation:** use an authenticated image controller outside public static roots, with an explicit owner/admin or approved staff-read policy and `no-store`. Adapt the frontend to authenticated blob retrieval and revoke object URLs on session changes. Do not put bearer tokens in image query strings. Test GET/HEAD, anonymous/revoked/expired access, cross-user access, replacement, deletion and proxy routing. Moving authentication middleware alone is insufficient to make static files enforce an authorization policy.

### RISK-02 — Backup confidentiality and resilience

**Evidence:** `scripts/ops_storage.py:98–161` produces `database.sqlite`, `uploads.tar.gz`, manifest and hashes. It uses SQLite's backup API, tar/gzip, `0700` directories and `0600` files; no encryption or network transfer exists. `scripts/orchestrate_backup.py:264` invokes this local backup. `ops/backup-staging.json:7` identifies a local output path. `docker-compose.yml:10–22` binds database/upload directories; `B/Program.cs:79` uses SQLite without configured application encryption.

**Reproduction:** existing `scripts/tests/test_ops_storage.py` creates a fictional database/image, backs up and restores them, and reads customer text directly with SQLite. This verifies archive readability and isolation, not production permission exposure. Hashes detect accidental alteration, not an attacker able to replace artifacts and hashes together.

**Impact:** an exposed archive contains all customers, staff password hashes, audit history and uploads. A local-only copy may share the host's failure/ransomware domain. Host disk encryption, external provider snapshots, ACLs, independent copies and key custody cannot be inferred from code and were not inspected. Do not report a confirmed public backup leak.

**Remediation:** infrastructure owner verifies controls in a separately authorized phase; design encrypted independent copies, separate keys, access reviews, monitored recovery and measured recovery objectives. Preserve the existing consistency and path-safety checks.

### RISK-03 — Restore can reintroduce deleted data and old credentials

**Evidence:** `scripts/ops_storage.py:124–128` copies the entire database; `:222–243` restores it unchanged to a new temporary target. No privacy reconciliation or session reset is applied. `B/Security/WorkshopSession.cs:18–27` accepts a matching historical user/version/role/session while both deadlines remain in the future. `B/Controllers/AuthController.cs:131–146` invalidates sessions in the live database. `B/Migrations/20261109094536_AddWorkshopSessions.cs:13–30` stores session state in SQLite. The backup table-count allowlist (`ops_storage.py:23`) omits Sessions, but **does not exclude it from the actual full backup**.

**Reproduction plan using fictional data:** take an offline paired backup; revoke a token/delete a fixture customer in the original; restore to a new isolated target. The snapshot still contains the old state. To demonstrate token replay, use the same test key/issuer/audience and a still-live session deadline, then compare `/api/Auth/me` before and after revocation on the two local hosts. This complete replay scenario was **not executed** in this audit.

**Preconditions/limits:** replay requires a stolen old token, matching signing configuration and restoration before its saved idle/absolute deadlines (15 minutes/8 hours). Older restores can also restore accounts/password hashes that were subsequently removed or changed. The provided script is an isolated restore verifier, not a production restore command. Actual production recovery procedures may add controls; no such execution was inspected.

**Remediation:** before restored data becomes reachable, invalidate restored sessions and reconcile account changes, approved restrictions/erasures and subsequent business changes from an independently protected decision record. Design this recovery gate; do not add automatic destructive deletion in this audit.

### GAP-04 — Workshop-wide access and overbroad projections

**Evidence:** `B/Program.cs:85` requires authentication globally but does not require a resource-specific role. `Controllers/CustomersController.cs:23–47`, `VehicleController.cs:23–44`, `ServiceJobsController.cs:22–63` expose any supplied record ID to an authenticated user. Vehicle responses include the full customer; appointment lists (`AppointmentsController.cs:25–28`), worksheet rows (`Requests/CollectionQuery.cs:83–91`) and dashboard (`DashboardController.cs:29–38`) likewise include contacts/addresses even where a list needs only a name/plate.

**Reproduction:** with two fictional customers and a mechanic login, GET both customer IDs, both vehicle IDs, and `/api/ServiceJobs/ByVehicle/{id}`. Trace the response projections above; no assignment/tenant/owner predicate exists. Anonymous reads are covered by new HTTP tests and return 401/no-store.

**Assessment:** the models have no tenant, customer login or mechanic assignment boundary. This is confirmed broad staff access, **not a demonstrated cross-tenant IDOR**. Changing integer IDs is not by itself an exploit in an intentionally shared workshop. Business owners must approve a purpose-based role/field matrix. If mechanics should be limited, enforce the chosen scope server-side on lists, details, lookup, dashboard, history and print data, not just UI routes. Reduce list DTOs regardless where fields are unnecessary.

### GAP-05 — Rights, retention and deletion lifecycle

**Evidence:** `CustomersController.cs:40–58` supports contact editing, but blocks deletion when vehicles exist. `VehicleController.cs:79` blocks history-bearing vehicle deletion. Database triggers in `Migrations/20261029000200_IntegrityGuards.cs:14–16` protect the same relationships. `ServiceJobsController.cs` permits admin deletion and cascades line items; appointment deletion preserves the worksheet with a null appointment link (`AppointmentsController.cs:85–96`, `Data/ApplicationDbContext.cs:54–58`). `Models/AuditEvent.cs:3` deliberately retains actor/resource references without foreign keys. Models lack legal holds, restriction flags, retention review dates or subject-request records. Backup scripts have no pruning; session expiry cleanup occurs on login (`AuthController.cs:58`), not a general retention mechanism.

**Impact:** deleting a customer is neither a complete export nor verified erasure across backups, audit references, browser PDFs and paper. Removing relational protections would risk business/history loss. Admin deletion also has no legal-hold gate. SQLite DELETE does not prove physical sanitization of free pages, WAL, snapshots or storage media. Staff names remain in audit history after account deletion.

**Recommendation:** inventory-linked, identity-verified manual request handling first; purpose-specific retention and holds; reviewed export/redaction; restrictions and correction propagation; a decision record and backup-restore reconciliation. Do not bypass history guards, erase audit trails wholesale, or turn a proposed “five years” into an automatic job.

### GAP-06 — Draft notice and exported documents

**Evidence:** `F/features/privacy/PrivacyNoticePage.tsx:5–8,23–26` explicitly identifies an unapproved draft. Later sections describe tentative retention and operational claims needing verification. `F/components/print/WorkSheetPrintModal.tsx:25–64` copies contact/vehicle data into editable React state, then calls react-to-print with the plate in the document title. `:158` invokes printing locally. No server PDF route, PDF table, document upload or cloud PDF processor was found in this revision. Browser “Save as PDF” and physical printing are outside database deletion.

**Reproduction:** using fictional worksheet data, open print preview and inspect customer name, phone/address, plate, VIN, description and editable additions. The suggested document title contains the plate. Downloads, print spoolers, desktop sync, paper handover and destruction are operational surfaces, not verified app controls. At this baseline some print-only edits are transient and not saved; do not attribute later Phase 6D/6E persistence changes to this audit.

**Recommendation:** approve an accurate notice before representing it as final; avoid identifying filenames where unnecessary; document secure delivery, printers, downloads and disposal. A technical export event can record intent, not prove that a user completed printing or that all copies were deleted.

### RISK-07 — Browser token persistence

**Evidence:** `F/auth/AuthProvider.tsx:17,42–46` and `F/api/client.ts:7,22–23` persist/read the bearer token in localStorage. `AuthProvider.tsx:54` clears identity on signout; the API interceptor clears it on 401 and aborts stale responses. `F/data/WorkshopDataProvider.tsx:17–20` remounts caches per session. `B/Security/ProductionHardening.cs:12` sets a restrictive production CSP.

**Assessment:** same-origin script compromise or access to an unlocked browser profile could disclose the token. No stored XSS or token theft was demonstrated. Server session validation and expiry still constrain replay; manipulating the local UI role does not change server authorization. Evaluate HttpOnly/Secure cookies with CSRF protections as a separate design, and workshop device locks/profile isolation now. Do not switch token storage without handling CSRF and concurrent-tab behavior.

### GAP-08/GAP-09 — Audit and image cleanup limitations

`B/Security/AuditWriter.cs:31–93` records allowlisted mutation deltas transactionally, omitting free-text customer/contact/password values. Actor name/role, IDs and timestamps remain personal/security data. Failed logins are sampled (one/minute, 20/hour per process); unknown attempted identifiers are not persisted. GET reads, denied requests and browser print actions have no corresponding structured AuditEvent call. `Frontend/nginx-main.conf:15–18` logs normalized routes, status, duration and request ID, not query strings/IPs/headers; `Frontend/nginx.conf:7–24` redacts arbitrary paths. App exception logging omits exception messages (`ProductionHardening.cs:39–48`). These are useful minimization protections, but incident reconstruction is limited. Decide proportionate denied-access/bulk-read/export signals with bounded volume and no payload/token logging; do not start logging every customer search term.

`B/Security/ProfileImages.cs:58–62` returns false on file deletion failure; upload replacement (`AuthController.cs:214`) and user deletion (`UsersController.cs:74`) ignore that result. A stale orphan may remain public by known URL and enter backups. Test by simulating a filesystem deletion failure in a disposable fixture; that failure-path test was not added here. Add a non-identifying operational signal and dry-run orphan inventory with human review; avoid blind recursive cleanup.

## Existing controls reviewed

Access matrix observed in controller attributes and the fallback policy (a workshop has no tenant/customer-login boundary in these models):

| Surface | Anonymous | Mechanic | Admin | Server enforcement |
|---|---|---|---|---|
| Customer, vehicle, appointment, worksheet/history, dashboard and inventory reads | Denied | Workshop-wide | Workshop-wide | `Program.cs:85`, controller queries |
| Customer create/update; vehicle create; appointment create/update; open worksheet/parts and inventory writes | Denied | Allowed with input/integrity checks | Allowed | DTOs/controllers; completed worksheet writes additionally check role |
| Business-record deletes | Denied | Denied | Allowed subject to history/concurrency guards | Method-level admin attributes and DB triggers |
| Account management and audit reads | Denied | Denied | Allowed | UsersController/AuditController class-level admin policy |
| Company settings | Denied | Read only | Read/write | SettingsController write-level admin attribute |
| Password/photo/activity/logout/me | Denied | Own identity | Own identity | NameIdentifier/session claims, not client-supplied user ID |
| Login, health, SPA/privacy page | Allowed | Allowed | Allowed | Explicit anonymous routes/static public assets |
| Profile image static GET | **Allowed by known URL** | Allowed | Allowed | Filename filter only (GAP-01) |
| Seed | Absent outside Development | Denied in Development | Development only | Feature provider + environment middleware + admin attribute |

* JWT: explicit issuer/audience/signature/lifetime validation, zero skew, random external key validation; per-request database session/version/role check. Fifteen-minute idle, eight-hour absolute limit; only explicit activity extends idle time. Logout, password change and account deletion invalidate access. Existing IdleSessionTests/ActivityLimitTests cover boundaries and activity throttling.
* Authorization: admin-only Users/Audit, settings writes and deletes; mechanics cannot alter completed worksheets or append their parts. Anonymous login/health/SPA are intentional; production seed route is unavailable. Existing integration suites exercise role boundaries and mass-assignment/integrity controls.
* Inputs/storage: bounded DTOs, EF queries, concurrency versions and DB relationship guards. Profile images limited by bytes/dimensions/type, raster decoded/re-encoded, generated names, metadata discarded by pixel re-encoding, storage budget, safe owned-file deletion. No arbitrary customer-document upload route found.
* Responses/browser: API no-store, generic errors, no-referrer, CSP/frame restrictions, cancellation and cache reset across identities. User listing projects safe fields instead of returning password hashes. `User.PasswordHash` itself is not JsonIgnore: future endpoints should continue using safe DTOs; no current hash leak was identified.
* Deployment source: non-root, read-only containers, restricted bind mounts/capabilities, externally supplied JWT settings, explicit proxy trust, loopback frontend exposure. This is source inspection, not verification of deployed TLS/firewalls/secrets/host permissions.
* Backups: quiescence acknowledgement, consistent SQLite snapshot plus upload inventory, hashes, path/symlink/overlap protection, restore only into a fresh temporary target. No live restore, backup, pruning or container operation was performed.

## Missing business/legal decisions

The controller must decide purposes and lawful bases per category; necessity of full contacts for mechanics; treatment of changed vehicle owners; retention of contact data versus technical repair history and accounting records; employee photo necessity; holds/disputes; restricted-processing workflows; processor contracts and actual transfers; request ownership/identity checks; incident escalation; device/paper handling; and backup/key/recovery ownership. Do not treat public notice statements about providers or retention as independently verified facts.

Legal framework checked against the [official GDPR text](https://eur-lex.europa.eu/eli/reg/2016/679) on the audit date: Articles 5, 6, 12–22, 25, 28, 30 and 32–35 inform the decision checklist. Rights depend on conditions and exceptions; access/rectification/restriction/objection/portability are not interchangeable with deletion. Legal obligations and claims can affect erasure decisions. Local statutory retention periods, lawful bases, notification duties and any DPIA/DPO requirements need qualified assessment; this audit does not prescribe a universal period or certify compliance.

## Validation

Added `Backend/CarServiceShop/CarServiceShop.Tests/GdprPrivacyTests.cs`: 12 cases (eight anonymous endpoint cases; two image-gap cases; account deletion/photo/session cleanup; protected history and audit minimization). `KnownPrivacyGap` marks two intentionally red desired-control tests. A default full test run must remain red until GAP-01 is fixed; a filtered run is not a clean bill of health.

Final execution results:

| Validation | Outcome |
|---|---|
| Full backend suite, .NET SDK 10.0.403 | **187 passed, 2 failed, 0 skipped (189 total)**. Both failures are the new GAP-01 assertions. All 177 pre-existing cases passed. |
| New privacy cases within full run | **10 passed, 2 intentionally failed**: anonymous image GET returned 200 after logout; no-store missing. |
| Existing backup/restore tests, Python 3.14 | **10 passed, 1 skipped** (Windows did not grant symlink creation). |
| Frontend typecheck and Vite production build, Node 24.22.2 | **Passed**. Locked dependencies installed offline from host cache; no dependency files changed. |
| Existing Chromium tests: idle-session, stage2a, stage3e | **8 passed**: cross-tab expiry/identity replacement, offline logout cleanup, 429 activity behavior, admin audit paging/minimization, mechanic audit denial, text-safe audit rendering. |
| Source review / whitespace | No tracked baseline files changed; only three documents and one new test source; diff whitespace check clean. |

The first deletion test expected only 404, but the real missing-file path returns 401 after falling through to authorization. The assertion now accepts either safe denial while independently checking physical file removal; the final run above supersedes the earlier exploratory results. No live TLS/proxy, production permissions, full PDF-layout suite, dependency vulnerability refresh or complete restore-replay experiment was run.

Commands (from isolated worktree):

```powershell
$env:TEMP='C:\CarServiceApp\gdpr-audit\test-results\phase7a\temp'
$env:TMP=$env:TEMP
dotnet test Backend/CarServiceShop/CarServiceShop.Tests/CarServiceShop.Tests.csproj --no-restore --logger 'trx;LogFileName=gdpr-full.trx' --results-directory test-results/phase7a
# Separate existing/protected behavior from the known gaps, if needed:
dotnet test Backend/CarServiceShop/CarServiceShop.Tests/CarServiceShop.Tests.csproj --no-build --filter 'Category!=KnownPrivacyGap'
C:\CarServiceApp\.stage4a-tools\python314\python.exe -m unittest discover -s scripts/tests -p test_ops_storage.py -v
# From Frontend, with Node 24.22.2 on PATH:
npm run build
npx --no-install playwright test tests/idle-session.spec.ts tests/stage3e.spec.ts tests/stage2a.spec.ts --project=chromium --reporter=list
```

Backend runner required execution outside the Windows sandbox after sandbox runs stalled. Python tests required a workspace temporary directory. Package restore reported NU1900 because vulnerability metadata was unavailable; no fresh dependency vulnerability assessment is claimed. Raw local TRX artifacts are under `test-results/phase7a/` and are not intended as source changes.
