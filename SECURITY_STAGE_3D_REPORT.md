# Security Stage 3D — Resource limits, pagination and abuse bounds

Date: 2026-11-01. Scope: **SEC-009 only**. Baseline: committed Stage 3C `fcfa62b` (`Harden repository and container configuration`). Implementation remains uncommitted.

The original stage inspected a clean Stage 3C baseline. The continuation inspected and preserved the existing Stage 3D diff instead of restarting it. There were no unrelated uncommitted recovery changes. The baseline development-only recovery implementation and its tests were left unchanged; Stage 3D does not depend on recovery. No workshop database, production configuration, secret, migration history or Git history was modified.

The implementation plan was to bound database collection reads, move search and relevant date filtering into SQL, adapt the shared frontend resource/cache layer and selectors, bound bodies/worksheet writes/uploads, add disposable-data integration checks, and run every required regression before assigning the gate.

## 1. Collection endpoints and contract

Responses remain JSON **arrays**. Paging metadata uses `X-Total-Count`, `X-Page`, and `X-Page-Size`. These headers describe the filtered result before paging. Trusted Development origins may read those headers through the existing CORS policy; Production's same-origin policy remains unchanged. User lists additionally expose `X-Admin-Count` to authorized administrators so the last-admin UI works across pages.

| GET endpoint | Ordering | Server-side filters |
| --- | --- | --- |
| `/api/Customers` | ID ascending | `q`: name, phone, email |
| `/api/Vehicle` | ID ascending | `q`: registration, make/model, customer name; `customerId`; `inspection`; `motFrom` inclusive / `motTo` exclusive |
| `/api/ServiceJobs` | Worksheet date descending, ID descending | `q`: ID, description, vehicle registration/make/model, customer name; `vehicleId`, `appointmentId`, `status`, `from`, `to` |
| `/api/ServiceJobs/ByVehicle/{vehicleId}` | Worksheet date descending, ID descending | Same worksheet filters; the route determines the vehicle |
| `/api/parts` | ID ascending | `q`: name/part number; exact case-insensitive `partNumber`; `stock` |
| `/api/Appointments` | Start time ascending, ID ascending | `start`, `end`, `vehicleId`; overlap with the requested window |
| `/api/Users` | ID ascending | `q`: name/login; remains admin-only, without password/session fields |

All these collections default to `page=1&pageSize=50`; page size is limited to **100**, page to **1–100000**. Invalid types, zero/negative values, values outside those limits, oversized queries, unsupported filter values and invalid/reversed dates return controlled **400** responses. `q` is at most 200 characters; exact part number at most 100. Valid pages past the result return an empty array with the correct total; a count check avoids issuing an unnecessary deep-offset page query.

Supported worksheet statuses are `open` and `completed`. Inventory filters are `out` (0), `low` (1–4), `available` (5+), and `invalid` (negative legacy values). Inspection filters are `expired`, `soon` (today through the next 30 days), `valid`, `missing`, and `invalid`. Worksheet `from` is inclusive and `to` includes the specified calendar day. Date inputs must be within 1900–2100.

Settings remain a singleton. Item-by-ID endpoints retain their full detail/print behavior. The vehicle item query no longer loads a service-history navigation that was already excluded from JSON.

Worksheet collection rows add `partsTotal` and `lineItemCount` and carry at most **20** historical line-item previews per worksheet. Totals aggregate **all** saved lines in SQL; they do not total just the preview. Vehicle history explicitly identifies truncated previews and directs users to the full saved worksheet/print. Collection rows include the bounded parent vehicle/customer context, avoiding separate all-vehicle/all-customer joins in the browser.

## 2. Appointment ranges and dashboard

Appointment `start` and `end` must be supplied together, in increasing order, at most **93 days** apart. The overlap predicate retains multi-day bookings that started before the window. With neither supplied, the server uses today minus seven days through today plus 35 days. Paging still caps a very busy range at 100 appointments per response, with totals and controls for remaining pages.

The calendar requests its visible month grid, Monday-based week, or 30-day agenda, with a deliberate one-day buffer at both ends. Inspection reminders use the corresponding bounded vehicle date query. Separate appointment/reminder pagers prevent a crowded window from silently losing later records. URL dates/views, historical navigation and browser back remain supported. Vehicle detail shows a clearly labelled, paged next-90-days appointment window and directs other periods to the calendar.

New authenticated `GET /api/Dashboard` supplies full-dataset **counts** and at most **six rows per panel** (today's bookings, active jobs, recent jobs, inspections, low inventory). It replaces full-table dashboard preloads. The client supplies its local calendar date and UTC instants at local midnight boundaries, preserving today's metric across timezone/DST changes; the backend limits that explicit dashboard window to two days. Counts use SQL aggregation. Booking rows include only the worksheet ID/completion link needed for navigation.

## 3. Frontend pagination and shared resources

- Customers, vehicles, inventory, worksheets and users have current page, total/pages, previous/next controls. Customer-associated vehicles, vehicle history, calendar ranges and relevant lookup lists are also paged.
- Search/filter changes return to page 1. Search is debounced by 250 ms. Historical records remain discoverable through server search and paging. New customer/vehicle/inventory selectors have search and paging rather than loading entire tables.
- By-ID lookups retain selected or saved records that are outside the first page. Quick-created vehicles are selected from the creation response rather than inferred from the first list page. Saved worksheets still load their complete historical snapshots for editing and printing.
- Canonical sorted query keys share cached and pending work across consumers. There are at most **64 filter-specific cached resources** per session, plus the fixed default resources. On overflow, an inactive entry is evicted; the code refuses more than 64 simultaneously active variants rather than growing without bound.
- Dynamic resources abort unused pending requests. Revisions and the existing API session generation/token guards prevent stale responses from replacing newer data or entering another user's session. Default-resource mutation refresh retains its existing revision guard and pending-sharing behavior.
- Mutations refresh affected active paged/filter variants and dashboard summaries; inactive variants become stale for the next visit. Session changes destroy the store. Users retain their existing local loading architecture, now with debounce, request cancellation and sequence protection.
- Errors/retry and form drafts retain their existing behavior. List rows are withheld during the customer/vehicle/inventory debounce interval to prevent stale unfiltered actions. A page that becomes empty after deletion is clamped after its result loads. Existing wrapping action styles support mobile paging without a new UI library.

Two actual Stage 3D loading regressions were corrected: calendar URL normalization could close a just-opened modal when range data was already cached; and list search could momentarily present stale rows while debounce was pending. Calendar modal reset now follows date/view changes, and affected lists expose their pending-search state. Pager announcements use a polite live span so they do not collide with the worksheet editor's existing status landmark.

## 4. Request and worksheet bounds

| Resource | Enforced limit / result |
| --- | --- |
| General `/api` request body | **1 MiB**, applies to all methods; oversized bodies return 413 |
| Login body | Existing **4096 bytes** preserved |
| Profile multipart body | **2 MiB + 65536 bytes** (2162688); existing 2 MiB image limit remains |
| Worksheet lines | Existing request DTO cap **500** retained; direct JobParts append now enforces the same cap |
| Strings/numeric business values | Existing Stage 2A field and numeric limits retained |

`RequestBounds` rejects excessive declared lengths before controller processing, sets the host body-size feature where available, and wraps the input stream to count unknown/chunked-length reads. Limit failures produce sanitized 413 ProblemDetails. Existing DTO validation and endpoint limits continue to apply. A valid 500-line worksheet succeeds; a 501-line replacement or append to a full worksheet returns 400 without changing it. Existing optimistic concurrency makes concurrent appends conditional on the parent version, preventing two appends from silently crossing the cap.

Nginx `/api/` has the matching 1 MiB limit. The exact profile upload location permits 2162688 bytes and streams upstream with HTTP/1.1 and request buffering disabled. The application limits operate independently of Nginx. No deployment or public network setup was performed. Nginx/container runtime verification is **unverified** in this environment; the supplied proxy change was inspected statically. Nginx documents the upstream protocol requirement for chunked streaming in its [proxy request buffering documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_request_buffering).

## 5. Profile storage and safe cleanup

Existing raster-only decoding/re-encoding, generated names, image dimensions, authorization, non-executable public serving and upload-specific headers remain. Added limits are **16 MiB per normalized image**, **256 MiB managed generated-image storage**, and at most **1024 top-level `profile_*` entries examined** for accounting. A generated-name reparse point fails closed. Quota failure returns 507 with an administrator-facing storage message.

Quota checks subtract only the current owner's valid prior generated basename, allowing replacement at capacity. With a single upload in flight, temporary replacement overhead is at most one 16 MiB output. The in-process upload lock has no waiting queue. After a successful replacement/account deletion, only that account's known generated basename is eligible for cleanup. Cleanup failure does not make a successful database operation appear failed; remaining generated files continue to consume quota.

No arbitrary-path, recursive or automatic historical orphan deletion was introduced. Unknown workshop files are preserved. Historical cleanup needs ownership/reference review and reversible quarantine during maintenance; see [UPLOAD_STORAGE_MAINTENANCE.md](UPLOAD_STORAGE_MAINTENANCE.md). Only disposable test directories were populated or cleaned during verification.

## 6. Rate/concurrency policies

| Policy | Per-account fixed window | Global in-flight limit per process | Queue |
| --- | --- | --- | --- |
| Collection/search/dashboard reads | **240/minute** default; `Reads:PermitLimit` clamped to 30–600 | **8** | None |
| Profile upload | **10/minute** | **1** | None |
| Worksheet create/update and direct JobParts append | **120/minute** | **4** | None |

Policies run after authentication, before model binding/controller execution. Collection fallback partitioning uses the resolved source for anonymous requests; protected routes still require authorization. Rejection is 429. Limits are deliberately narrow; ordinary record writes/settings/authentication were not put behind a new general gateway. Existing login throttling remains unchanged. Rate rejection does not lock the account or revoke its session. Tests confirm `/api/Auth/me` still succeeds after upload/write rate exhaustion.

## 7. Query safety, indexes and migrations

Filtering, counts, ordering and `Skip`/`Take` execute through EF parameterized LINQ. New reads use `AsNoTracking` and cancellation tokens. No dynamic raw SQL, client-side whole-table search, per-row lookup loop, or unbounded child include was added. Worksheet child previews are capped, aggregate totals remain complete, and dashboard panels have independent fixed bounds.

SQLite's ASCII-only case conversion would regress Hungarian searches. A deterministic connection-level `workshop_fold` function performs invariant Unicode lowercase and is mapped in EF so contains searches still run in SQL. Literal injection-like strings remain search data. The mapping introduces **no schema change**. Existing relationship indexes are retained; no speculative search index was added because substring matching would not become an indexed seek through an ordinary B-tree.

**No migration created; no schema/index reset, provider change or business-data rewrite.** Existing upgrade and model consistency tests remain unchanged and pass.

## 8. New automated coverage and synthetic sanity checks

`Stage3DResourceTests.cs` adds **22 backend test cases**:

- 235 synthetic customer/vehicle/appointment/worksheet/inventory records in private disposable SQLite databases; default/max caps, count headers, stable boundaries, all expected IDs across pages, empty excess page and invalid paging across collections.
- Searches by phone/email, Hungarian case, vehicle owner, worksheet date/status/vehicle, inventory stock/exact part code; combined paging; query-length/enum/date rejection; injection-like text remains literal.
- Valid, reversed, missing-bound, extreme and excessive appointment ranges; overlap retention and empty windows.
- Full-dataset dashboard counts, bounded panels, explicit local-day UTC boundary behavior, and a dedicated backend regression for inspection thresholds (expired, today, day 30, day 31, missing) and stock thresholds (negative legacy stock, 0, 1, 4, 5). This retains direct rule coverage after moving aggregation out of React.
- Declared and unknown-length oversized JSON returns 413 without persistence; valid 500-line detail succeeds; 501-line replacement/direct append rejected; 20-line preview with full count/total and complete by-ID data.
- Finite collection/upload/worksheet write rates; authentication and account use remain independent of rate rejection.
- No-queue upload lock; normalized image cap; bounded file accounting; byte quota/replacement allowance; account-owned image cleanup preserving unrelated files.
- 150 additional synthetic accounts and 60 vehicle-specific history rows verify the same caps across every main paged collection and the by-vehicle route; user JSON does not expose hashes, session versions or normalized login fields.

The three 100-item customer page requests return every one of the 235 IDs exactly once in order. Each response stays below 100000 UTF-8 bytes in the fixture. SQL logs show `LIMIT`/`OFFSET`; total database commands for those three authenticated requests are constrained to **6–12**, including authentication queries/counts. This is a modest sanity check, not a load benchmark or performance certification.

`stage3d.spec.ts` adds **four Chromium tests**:

1. 65 real API-created synthetic customers exercise 50/15 page boundaries, off-page editing, cache invalidation and search reset.
2. 55 vehicles and 55 inventory parts exercise lookup search beyond page 1, saved by-ID worksheet context and customer selection.
3. A historical 2020 appointment exercises direct calendar date URLs, bounded requests and back navigation.
4. Resource tests exercise canonical pending sharing, total/page metadata, active-page invalidation, session isolation and eviction after more than 64 query variants.

Browser servers provision their own test administrator and use disposable databases/upload roots. They do not use the workshop database. Existing printing, zero settings, concurrency, role/history, session, JWT, CSP and upload assertions are retained.

## 9. Existing test changes

No existing backend test source was changed. Four existing browser files were adapted to the supported API contract:

| File | Exact reason |
| --- | --- |
| `Frontend/tests/login.spec.ts` | Wait for aggregate dashboard instead of removed full appointment preload; inspect calendar range parameters; create an independent customer/vehicle fixture so the daily workflow does not depend on a different test running first. |
| `Frontend/tests/stage22.spec.ts` | Expected request counts now reflect one dashboard summary and deferred collection loads; pending sharing, affected-only invalidation, mutation failure, stale-response and logout isolation assertions remain. |
| `Frontend/tests/stage24.spec.ts` | Legacy-invalid-stock mock matches the collection pathname with paging/search parameters, preserving boundary and failed-save assertions. |
| `Frontend/tests/stage27.spec.ts` | Dashboard fixtures/error/retry mock the new summary endpoint; worksheet fixture honors the server status filter. Existing metric boundaries, navigation and error semantics remain asserted. |

Assertions were not weakened to accommodate a failure. Prior integration fixtures that merely depended on eager whole-table loading were updated; actual loading regressions were fixed in application code.

## 10. Final regression results

| Required check | Result |
| --- | --- |
| `dotnet restore` test project and referenced backend | PASS, up to date |
| `dotnet build --no-restore` | PASS, zero errors |
| Complete backend tests | **PASS — 151 passed, 0 failed, 0 skipped**; final full run rebuilt after adding dashboard boundary assertions |
| Migration/model consistency | **PASS**, included unchanged Stage 2B migration upgrade/data-preservation/duplicate rejection and `HasPendingModelChanges` check |
| Frontend `npm ci` | PASS, locked dependencies installed |
| Strict `npm run typecheck` | PASS |
| `npm run build` | PASS, TypeScript and Vite production bundle |
| Complete Chromium suite | **PASS — 82 passed, 0 failed, no retries (3.5 minutes)** |
| `git diff --check` | **PASS**, no whitespace errors; new-file whitespace checked separately |

Commands used portable existing .NET 10 SDK 10.0.403/runtime 10.0.14 and Node 24.22.2/npm 11.19.1 tools outside the repository. No dependency versions or lockfiles were changed.

## 11. Changed files

Modified backend files (11), under `Backend/CarServiceShop/CarServiceShop/`:

- `Controllers/AppointmentsController.cs`
- `Controllers/AuthController.cs`
- `Controllers/CustomersController.cs`
- `Controllers/JobPartsController.cs`
- `Controllers/PartsController.cs`
- `Controllers/ServiceJobsController.cs`
- `Controllers/UsersController.cs`
- `Controllers/VehicleController.cs`
- `Data/ApplicationDbContext.cs`
- `Program.cs`
- `Security/ProfileImages.cs`

New backend/test files (4):

- `Backend/CarServiceShop/CarServiceShop/Controllers/DashboardController.cs`
- `Backend/CarServiceShop/CarServiceShop/Requests/CollectionQuery.cs`
- `Backend/CarServiceShop/CarServiceShop/Security/RequestBounds.cs`
- `Backend/CarServiceShop/CarServiceShop.Tests/Stage3DResourceTests.cs`

Modified frontend files (30), under `Frontend/`:

- `nginx.conf`
- `src/api/appointments.ts`
- `src/api/changes.ts`
- `src/api/customers.ts`
- `src/api/inventory.ts`
- `src/api/users.ts`
- `src/api/vehicles.ts`
- `src/api/worksheets.ts`
- `src/components/Pages/Customers.tsx`
- `src/components/Pages/Garage.tsx`
- `src/components/Pages/Inventory.tsx`
- `src/components/Pages/MainDashboard.tsx`
- `src/components/Pages/UserManagement.tsx`
- `src/components/Pages/VehicleDetails.tsx`
- `src/components/modals/AddVehicleModal.tsx`
- `src/components/modals/AppointmentModal.tsx`
- `src/components/modals/EventDetailModal.tsx`
- `src/data/WorkshopDataProvider.tsx`
- `src/data/workshopStore.ts`
- `src/features/calendar/CalendarPage.tsx`
- `src/features/worksheets/PartsEditor.tsx`
- `src/features/worksheets/WorksheetList.tsx`
- `src/features/worksheets/WorksheetRoute.tsx`
- `src/features/worksheets/WorksheetWorkspace.tsx`
- `src/features/worksheets/model.ts`
- `src/types/domain.ts`
- `tests/login.spec.ts`
- `tests/stage22.spec.ts`
- `tests/stage24.spec.ts`
- `tests/stage27.spec.ts`

New frontend files (4), under `Frontend/`:

- `src/api/query.ts`
- `src/data/paging.tsx`
- `src/types/queries.ts`
- `tests/stage3d.spec.ts`

New documentation (2): this report and `UPLOAD_STORAGE_MAINTENANCE.md`.

No tracked source files removed. Total intended change: **41 modified, 10 new files**. Seven temporary Stage 3D patch/helper scripts were removed from the external `.stage3d-tools` directory, then its empty directory was removed. The final run's two disposable browser database/upload/build-copy directories were removed after the servers exited, using verified absolute paths inside `Frontend/.playwright-data`. Older validation artifacts were preserved. Generated build output, the HTML test report and review screenshots are ignored; no temporary helper/tooling file appears in the source change list. No real database/upload file was deleted or changed.

## 12. Warnings and limits

- Existing backend warning **CS8618** on `User.Role` remains. Build succeeds; unrelated model cleanup was not included.
- `npm ci` reports deprecated ESLint 9 and six moderate development-chain advisory entries: direct development tools `eslint` and `eslint-plugin-react-refresh`, plus transitive `minimatch`, `@eslint/config-array`, `@eslint/eslintrc`, and `@eslint-community/eslint-utils`. They trace to [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), involving attacker-supplied glob patterns. This application's API does not invoke the linter on user input. `npm audit --omit=dev --json` reports **zero production findings**. No dependency fix/force upgrade was applied in SEC-009.
- npm also reports an existing esbuild install-script approval notice. Production bundling succeeds. Browser tooling emits the existing `NO_COLOR`/`FORCE_COLOR` notice. Neither is a failed regression assertion.
- Git reports LF/CRLF conversion notices for existing repository settings. The pre-existing literal `{` ignore entry can confuse ripgrep's Git-ignore parser; source inspection used `--no-ignore-vcs`. Ignore policy was not changed in this stage.
- Offset pages have deterministic ordering for a fixed dataset; concurrent inserts/deletes may move page boundaries. There is no cross-request snapshot or cursor design. Counts and page reads can also observe concurrent changes; normal reload/paging is the recovery.
- Substring searches/aggregate counts can scan SQLite rows. Bounded output, reduced graphs, cancellation and narrow rate/concurrency limits reduce abuse, but do not guarantee constant database work or protect against every slow query on arbitrarily large data. Existing by-ID saved worksheet detail remains complete; legacy data with more than 500 historical lines is not truncated or repaired here.
- Limits/rate counters are per application process and reset on restart. Multi-instance deployment would need coordinated limits/storage accounting. There is no distributed quota service, global account/business-record quota, network DDoS defense, filesystem free-space reserve, or performance certification.
- Managed byte quota excludes unknown filenames. Cleanup failures, interrupted operations or cross-operation races can leave candidate orphans. The maintenance guide requires reference/ownership review; no claim is made that every historical orphan is removed automatically.
- Nginx/Docker runtime behavior remains unverified locally; backend limits and browser Development/Production hosting are tested directly. This scoped gate does not certify a deployed infrastructure.

## 13. Scope and gate

**SEC-018 remains explicitly deferred.** No business/security audit trail, later stage, production monitoring, provider migration, deployment, real domain or HTTPS certificate work was started. No commit/push was made.

**Security Stage 3D scoped gate: PASS.** All required regression checks passed: 151 backend tests, 82 Chromium tests, restore/build, migration/model consistency, clean frontend install, strict TypeScript, production bundle and whitespace checks. The documented development-dependency warnings and unverified Nginx/container runtime check remain visible limitations, not hidden claims of deployment readiness. Work stops at Stage 3D.
