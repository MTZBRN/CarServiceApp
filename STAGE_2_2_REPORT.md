# Stage 2.2 implementation report

Scope: API, types, and shared business data only. Stage 2.3 and later stages have not started. No backend source, routing definitions, CSS, runtime dependencies, or database schema changes.

## Architecture

- One Axios client owns API origin/base path, bearer headers, session invalidation, cancellation, stale-session response rejection, profile-image URLs, and typed error extraction.
- Resource modules cover auth, customers, vehicles, appointments, worksheets, inventory, users, and settings. Development seeding has a separate module.
- Domain records, create/update payloads, and discriminated booking/inspection calendar events have separate type modules. Persisted worksheet IDs are required. Explicit unnecessary any usage is removed throughout frontend source.
- WorkshopDataProvider owns one session-scoped cache. Resources load when first consumed, share pending requests, and expose data/loading/error/loaded/refresh separately. Navigation reuses cached lists. Failed refreshes retain the last successful records and expose the error for retry.
- The shared resources are customers, vehicles, appointments, worksheets, inventory, and settings. Users remain page-local because they have one admin-only consumer. Individual worksheet detail and vehicle history requests remain local to their editors/pages and use the resource API.
- Successful API mutations explicitly notify typed resource subscribers. Requested affected resources refresh once; unrelated and never-requested resources do not load. Failed mutations do not invalidate data. A successful write remains successful if its subsequent refresh fails; resource error state records that refresh failure.
- Resource revisions prevent an older list response from overwriting a newer mutation refresh. Login/logout/invalid sessions synchronously abort session requests and advance a session generation. The provider discards its entire cache when identity changes. Delayed 200 and 401 responses cannot populate or invalidate the next session.
- Components use resource APIs or the compatibility facade and no longer construct API URLs. The former business-data-updated browser event and redundant success-callback refreshAll calls are removed.
- The add-vehicle/new-customer request now sends phoneNumber, matching the backend contract. Appointment badges reflect the persisted booking model; inspection classification exists on calendar events.

## Mutation refresh rules

Only previously requested shared resources in this table are refreshed.

| Mutation | Resources |
|---|---|
| Create customer | customers |
| Update/delete customer | customers, vehicles, appointments |
| Create vehicle | vehicles |
| Delete vehicle | vehicles, appointments, worksheets |
| Create appointment | appointments |
| Update/delete appointment | appointments, worksheets |
| Create/update/delete worksheet | worksheets, appointments; the open vehicle-history page explicitly reloads its scoped history after save |
| Create/update/delete inventory part | inventory |
| Save company settings | settings, shared by sidebar/settings/print |
| Create/delete user | page-local users list |
| Seed development data | previously requested customers, vehicles, appointments, worksheets, inventory |

## Remaining compatibility code

- Frontend/src/api/api.ts re-exports the central Axios client for compatibility. No component imports it.
- Frontend/src/api/apiService.ts is a typed facade delegating to the resource modules. Existing feature pages can migrate names when their approved feature stages are implemented; it owns no URLs or transport configuration.
- Frontend/src/types.ts re-exports the new type modules to preserve current import paths.
- Frontend/src/hooks/useCarService.ts adapts provider records to the existing dashboard/calendar/garage props and derives calendar events. It owns no independent business lists or loading requests. Local message/confirmation behavior remains there.
- Stage 2.1 session-invalid/profile-updated events and localStorage identity/profile compatibility remain. AuthProvider and the existing guards/routes retain their session and navigation behavior.
- The unused localStorage authentication implementation is removed. Its pre-existing bcrypt packages remain in the dependency manifest; dependency pruning is deferred.

## Validation

| Check | Result |
|---|---|
| npm run typecheck (strict tsconfig.app.json) | Passed |
| npm run build (includes strict typecheck) | Passed; production bundle approximately 657 kB uncompressed |
| dotnet test Backend/CarServiceShop/CarServiceShop.Tests/CarServiceShop.Tests.csproj --no-restore | 8 passed |
| Complete Chromium suite | 23 passed (17 existing + 6 Stage 2.2 regressions) |
| git diff --check and source scan | Passed; no explicit any, direct Axios calls, fetch calls, or API URL construction outside api modules |

Chromium coverage includes customer -> vehicle -> appointment -> worksheet -> reopen/edit -> print; invalid/expired sessions; admin guards; direct URL refresh on Vite and the ASP.NET-served production build; browser history; logout; cross-page mutation refresh; shared request counts; failed mutations; failed-resource retry; retained records after refresh failure; delayed 200/401 responses across logout/login; and an older in-flight list finishing after a newer mutation refresh.

Browser workflow tests use a separate temporary SQLite validation database, not the existing application database. Backend source has not been modified.

## Warnings and execution notes

- Existing Vite warning: the main JavaScript chunk exceeds 500 kB. Code splitting belongs to later work.
- Existing backend warning: User.Role has a non-nullable initialization warning (CS8618). SQLite migrations warn about PRAGMA operations outside transactions. Runtime also reports an unset HTTPS redirect port and a First/FirstOrDefault query without ordering. These were not changed.
- Initial sandbox-only runs encountered a .NET test-host connection timeout, browser cache-path mismatch, blocked browser networking, and ASP.NET DataProtection key-file permissions. The completed validation used the installed Chromium cache and local execution outside the sandbox. All requested checks completed successfully.
- Playwright emits the environment NO_COLOR/FORCE_COLOR warning.
- Repeated runs against the same temporary database accumulated calendar fixtures, causing the old force-click slot selector to miss its target. The final complete run used a fresh validation database. The existing calendar test now waits for initial vehicle/appointment responses before selecting a slot. The resource retry regression tests the provider’s pure store directly, avoiding development hot-reload module/context identity issues.
- Existing browser suites/configuration remain outside the nested Git repository at C:/CarServiceApp/tests and C:/CarServiceApp/playwright.config.ts. The new regression source is inside the repository at Frontend/tests/stage22.spec.ts; the new external loader C:/CarServiceApp/tests/stage22.spec.ts imports it. Test consolidation remains deferred as planned.
- Browser tests require running Vite and backend servers. From C:/CarServiceApp, run npx playwright test --project=chromium --workers=2 --reporter=line (set PLAYWRIGHT_BROWSERS_PATH to the installed browser cache if required).
- No UI redesign, new state library, backend changes, or later-stage feature work was introduced. Changes are left uncommitted for review.

## Complete file manifest

### Modified (24)

- Frontend/src/App.tsx
- Frontend/src/api/api.ts
- Frontend/src/api/apiService.ts
- Frontend/src/app/VehicleDetailsRoute.tsx
- Frontend/src/auth/AuthProvider.tsx
- Frontend/src/components/Pages/Customers.tsx
- Frontend/src/components/Pages/Dashboard.tsx
- Frontend/src/components/Pages/Garage.tsx
- Frontend/src/components/Pages/Inventory.tsx
- Frontend/src/components/Pages/Login.tsx
- Frontend/src/components/Pages/MainDashboard.tsx
- Frontend/src/components/Pages/Settings.tsx
- Frontend/src/components/Pages/UserManagement.tsx
- Frontend/src/components/Sidebar.tsx
- Frontend/src/components/modals/AddUserModal.tsx
- Frontend/src/components/modals/AddVehicleModal.tsx
- Frontend/src/components/modals/AppointmentModal.tsx
- Frontend/src/components/modals/CustomerModal.tsx
- Frontend/src/components/modals/EventDetailModal.tsx
- Frontend/src/components/modals/WorksheetModal.tsx
- Frontend/src/components/print/WorkSheetPrintModal.tsx
- Frontend/src/hooks/useCarService.ts
- Frontend/src/main.tsx
- Frontend/src/types.ts

### New (19)

- Frontend/src/api/appointments.ts
- Frontend/src/api/auth.ts
- Frontend/src/api/changes.ts
- Frontend/src/api/client.ts
- Frontend/src/api/customers.ts
- Frontend/src/api/development.ts
- Frontend/src/api/inventory.ts
- Frontend/src/api/settings.ts
- Frontend/src/api/users.ts
- Frontend/src/api/vehicles.ts
- Frontend/src/api/worksheets.ts
- Frontend/src/data/WorkshopDataProvider.tsx
- Frontend/src/data/workshopStore.ts
- Frontend/src/data/useWorkshopData.ts
- Frontend/src/types/calendar.ts
- Frontend/src/types/domain.ts
- Frontend/src/types/requests.ts
- Frontend/tests/stage22.spec.ts
- STAGE_2_2_REPORT.md

### Removed (1)

- Frontend/src/api/authService.ts

### Outside the nested repository

- New: C:/CarServiceApp/tests/stage22.spec.ts — loader for the versionable regression source.
- Modified: C:/CarServiceApp/tests/login.spec.ts — synchronize the existing calendar workflow with its initial data responses; business assertions retained.

