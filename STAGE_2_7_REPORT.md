# Stage 2.7 — Dashboard, Settings and Final Integration

**COMPLETE — verified 29 October 2026.** Chromium: **74/74 passed**, no retries or skips. Backend: **11/11 passed**. Strict TypeScript and production build passed. Stage 1–2.6 behavior is covered by the preserved 59 browser cases; Stage 2.7 adds 15 cases.

Work continued from the existing uncommitted Stage 2.7 tree in this repository. No backend source, API contract, migration, infrastructure or deployment change was made. Changes are staged for review; no commit was created.

## 1. Dashboard

The operational dashboard uses WorkshopDataProvider resources and the shared Stage 2.3 Card, Button, Badge, Input, LoadingState, ErrorState and confirmation system.

- **Mai időpontok:** appointments starting on the current local calendar day, matching the calendar's date interpretation. The date is checked every minute so a long-running workday view advances at midnight.
- **Aktív munkalapok:** all worksheets whose isCompleted is false.
- **Befejezett munkák:** all completed worksheets; explicitly labelled as an all-time total.
- **Közelgő műszaki vizsgák:** inspections due today through 30 calendar days ahead. Expired inspections are separately visible in the warning panel.
- **Alacsony készlet:** parts with valid integer stock from 0 through 4, consistent with the existing inventory boundary. Invalid stock is not counted as low stock.

Operational panels show today's appointments and their existing/new worksheet action, oldest active worksheet dates first, expired/upcoming inspections, low stock, and the latest worksheet dates. The latter explicitly describes worksheet date, rather than claiming a modification timestamp that the model does not contain. Registration numbers lead each vehicle/worksheet entry. Vehicle search, quick vehicle creation, detail navigation and confirmed deletion remain available.

Worksheet summary links open existing open/completed URL filters; calendar links open today's agenda. Vehicle and stock cards link to their existing lists. Secondary lists show up to six entries with links to the complete page. No stock consumption, revenue, capacity or invented update-time metric was added.

## 2. Settings

Separate sections now present:

- Personal account identity and role, existing profile-image upload/preview, and password change with confirmation.
- Company/print identity: company name, address, tax number, phone and email.
- Existing hourly-rate and VAT defaults.

The settings route remains admin-only, matching Stage 2.1. Company writes retain the existing backend admin restriction. Mechanic access rules were not expanded. Name/role are shown as read-only because no supported profile-edit API exists.

Forms use labelled shared controls, inline validation, independent pending states, synchronous submit locks and success toasts only after accepted responses. Failed writes retain inputs. Company refreshes do not overwrite an in-progress draft. Zero hourly rate and zero VAT are preserved and survive refresh. Profile updates refresh the existing sidebar display and remain visible after reload. Password fields clear only after success.

## 3. User management

The admin-only user list uses the shared table, cards, badges and state views. Roles have explicit Hungarian labels: **Rendszergazda** and **Szerelő**, with an explicit unknown-role fallback.

The create dialog validates required fields and supported roles, locks pending submission, retains failures and refreshes the server list after success. Delete uses ConfirmDialog, preserves a failed confirmation with the server error, and refreshes only after an accepted deletion. The last administrator's delete action is disabled in the UI; the existing server rejection is also verified. No user-editing capability was introduced.

## 4. Login

Login uses the same tokens, card, controls, buttons, spacing and focus treatment as the shell. It retains the workshop identity without decorative images. Username/current-password autocomplete, associated visible labels, initial username focus, keyboard submission, pending state and useful authentication errors are present. A synchronous lock prevents duplicate submissions.

AuthProvider, session validation, invalidation, protected return destinations and logout contracts remain intact.

## 5. UI consistency and development tools

Dashboard, Calendar, Customers, Vehicles, vehicle detail, Worksheets, Inventory, Users, Settings and Login were checked together.

The legacy print action now uses shared button styling. Active shared dialog positioning and toast styles were retained in a small overlays stylesheet. Duplicate dashboard destination labels were clarified so operational links can be distinguished from sidebar navigation.

Development tools remain under the smaller admin-only navigation action, separately lazy-loaded. Their page now uses shared controls, state views, toasts and confirmations instead of browser alerts/confirms. Existing seed and deletion authorization was preserved. Entering development tools also honors worksheet unsaved-change protection.

## 6. Verified legacy removal

A relative-import graph and repository searches found no remaining source/test consumers of these removed files:

| Removed file | Reason |
| --- | --- |
| Frontend/src/api/api.ts | Unused transport compatibility alias |
| Frontend/src/api/apiService.ts | Remaining live development actions moved to existing typed resource APIs |
| Frontend/src/components/Sidebar.tsx | Unused alias; the live layout/Sidebar remains |
| Frontend/src/components/modals/VehicleHistoryModal.tsx | Superseded by routed vehicle detail and worksheet history |
| Frontend/src/components/ui/FormElements.tsx | No consumers after Settings migration; shared Fields and native Select remain |
| Frontend/src/hooks/useCarService.ts | Old dashboard prop adapter no longer needed |
| Frontend/src/styles/legacy-features.css | Dead page/card/input/dropdown rules; live overlay/toast rules moved to overlays.css |

Unused custom-dropdown CSS, legacy field/icon wrappers, and the unavailable-navigation rule were also removed after searching for consumers. The final import-graph check reports only the expected main.tsx and vite-env.d.ts entry points without incoming references.

The worksheet routing, workspace, navigation protection, print document and print CSS remain in place. No old worksheet modal was reintroduced.

## 7. Bundle/performance findings

| Initial JavaScript | Before Stage 2.7 | Final |
| --- | ---: | ---: |
| Minified | 659.94 kB | **356.40 kB** |
| Gzip | 211.86 kB | **117.65 kB** |

The initial payload decreased by about 46% minified / 44% gzip. The Vite >500 kB warning is **absent**. This does not claim an equivalent reduction in total application code: feature code is loaded when needed.

Major authenticated routes use React lazy/Suspense and a shared LoadingState. A route error boundary provides reload recovery. No optimization dependency or custom chunk-size-warning suppression was added.

Module-contribution analysis identifies React DOM, React Router and Axios as the largest initial dependencies. The calendar's deferred dependency tree includes React Big Calendar, Lodash and Popper. Worksheet/print UI and react-to-print are deferred with the worksheet route. The JSON analysis uses Rollup's pre-minification rendered module lengths for relative attribution; these are not additive minified byte measurements.

Final generated JavaScript chunks, in kB / gzip kB:

| Chunk | Minified | Gzip |
| --- | ---: | ---: |
| CalendarPage | 187.78 | 61.89 |
| WorksheetRoute | 40.42 | 13.07 |
| AppointmentModal | 23.79 | 7.45 |
| MainDashboard | 7.65 | 2.49 |
| Settings | 6.74 | 2.49 |
| VehicleDetailsRoute | 4.79 | 1.85 |
| UserManagement | 4.70 | 2.03 |
| Inventory | 4.38 | 1.80 |
| Customers | 4.06 | 1.83 |
| AddVehicleModal | 3.47 | 1.62 |
| WorksheetList | 3.30 | 1.36 |
| shared | 3.01 | 1.54 |
| Garage | 2.44 | 1.12 |
| Dashboard (development tools) | 2.44 | 1.15 |
| worksheets (shared model) | 1.34 | 0.64 |
| differenceInCalendarDays | 0.76 | 0.43 |
| Table | 0.33 | 0.24 |

Initial CSS is 17.50 kB / 4.23 kB gzip; calendar, records, appointment and worksheet CSS are emitted separately.

## 8. Playwright/test consolidation

Frontend now contains the complete suite, Playwright dependency/lockfile, configuration and backend launcher. The formerly external login/routing tests were copied into tests/. The existing full-workflow and Stage 1–2.6 tests are used directly.

All screenshot paths are repository-relative. No parent test directory, parent configuration, external test loader, screenshot folder or Visual Studio checkout is required. Resolution was checked against Frontend/node_modules/@playwright/test. A locked npm ci installation succeeded.

Each run builds the correct sibling backend and starts the compiled application from a newly created Frontend/.playwright-data/run-* directory, with a fresh SQLite validation database, isolated uploads and copied SPA build. Existing servers are **never reused**. Normal development data is not used by the regression suite. This launcher invokes the existing startup/schema initialization; it introduces no migrations.

One worker preserves shared-fixture ordering. Retries are disabled. The original 59 cases remain. The shared-data assertion now expects one inventory/worksheet fetch because the dashboard consumes them; one-fetch reuse, targeted invalidation and stale-response assertions remain. The inventory 401 test starts on Customers so inventory is first requested under its intercept.

From Frontend, after stopping normal servers on 5173/5232:

~~~powershell
npm ci
npx playwright install chromium
npm run typecheck
npm run test:backend
npm run test:e2e
~~~

Frontend/README.md documents prerequisites, normal development, regression commands and artifacts.

## 9. Normal local development verification

The normal backend was launched using this repository's **http launch profile**, with no Playwright environment overrides. It listened on http://localhost:5232 and reported the correct repository content root. The normal Vite frontend on port 5173 completed browser login, restored the /vehicles destination and obtained **HTTP 200 from /api/Auth/me**.

The tracked backend launch profile and frontend API client already agree on port 5232. No machine-specific API workaround or configuration change was necessary; the ignored .env.local file is not required by the existing client. The separate Visual Studio checkout was not used.

The existing local database's login account returns the legacy role string **adminisztrátor**. This does not grant the supported admin role. That existing data was left untouched, and authorization was not broadened. The isolated clean database's supported admin/mechanic paths both pass. Correcting legacy local role data, if desired, remains a separate data-maintenance action.

Only the identified repository development processes were stopped for isolated testing. No unrelated process was terminated.

## 10. Accessibility review

Associated labels, semantic links/buttons, named icon actions, form errors and pending states were reviewed. New forms use FormField, and the shared Input accepts a React 19 ref for the upload control. Roles and work/inspection/stock states have text labels as well as colors.

Browser checks cover login keyboard/autocomplete behavior; visible focus; drawer keyboard containment and Escape; create-user initial focus and restoration; confirmation cancellation; modal background inertness; worksheet/print focus restoration; and reduced-motion preference. Editable controls on the reviewed main pages have labels or explicit accessible names. The existing shared modal/focus system and reduced-motion rule were retained.

This is an obvious-issues frontend review, not a formal WCAG certification or assistive-technology audit.

## 11. Responsive and visual verification

All specified pages were checked at **1440, 1024, 768 and 390 px**. Assertions cover document width and the main scroll region, with no horizontal overflow outside intended internal table/calendar scrollers. Desktop sidebar collapse, mobile drawer, route focus, forms, record tables, calendar and worksheet layouts pass.

Visual inspection covered Dashboard desktop/mobile, Login, Settings desktop/mobile including the company/pricing section, Users desktop/mobile, the Customers shell and the worksheet workspace. Controls, text wrapping and shared spacing remain usable. Desktop tables retain their productive layout; narrow record/user tables use labelled cards.

Screenshots contain disposable regression fixtures, not production workshop data.

## 12. Complete Chromium result

**74 passed, 0 failed, 0 skipped; approximately 2.5 minutes; retries disabled.**

The final run used the documented repository command, npm run test:e2e, including a fresh frontend build and disposable backend. It covers the original 59 cases plus 15 Stage 2.7 cases.

The critical journey passes: login → customer → vehicle → appointment → worksheet → parts/labor → save → complete → reopen → dashboard refresh → print preview/print frame → logout.

Other passing coverage includes invalid and explicitly expired sessions, admin/mechanic restrictions, direct URLs/refresh/back/forward, shared-resource races and mutation refresh, customer CRUD, vehicle workflows, inventory CRUD, calendar date/time/linkage behavior, worksheet list/workspace, saved-data printing, unsaved-change protection, settings, users and responsive navigation.

Initial validation found ambiguous dashboard link selectors and incorrect selectors in the new journey test. Destination wording and test selectors were corrected; no business assertions were removed or weakened.

## 13. Backend test result

**11 passed, 0 failed, 0 skipped.** Existing backend tests were run against unchanged backend source, including appointment/worksheet relationships, history retention and user creation.

## 14. TypeScript/build result

Strict frontend TypeScript checking passed. The final production build passed with Vite 7.3.1. The documented test:e2e command repeated that build successfully. No >500 kB warning remains.

## 15. Git diff review

git diff --check passes. The Stage 2.7 diff was reviewed for removed-code references, session/routing behavior, typed resource use and scope. Backend source, authorization policies, API contracts, schema and migrations are unchanged. Generated builds, screenshots, test output, disposable validation data and SQLite sidecars are ignored.

## 16. Changed, added and removed files

| Change | File |
| --- | --- |
| Modified | .gitignore |
| Modified | Frontend/package-lock.json |
| Modified | Frontend/package.json |
| Added | Frontend/playwright.config.ts |
| Modified | Frontend/README.md |
| Added | Frontend/scripts/start-test-backend.mjs |
| Removed | Frontend/src/api/api.ts |
| Removed | Frontend/src/api/apiService.ts |
| Modified | Frontend/src/App.tsx |
| Modified | Frontend/src/app/router.tsx |
| Modified | Frontend/src/components/layout/AppShell.css |
| Modified | Frontend/src/components/modals/AddUserModal.tsx |
| Removed | Frontend/src/components/modals/VehicleHistoryModal.tsx |
| Modified | Frontend/src/components/Pages/Dashboard.tsx |
| Modified | Frontend/src/components/Pages/Login.tsx |
| Modified | Frontend/src/components/Pages/MainDashboard.tsx |
| Modified | Frontend/src/components/Pages/Settings.tsx |
| Modified | Frontend/src/components/Pages/UserManagement.tsx |
| Modified | Frontend/src/components/print/WorkSheetPrintModal.tsx |
| Removed | Frontend/src/components/Sidebar.tsx |
| Modified | Frontend/src/components/ui/Fields.tsx |
| Removed | Frontend/src/components/ui/FormElements.tsx |
| Removed | Frontend/src/hooks/useCarService.ts |
| Modified | Frontend/src/index.css |
| Added | Frontend/src/styles/final-pages.css |
| Removed | Frontend/src/styles/legacy-features.css |
| Added | Frontend/src/styles/overlays.css |
| Modified | Frontend/src/styles/ui.css |
| Added | Frontend/tests/login.spec.ts |
| Added | Frontend/tests/routing.spec.ts |
| Modified | Frontend/tests/stage22.spec.ts |
| Modified | Frontend/tests/stage23.spec.ts |
| Modified | Frontend/tests/stage24.spec.ts |
| Modified | Frontend/tests/stage25.spec.ts |
| Modified | Frontend/tests/stage26.spec.ts |
| Added | Frontend/tests/stage27.spec.ts |
| Added | STAGE_2_7_REPORT.md |

## 17. Artifact locations

All locations below are relative to the repository root.

- Frontend/playwright-report/index.html — final complete browser report.
- Frontend/review-artifacts/stage27/chromium-run.log — final build and all 74 test results.
- Frontend/review-artifacts/stage27/bundle-analysis.json — module contribution analysis.
- Frontend/test-results/ — Playwright run metadata and failure traces when a case fails.
- Frontend/.playwright-data/run-*/ — isolated validation databases, uploads and SPA copies.

Stage 2.7 screenshots:

- Frontend/review-artifacts/stage27/dashboard-1440.png
- Frontend/review-artifacts/stage27/dashboard-390.png
- Frontend/review-artifacts/stage27/login-desktop.png
- Frontend/review-artifacts/stage27/settings-1440.png
- Frontend/review-artifacts/stage27/settings-390.png
- Frontend/review-artifacts/stage27/settings-company-1440.png
- Frontend/review-artifacts/stage27/settings-company-390.png
- Frontend/review-artifacts/stage27/users-1440.png
- Frontend/review-artifacts/stage27/users-390.png
- Frontend/review-artifacts/stage27/customers-1440.png
- Frontend/review-artifacts/stage27/customers-390.png

The full suite also regenerates the previous stage23–stage26 screenshot folders under Frontend/review-artifacts/. Artifacts are kept outside production assets and are intentionally ignored by Git.

## 18. Remaining warnings

- The backend's pre-existing User.Role non-nullability warning (CS8618) remains; no backend model change was made.
- Playwright emits an environmental NO_COLOR/FORCE_COLOR notice. It does not affect results.
- .NET reports optional workload updates.
- Normal API-only development may log that wwwroot is missing, since Vite serves the UI separately. The test SPA fallback is verified using copied build output.
- Existing legacy local role data is described in section 9. It was not silently changed.
- Git may report Windows line-ending conversion notices; whitespace checks pass.

## 19. Intentionally deferred work and limits

Security hardening, penetration testing, deployment, hosting, HTTPS/domains, database migration, backups, monitoring, invoicing, payments and automatic inventory consumption were not started.

Company settings remain accessible through the existing admin-only route. Unsupported name/role editing is not invented. Dashboard dates represent available appointment/worksheet/inspection data; no last-updated, financial or capacity metric is inferred. Low stock uses the established fixed boundary, not a newly introduced configurable reorder model.

Printing was verified through the saved-data preview and isolated browser print frame; no physical printer was exercised. Chromium is the required verified browser; this does not claim Firefox/WebKit certification.

**Stop point: Stage 2.7. No later-stage work has begun.**
