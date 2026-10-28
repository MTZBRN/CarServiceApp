# Stage 2.3 — Visual foundation and application shell

Status: complete and verified. Work stops at Stage 2.3. Stage 2.4 and later feature redesigns have not started. Changes remain uncommitted for review.

## 1. Visual foundation

The new shell uses a charcoal/navy background, raised dark surfaces, restrained blue selection/action colors, text-labelled status tones, subtle borders, 6–10px radii, restrained shadows, system typography, and Lucide icons. New shell styling has no gradients, blur, glow, or decorative animation.

- Persistent 248px desktop sidebar; 72px collapsed mode with accessible route names. Collapse preference is saved locally.
- Responsive navigation drawer at 900px and below. It closes on route selection, Escape, or backdrop click, contains keyboard focus, and returns focus to its trigger. Resizing out of drawer mode dismisses it.
- Semantic NavLinks with real hrefs and aria-current route indication; vehicle detail URLs keep Járművek active.
- Ordered navigation: Áttekintés, Naptár, Ügyfelek, Járművek, Munkalapok, Alkatrészek. Lower navigation: Felhasználók and Beállítások for administrators only. Permissions use AuthProvider, not editable stored roles.
- Munkalapok is explicitly unavailable and explains that worksheets currently open from a vehicle detail page. There is no worksheet-list route yet; implementing that belongs to Stage 2.6. Existing worksheet creation/editing/printing remains available.
- Consistent page header, correct route titles, role label, logout action, vehicle-detail breadcrumbs, skip link, main landmark, route-change focus, content spacing, and 1600px maximum shell content width.
- Logged-in user/profile area retains the Stage 2.2 settings cache and profile update integration. Role labels are Hungarian.
- The old floating development button is replaced by a labelled admin action in the lower sidebar. Existing development content opens inside the shell.
- Logout uses a keyboard-accessible confirmation with Cancel initially focused. Authentication/session clearing and redirects remain in the existing architecture.

## 2. Reusable components

| Component | Purpose / current integration |
|---|---|
| Button | Token-based variants; non-submit default to avoid accidental form submissions |
| IconButton | Mandatory accessible label; shell, modal close controls |
| Badge | Existing text-labelled tone interface, refined token styles |
| Card | Basic semantic surface, no feature-specific layout abstraction |
| Input / Select / Textarea / FormField | Native controls, associated labels, optional hint/error associations |
| InputField / SelectField | Existing feature compatibility interface; new shared styling and IDs; SelectField supports labelled combobox/listbox semantics, arrows, Home/End, Enter, Escape, Tab and basic type-ahead |
| DialogSurface / useDialog | Body portal, dialog semantics, stacked focus containment, background inertness, Escape and focus restoration |
| Modal | Shared title/body/footer structure with accessible close control |
| ConfirmDialog | Reusable confirm/cancel presentation, used for logout |
| Table | Lightweight semantic table with required caption and keyboard-scrollable overflow region |
| LoadingState / EmptyState / ErrorState | Consistent state primitives; session guards use LoadingState/ErrorState |
| AppShell / Sidebar / PageHeader / Breadcrumbs | Responsive application layout and navigation |

Card/Table/native field primitives are available for the approved feature stages. Existing feature content has not been rewritten merely to consume every primitive.

Existing form/modal content is retained. Nine legacy dialog wrappers now use DialogSurface, with close-button labels added. Backdrop clicks do not silently discard feature form drafts. Nested worksheet → print dialogs restore focus and release background inertness correctly.

## 3. CSS structure and print isolation

- Frontend/src/index.css: explicit stylesheet import order.
- Frontend/src/styles/tokens.css: colors, spacing, typography, control sizes, borders, radii, shadows, surface hierarchy, focus color, sidebar/content dimensions, and compatibility aliases for old feature variables.
- Frontend/src/styles/global.css: small screen-only baseline, keyboard focus, visually-hidden/skip-link utilities, and reduced-motion support.
- Frontend/src/styles/ui.css: namespaced shared controls, surfaces, state views, dialogs, and toast refinements; screen-only.
- Frontend/src/components/layout/AppShell.css: namespaced shell, navigation, profile, header, breadcrumbs, and responsive behavior, stored with the layout components.
- Frontend/src/styles/legacy-features.css: retained feature styles from the former App.css, screen-only; superseded shell and primitive rules are removed.
- Frontend/src/features/calendar/calendar.legacy.css: existing calendar styles moved unchanged in behavior and scoped under .legacy-calendar, including the daily scheduling overrides previously embedded in App.tsx.
- Frontend/src/styles/print.css: separate A4 worksheet print stylesheet, loaded as text only into react-to-print pageStyle. ignoreGlobalStyles prevents application CSS and dark-theme tokens from being copied into the print frame. No application-wide print styles are injected by opening the preview.

No UI framework, new state library, runtime dependency, API contract change, backend behavior change, or database migration was introduced. AuthProvider, API modules, domain/request types, and WorkshopDataProvider remain unchanged. The old components/Sidebar.tsx import path remains as a thin re-export of the shell sidebar.

## 4. Legacy styling intentionally retained

Dashboard content/cards, customer/vehicle/inventory content and tables, calendar toolbar/events, worksheet editor, settings content, login appearance, and printable document content retain their existing layouts and feature styling. Their inline colors, feature-specific controls, some legacy gradients/shadows, fixed grids, and repeated internal headings remain for the corresponding approved stages.

The shell is responsive; fixed feature layouts may still need scrolling within the main content region on small screens. This stage does not claim to redesign all feature pages for mobile. Only shared controls, dialog accessibility, and shell presentation were upgraded here. Accessibility outside those shared components, including remaining legacy page markup, can be completed during the feature stages.

## 5. Verification

| Check | Result |
|---|---|
| Strict TypeScript check | Passed (tsconfig.app.json, via npm run typecheck and build) |
| Frontend production build | Passed; JS 662.58 kB / gzip 207.70 kB; CSS 40.86 kB / gzip 8.19 kB |
| Backend tests | 8 passed; final dotnet test --no-restore rebuilt successfully |
| Complete Chromium suite | 33 passed: 23 existing tests + 10 shell/accessibility/print tests |
| git diff --check | Passed |
| Protected backend/API/data/auth sources and dependency manifests | No changes |

Browser verification includes:

- 1440px desktop sidebar, active routes, keyboard focus, collapse persistence after refresh, and 1024px laptop shell width.
- 390px mobile, 768px tablet, and 900px narrow-screen drawers: focus containment, Escape, focus return, navigation dismissal, and no document-level horizontal overflow.
- Admin/mechanic navigation differences and protection against stored-role tampering.
- Login/logout, cancel/confirm logout, invalid sessions, direct URLs, refresh, browser back/forward, and production deep-link refresh through ASP.NET.
- Labelled form controls and keyboard select behavior; Escape closes an open list before its dialog; backdrop clicks preserve drafts.
- Nested dialog focus and inertness restoration.
- Existing customer → vehicle → appointment → worksheet → reopen/edit → print workflows and Stage 2.2 mutation/session race tests.
- White print preview and print frame stylesheet inspection: no .app-shell rules or dark-theme tokens copied; saved worksheet text preserved.
- Reduced-motion behavior.

Screenshots were visually reviewed:

- C:/CarServiceApp/stage23-artifacts/desktop-customers.png
- C:/CarServiceApp/stage23-artifacts/mobile-navigation.png
- C:/CarServiceApp/stage23-artifacts/print-preview.png

Validation used separate temporary SQLite databases; the existing application database was not used. The final complete browser run used a fresh validation database.

## 6. Warnings / issues

- The existing Vite large-chunk warning remains (about 663 kB uncompressed). Feature-level code splitting is outside this stage.
- Existing backend diagnostics include User.Role initialization (CS8618), SQLite migration PRAGMA transaction warnings, an unset HTTPS redirect port, and an unordered First/FirstOrDefault query. No backend source was changed.
- A preliminary test build overlapped the validation server and encountered a Windows executable file lock. The server was stopped and the final full backend build/test passed.
- Browser execution requires local execution permissions and the installed Chromium cache in this environment. Playwright prints the existing NO_COLOR/FORCE_COLOR environment warning.
- Existing Playwright tests/configuration still live outside the nested Git repository. Selectors were updated to semantic links, Alkatrészek naming, accessible options and the new logout confirmation; business assertions were retained. The new Stage 2.3 regression source lives inside Frontend/tests, with an external loader matching Stage 2.2's setup. Test consolidation remains deferred.
- Munkalapok is a deliberately unavailable navigation entry until the approved worksheet-list stage. Existing worksheet actions remain fully available from vehicle/calendar workflows.
- Source changes are left uncommitted. The validation servers started for this task are stopped after verification.

## 7. Complete file manifest

### Modified (18)

- Frontend/src/App.tsx
- Frontend/src/app/RouteGuards.tsx
- Frontend/src/components/Pages/Inventory.tsx
- Frontend/src/components/Pages/Login.tsx
- Frontend/src/components/Sidebar.tsx
- Frontend/src/components/modals/AddUserModal.tsx
- Frontend/src/components/modals/AddVehicleModal.tsx
- Frontend/src/components/modals/AppointmentModal.tsx
- Frontend/src/components/modals/CustomerModal.tsx
- Frontend/src/components/modals/EventDetailModal.tsx
- Frontend/src/components/modals/VehicleHistoryModal.tsx
- Frontend/src/components/modals/WorksheetModal.tsx
- Frontend/src/components/print/WorkSheetPrintModal.tsx
- Frontend/src/components/ui/Button.tsx
- Frontend/src/components/ui/FormElements.tsx
- Frontend/src/components/ui/Modal.tsx
- Frontend/src/index.css
- Frontend/tests/stage22.spec.ts

### New (21)

- Frontend/src/components/layout/AppShell.css
- Frontend/src/components/layout/AppShell.tsx
- Frontend/src/components/layout/Breadcrumbs.tsx
- Frontend/src/components/layout/PageHeader.tsx
- Frontend/src/components/layout/Sidebar.tsx
- Frontend/src/components/ui/Card.tsx
- Frontend/src/components/ui/ConfirmDialog.tsx
- Frontend/src/components/ui/DialogSurface.tsx
- Frontend/src/components/ui/Fields.tsx
- Frontend/src/components/ui/IconButton.tsx
- Frontend/src/components/ui/StateViews.tsx
- Frontend/src/components/ui/Table.tsx
- Frontend/src/components/ui/useDialog.ts
- Frontend/src/features/calendar/calendar.legacy.css
- Frontend/src/styles/global.css
- Frontend/src/styles/legacy-features.css
- Frontend/src/styles/print.css
- Frontend/src/styles/tokens.css
- Frontend/src/styles/ui.css
- Frontend/tests/stage23.spec.ts
- STAGE_2_3_REPORT.md

### Removed (1)

- Frontend/src/App.css

### Outside the nested repository

- Modified: C:/CarServiceApp/tests/full-workflow.spec.ts
- Modified: C:/CarServiceApp/tests/login.spec.ts
- Modified: C:/CarServiceApp/tests/routing.spec.ts
- Modified: C:/CarServiceApp/tests/stage1.spec.ts
- New: C:/CarServiceApp/tests/stage23.spec.ts (imports the versionable regression source)
- New: C:/CarServiceApp/stage23-artifacts/ desktop, mobile, and print screenshots
