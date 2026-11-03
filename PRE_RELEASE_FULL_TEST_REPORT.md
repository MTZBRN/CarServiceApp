# Pre-release regression and business workflow validation

Date **2026-11-03**, Europe/Budapest. Baseline **`805396725efcdf96f4a8db13626b9fd27fbc3ebc`**. The initial working tree and index were clean. This commit includes the print modal and CSS corrections, the four PDF tests and the print report. All tests use the committed application with disposable databases and uploads.

The architecture is a React/Vite SPA served by Nginx in Compose, an ASP.NET Core 10 API with EF Core and SQLite, and persisted upload files. The inspection covered the test configuration, production architecture and runbooks, final security re-audit, Stage 4A report, lookup refactor and print report.

## Automated results

| Check | Result |
| --- | --- |
| Solution and explicit xUnit project restore | PASS |
| Backend build | PASS, 0 errors, existing `User.Role` CS8618 warning |
| Complete xUnit integration project | **171 passed, 0 failed, 0 skipped** |
| EF migration/model consistency | PASS. Upgrade tests preserved representative records and asserted `HasPendingModelChanges() == false` |
| Frontend `npm ci` | PASS, 228 packages installed from the lockfile |
| Strict TypeScript and production build | PASS, `npm run build` ran `tsc --noEmit` before Vite |
| Complete Chromium, retries 0 | **94 passed, 0 failed, 0 skipped** in 4.2 minutes |
| Focused PDF and supplemental probes, retries 0 | **7 passed, 0 failed, 0 skipped** in 1.1 minutes. Four PDF cases and three additional probes |
| Stage 4A storage and staging guards | **19 passed, 0 failed, 1 skipped**. Windows symlink privilege accounts for the skip |
| Static Compose checks | PASS |
| `git diff --check` | PASS |

The solution contains the application project. The xUnit count comes from running `CarServiceShop.Tests.csproj` explicitly. The PDF cases used the bundled Python with `pypdf` via `WORKSHEET_PDF_PYTHON`. The full run used the repository's disposable Development and Production test servers. The temporary supplemental test harness was removed from the repository after execution and retained with the evidence outside the checkout. The initial tree was clean and the final tree contains only this new report. [Backend TRX](C:/CarServiceApp/pre-release-results/pre-release.trx) · [Supplemental probe source](C:/CarServiceApp/pre-release-results/pre-release-probe.spec.ts)

## Business workflows

| Area | Verified behavior and coverage |
| --- | --- |
| Customers | Create, edit, search by customer data, save failure retention, validation, ownership associations and guarded deletion. Chromium full workflow and stage24, plus backend DTO/integrity tests. |
| Vehicles | Create for an existing customer, select by search, inspection filter, details and service history. Chromium full workflow, stage24 and stage3d. |
| Appointments | Create/edit/delete, failed save retention, duplicate submission protection, calendar URL and date navigation, exact timestamps, customer filter and vehicle selection, linked vehicle lock, historical worksheet retention. Chromium login, stage25–27 and searchable lookup tests, plus backend workflow/relationship tests. |
| Worksheets | Create/edit/save, manual and inventory part lines, labor and totals, print, complete/reopen, stale version rejection, unsaved drafts, linked appointment behavior and history preservation. Chromium stage26–27, stage2b and PDF tests, plus backend aggregate and atomic update tests. |
| Inventory | Create, edit, search, pricing and stock boundaries, catalog lookup, manual catalog creation, and unchanged stock after saving worksheet lines. Chromium stage24, stage26 and lookup tests. |
| Administration | Login, session restoration, password change, logout and token revocation, admin/mechanic restrictions, user management, settings and audit filtering. Chromium login/routing, stage27, stage2a and stage3e, plus xUnit security and audit tests. |

## Searchable lookup

The five migrated controls are the worksheet vehicle picker, worksheet inventory picker, vehicle creation customer picker, appointment customer filter and appointment vehicle picker. Existing tests exercised selection through each control, copying part snapshots, retaining selected values, backend search beyond the first page and the appointment filter's customer parameter. The suite also exercised one-page-at-a-time **További találatok**, page reset on search, delayed and obsolete responses, loading and empty results, ArrowDown/ArrowUp/Enter/Escape/Tab, 390 px layout and the populated menu boundary above the appointment Save button. The supplemental lookup probe returned a deliberate 503 on the first customer phone query, displayed the error, retried successfully and retained the selected customer.

## Calendar

The two rows are separately labelled `Időpontok lapozása` for appointments and `Műszaki emlékeztetők lapozása` for inspection reminders. Each uses a 100-record page and its own page state. Both appear when there is only one page because the calendar renders both shared `Pager` instances unconditionally. A real fixture with one appointment and one reminder reproduced both redundant disabled pagers. After adding records to reach 101 in each collection, page one showed 100 and page two showed one for each source. Switching the appointment page preserved the reminder page. Advancing the agenda period reset both pagers and removed all old events. API queries carried their respective bounded date filters and `pageSize=100`. The built-in calendar tests also passed navigation/history and responsive booking/reminder semantics.

## Actual Chromium PDFs

| Worksheet fixture | Actual A4 pages | Verified total |
| --- | ---: | ---: |
| One part and labor | **1** | 773 Ft |
| Three parts and labor | **1** | 1,321 Ft |
| 80 edited work-description lines, three parts and labor | **3** | 1,321 Ft |
| 75 parts and labor | **3** | 21,049 Ft |

The tests captured the real print iframe with live preview values, generated Chromium PDFs at scale 1 with CSS page size and `displayHeaderFooter: false`, then checked page dimensions, content and counts with `pypdf`. I inspected all eight rendered pages from this run. Both short pages have complete handover borders. The multi-page output retains the 80 description lines, 75 part rows, repeated table headings, grouped totals and intact signature blocks. The editable customer and fuel values appear in the PDF. The approved headings, fields, section order and form styling remain recognizable in the rendered sheets. Browser print preferences and physical printer behavior remain a manual check. [Three-part sample rendering](C:/CarServiceApp/pre-release-results/pdf/three-parts-1.png) · [Many-parts final page](C:/CarServiceApp/pre-release-results/pdf/many-parts-3.png)

## Security regression and fresh dependency scans

Passed JWT key, signature, expiry, issuer/audience and algorithm tests, stale or missing SessionVersion rejection, password/logout revocation and role checks. Completed worksheet permissions, final-admin protection, DTO validation, malicious nested data and destructive relationship guards passed. Upload tests exercised malformed, oversized and active content rejection, canonical raster handling, cleanup and limits. Resource tests exercised invalid paging, bounded query/body/upload limits and aggregate worksheet bounds. Audit tests covered authorization, atomicity, allowlisted metadata and privacy. Production CSP and print iframe, trusted proxy handling, CORS rules, security response headers and Production Seed exclusion passed their local integration tests.

| Scan | Result |
| --- | --- |
| NuGet application graph, including transitives | 0 reported advisories |
| NuGet test graph, including transitives | 0 reported advisories |
| npm full locked graph | 6 moderate affected package entries in one dev-tool dependency chain, 0 high, 0 critical |
| npm production-only locked graph | 0 reported findings |

The npm chain is `minimatch`, `eslint`, `@eslint-community/eslint-utils`, `@eslint/config-array`, `@eslint/eslintrc` and `eslint-plugin-react-refresh`. The scanner returned one underlying minimatch denial-of-service advisory and no compatible automatic fix in the audited graph. Container OS and runtime-image CVEs require a scan of the actual built images. [Full npm audit JSON](C:/CarServiceApp/pre-release-npm.json) · [Production npm audit JSON](C:/CarServiceApp/pre-release-npm-prod.json) · [NuGet application JSON](C:/CarServiceApp/pre-release-nuget.json) · [NuGet test JSON](C:/CarServiceApp/pre-release-nuget-tests.json) · [Minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## Release configuration review

- All three Dockerfiles and their build contexts were reviewed. The Compose pair uses ASP.NET runtime UID/GID 1654 and Nginx UID/GID 101, application healthchecks, read-only roots, dropped capabilities, no-new-privileges, bounded tmpfs and CPU/memory/PID limits. The backend is private and frontend publication binds to host loopback.
- The backend uses explicit persistent binds for `/app/data/app.db` and `/app/uploads`. The runbook places the real host directories under `/opt/carserviceapp` with 1654 ownership. `create_host_path: false` requires prepared host paths. The production environment example contains placeholders, `.env.production` is ignored and Compose requires externally supplied JWT key, issuer and audience. Initial admin provisioning remains an explicit one-off operation.
- Nginx serves the SPA with its security-header include and proxies API/upload routes to the private backend. The API has separate upload and regular body bounds. The frontend trusts its inner request scheme and peer for forwarding today, which needs the documented edge adaptation before public operation.
- Backup/restore wrappers and the Python implementation were reviewed. The procedure pairs a quiesced SQLite backup with uploads, checks source stability and verifies manifest, checksums, database integrity and safe extraction into a fresh isolated directory. The synthetic storage tests passed within the stated Windows skip. The production offsite restore and scheduling drill are operational checks.
- The static Compose assertion script passed. Docker is unavailable on this workstation. Container startup, effective runtime hardening, real Nginx config validation, image scanning and VPS operation remain unverified.

## Responsive validation

The full Chromium suite exercised layout and keyboard checks at 1440, 1024, 900, 768 and 390 px where applicable. The supplemental smoke loaded dashboard, calendar, customers, vehicles and vehicle details, worksheet editor, inventory and audit at 1440, 768 and 390 px. All 24 route/width combinations matched the viewport's document width. The print and close controls were reachable at all three sizes. At 390 px, the preview pane measured 338 px wide with 421 px of scrollable width. At `scrollLeft=0` the sheet's left edge was 63 px outside the pane. The desktop and tablet probes reached both edges. [Mobile preview evidence](C:/CarServiceApp/pre-release-results/print-preview-390.png)

## Findings

| ID | Severity | Reproduction and affected area | Expected and actual | Recommended fix | Production blocker |
| --- | --- | --- | --- | --- | --- |
| REL-001 | BLOCKER | Compare the planned host TLS edge in `TLS_INGRESS_PLAN.md` with the proxy headers in `Frontend/nginx.conf`. The inner hop receives HTTP from the edge. | The API should receive verified HTTPS scheme and original client IP. Current Nginx sends its inner `$scheme` and `$remote_addr`, which loses those edge values and can collapse source-based login throttling. | Implement the documented verified immediate-peer forwarding and rehearse spoof resistance, distinct client partitions, HTTPS and HSTS before exposure. | **Yes, for public go-live.** |
| REL-002 | LOW | Open a calendar range with at most 100 appointments and reminders. Both pagers render below the calendar in `CalendarPage.tsx` and `paging.tsx`. | Single-page collections should omit navigation. Both rows show page 1 of 1 with disabled controls. | Render each calendar pager only when its loaded collection has more than one page. Preserve range reset and independent paging. | No |
| REL-003 | LOW | Run `npm audit --json` against the frontend lockfile. | A clean full scan is preferable. The current full scan returns the six moderate dev-chain entries above. | Review a compatible lint-toolchain update separately and repeat the locked scans. | No, based on the clean production-only graph |
| REL-004 | MEDIUM | At 390 × 900, open a saved worksheet and its print preview. Scroll horizontally to the leftmost position. Affected component is `WorkSheetPrintModal.tsx`. | The entire sheet should be reachable by scrolling. Its centered sheet extends 63 px left of the scroll origin, clipping the left part of the form. The Print and Close controls remain reachable. | In a targeted UI fix, left-align the oversized sheet within a horizontal scroll surface or otherwise keep both edges reachable. Retest 390 px preview editing and the actual PDFs. | No for desktop printing. Address before relying on mobile preview editing. |
| REL-005 | LOW | Run `dotnet test` from the solution directory without selecting the test project. | A full-regression command should execute the test assembly. The current solution-only invocation returned success after the application build and executed zero tests. | Have CI and runbooks invoke `CarServiceShop.Tests.csproj` explicitly, or include it in the solution in a harness-only change. | No. The explicit invocation passed 171 tests. |

## Remaining release checks

Run the disposable Linux Compose rehearsal and scan both built image IDs. Verify effective UID/GID and binds, read-only root filesystems, health checks, persistence after restart, production admin provisioning and migration against an isolated copy. Prove encrypted offsite backup retrieval and paired restore. Confirm the real edge forwarding, firewall, certificate renewal, HSTS, alerts and production smoke with synthetic records. Check the physical worksheet printer at A4 portrait, scale 100%, 10 mm margins and browser headers/footers disabled.

**Release readiness verdict: FAIL for public production go-live.** The application passed the local regression gate. The documented TLS edge and client-IP forwarding gap is a confirmed deployment blocker. Container execution and image scanning, Linux persistence and permissions, offsite restore and the live ingress acceptance checks remain required evidence. The RackForest VPS was outside the execution scope.
