# Stage 2.4 — Customers, Vehicles and Inventory

Implementation complete. Stage 2.5 and later work has not started. Changes are uncommitted for review.

## Visual changes

Customers, vehicles, vehicle detail and inventory now use the Stage 2.3 tokens, surfaces, controls and tables. AppShell's existing PageHeader remains the single page title. Toolbars provide search, counts and primary actions. Desktop tables have restrained borders and compact actions; narrower laptop/tablet tables scroll inside their own region. At 680px and below, rows become labelled records with visible actions. All four screens were checked at 1440, 1024, 768 and 390px with no document-level horizontal overflow.

Vehicle registration is prominent. Explicit inspection badges distinguish Érvényes, Hamarosan lejár, Lejárt, missing and invalid dates. Vehicle detail separates summary, owner, inspection, upcoming appointments and service history. History shows date, description, parts, totals, completion labels, edit/open, print and delete actions.

## Functional changes

- Customers: search name, phone or email; result count; vehicle counts derived from successfully loaded shared vehicle data; customer details dialog with linked vehicles; create, edit and confirmed deletion. No unsupported customer detail route was added.
- Vehicles: search registration/make/model/owner; inspection filter; create with existing or new customer; direct detail routes remain unchanged. No vehicle editing was introduced because the backend has no update contract. Appointment and worksheet actions reuse the existing dialogs.
- Inventory: search part number/name; derived stock summary; explicit negative/invalid, zero, 1–4 and 5+ states. Negative prices are shown as Adathiba with the original value, rather than hidden or clamped. Stored net and gross prices are displayed and edited independently; historical prices are not recomputed using an assumed VAT rate. The UI explains that worksheet usage does not decrement stock.
- Forms use Hungarian associated labels, required markers, inline validation, initial focus, saving feedback, submission locks and retained values on failures. Owner loading has retry support. After an inline customer is created, a failed vehicle save can be retried without creating that customer again.
- Destructive operations use ConfirmDialog. Backend errors remain visible in the open confirmation and success is shown only after an accepted mutation. Target identity is included in the confirmation. Pending actions cannot submit twice.
- Lists expose loading, retryable error, empty-data and no-search-results states. Existing resource data remains available when a refresh fails.

## Architecture and reused components

Stage 2.2 resource APIs, domain/request types, WorkshopDataProvider and invalidation rules are unchanged. Lists and history use shared resources. Vehicle history now filters shared worksheets by vehicleId instead of maintaining a separate history cache. The existing direct vehicle loader is retained for route-level missing-record behavior and refresh.

Reused: AppShell/PageHeader, Table, Card, Badge, FormField, Input, Select, Button, Modal, ConfirmDialog, LoadingState, EmptyState, ErrorState, ToastProvider. Native selects in the migrated forms replace the old custom dropdown interface. Existing appointment, worksheet editor and print components are reused without modifying them.

New feature-local helpers: Toolbar, NewButton, ListState, useRemoval, date/currency/inspection/stock presentation helpers, and PartForm. Their CSS is scoped to records features in features/records/records.css. No new library or framework was added.

## Backend and scope

No backend source, schema or API contract changes were needed. Existing customer/vehicle deletion restrictions remain enforced by the server. No vehicle update or worksheet-list route was invented.

No changes to Dashboard, Calendar, WorksheetModal, the print document, Settings, UserManagement, Login, application shell, authentication, API modules or shared data implementation. No production/security work was performed.

## Validation

- Strict TypeScript: passed (npm run build invokes npm run typecheck with the strict app configuration).
- Production build: passed; JavaScript approximately 650 kB uncompressed, CSS approximately 44 kB.
- Backend tests: 8 passed (dotnet test --no-restore).
- Complete Chromium suite: 39 passed — 33 prior regressions plus 6 focused Stage 2.4 tests.
- git diff --check: passed.
- Source scan: no direct Axios calls, fetch, API URL construction or unnecessary any types introduced into the migrated features.

Coverage includes customer create/edit/delete, name/email search and retained failed saves; customer deletion restrictions; vehicle creation/search/inspection filtering, owner data, direct URL refresh, history, successful and restricted deletion; inventory create/edit/delete, failed mutation retry and stock boundaries -1/0/1/4/5; owner-load retry and duplicate vehicle submission; responsive layouts; Stage 2.2 refresh/session races; shell, permissions, login/logout, browser history and print isolation; the complete Stage 1 workflow.

Existing tests were adapted to table rows, native selects, current Hungarian action labels and the single shell heading. Business assertions were retained. The Stage 2.4 source is versionable inside Frontend/tests; an external loader follows the existing test arrangement.

A repeated run on an already-populated validation database exposed the known legacy calendar slot-click sensitivity when test bookings fill its target day. Final verification used a fresh temporary database; calendar code was not changed. Existing application data was not used.

## Remaining legacy styling and warnings

- Only the requested feature areas and their forms were migrated. Dashboard, calendar, worksheet editor/print, settings, users and login retain their existing styling. The shared legacy stylesheet remains for those consumers; no broad stylesheet cleanup was attempted.
- Vite's existing >500 kB bundle warning remains. No code-splitting or production work was added.
- Existing backend warnings remain: User.Role initialization, migration PRAGMA transactions, HTTPS redirect port and unordered First/FirstOrDefault.
- Playwright's NO_COLOR/FORCE_COLOR environment warning remains. Local validation requires the installed browser cache and execution permissions in this environment.
- Original browser suites/config still live outside the nested Git repository. Test consolidation remains deferred.
- Price fields intentionally remain independent authoritative stored values; no new VAT accounting rule or automatic inventory consumption is implied.
- The validation servers started for this task are stopped after verification.

## Visually reviewed screenshots

- C:/CarServiceApp/stage24-artifacts/customers-1440.png
- C:/CarServiceApp/stage24-artifacts/vehicles-1440.png
- C:/CarServiceApp/stage24-artifacts/vehicle-detail-1440.png
- C:/CarServiceApp/stage24-artifacts/inventory-1440.png
- C:/CarServiceApp/stage24-artifacts/inventory-390.png

## Complete file manifest

### Modified (8)

- Frontend/src/components/Pages/Customers.tsx
- Frontend/src/components/Pages/Garage.tsx
- Frontend/src/components/Pages/Inventory.tsx
- Frontend/src/components/Pages/VehicleDetails.tsx
- Frontend/src/components/modals/AddVehicleModal.tsx
- Frontend/src/components/modals/CustomerModal.tsx
- Frontend/tests/stage22.spec.ts
- Frontend/tests/stage23.spec.ts

### New (5)

- Frontend/src/features/records/PartForm.tsx
- Frontend/src/features/records/records.css
- Frontend/src/features/records/shared.tsx
- Frontend/tests/stage24.spec.ts
- STAGE_2_4_REPORT.md

### Removed (0)


### Outside the nested repository

- Modified selectors: C:/CarServiceApp/tests/full-workflow.spec.ts, tests/routing.spec.ts, tests/stage1.spec.ts
- New loader: C:/CarServiceApp/tests/stage24.spec.ts
- Screenshot artifacts: C:/CarServiceApp/stage24-artifacts/
