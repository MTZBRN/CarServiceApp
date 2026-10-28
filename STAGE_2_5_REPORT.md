# Stage 2.5 — Calendar and Appointment workflow

Complete and verified. Changes are uncommitted for review. Stage 2.6 and all later work remain unstarted.

## 1. Visual changes

Calendar presentation now lives in features/calendar, outside App.tsx. It uses the Stage 2.3 tokens and shared Button, IconButton, Badge, Modal, ConfirmDialog, FormField, Input, Select, Textarea and state components. React Big Calendar is retained.

- Compact Hungarian previous/today/next controls, period label, month/week/list switcher and primary Új időpont action.
- Distinct text/icon labels for Időpont and Műszaki emlékeztető, with restrained blue/amber edge accents.
- Prominent registration, customer/note context, inspection expiry and worksheet state. Full details remain available from each entry.
- Month day headings show starting-entry counts and open the agenda for that date. Dense month rows scroll; week entries scroll while weekday headings remain visible.
- Responsive agenda is the default on narrow screens when no view was explicitly requested. Explicit month/week URLs are respected and may scroll within the calendar region.
- Appointment details, creation and edit forms use the shared dark surfaces, associated labels, focus handling and keyboard behavior.

## 2. Appointment workflow

Creation retains the daily booking contract: selected day is saved from 00:00:00 UTC through 23:59:59 UTC. The form includes customer filtering, vehicle registration/make/model/owner context, phone context, date, note, inline validation, saving state, duplicate-submit locking and retained values after a failed save. The existing quick customer/vehicle creation capability reuses AddVehicleModal and selects the newly created vehicle from shared data. A single supplied vehicle is preselected for vehicle-detail booking.

Editing uses the existing appointment ID. Each timestamp is marked dirty independently; an untouched timestamp is sent back exactly as received, including seconds and any original offset/serialization. Changing only a note or vehicle does not reserialize start/end values. Inputs validate that end follows start.

A linked worksheet locks vehicle selection. When relationship data cannot be verified, saving an edit is blocked and retry is available. Details identify the worksheet by its service-job ID and completion state.

Deletion uses a confirmation identifying registration and appointment date. It explicitly explains that worksheet/service history remains. Failed deletion keeps the confirmation open with the server message. No success is assumed before the server accepts the mutation.

Inspection reminders expose vehicle navigation only; they have no appointment edit/delete/worksheet action and never reinterpret a vehicle ID as an appointment ID.

## 3. Calendar state and data behavior

Date and view are owned solely by URL search parameters: /calendar?date=YYYY-MM-DD&view=month|week|agenda. Initial missing/invalid parameters are canonicalized using replace; deliberate period/view navigation adds history entries. Refresh, direct links and back/forward restore that state. Other query parameters are retained. This makes URL persistence concrete; the previous App date/view React state was not URL-backed.

Calendar records come from WorkshopDataProvider resources: appointments, vehicles, customers and worksheets. No duplicate appointment cache, direct Axios/fetch call, new state library or manually constructed API URL was introduced. The discriminated CalendarEvent union remains intact. Runtime event identity combines event type and numeric ID, avoiding booking/reminder collisions. The installed calendar runtime supports eventIdAccessor; its older declaration package omits that prop, so it is passed using a separately typed object.

Existing mutations continue through typed resource APIs and existing invalidation. Selected event details are derived from current shared records, rather than holding stale record copies. WorksheetModal receives serviceJobId when a job exists and appointmentId for the creation/link relationship. WorksheetModal and print content were not redesigned or modified.

App.tsx retains the shell/dashboard integration but no longer contains calendar rendering, toolbar, date/view state or appointment overlays. The useCarService compatibility adapter no longer derives an unused second calendar event list; dashboard data behavior remains intact. A confirmation-reset timing issue discovered during extraction was corrected to preserve Stage 2.3 logout behavior.

## 4. Minimal backend and API fixes

The approved guard was necessary: PutAppointment previously allowed changing VehicleId even when ServiceJobs referenced that appointment. It now returns 409 Conflict before updating any fields when such a vehicle change is attempted. Unlinked appointments can still move vehicles, and linked note/time edits remain supported. No migration, schema change, new endpoint or broader backend refactoring was added.

Three backend cases were added: linked vehicle change denied without partial mutation; unlinked vehicle change allowed; linked note edit preserves timestamps and worksheet relationship.

The frontend appointment update helper now includes id in the request body, as the existing controller contract requires. This is a caller bug fix, not a backend contract change.

## 5. Test reliability

- The legacy calendar booking test now uses the visible Új időpont action rather than force-clicking a supposedly empty visual slot.
- Calendar-specific fixtures are created per test with unique registration/note suffixes and explicit URL dates. Tests do not depend on an empty current day or coincident appointment/worksheet IDs.
- Fixtures are spread across deterministic dates; dense views deliberately include twelve same-day appointments per fixture and inspection reminders.
- View screenshots wait for the actual week layout. Semantic dialog, form and event selectors retain business assertions.
- All browser execution used a separate temporary SQLite database; the final combined run used a fresh validation database. Real application data was not used.

## 6. Verification

| Check | Result |
|---|---|
| Strict TypeScript (npm run typecheck, included in build) | Passed |
| Frontend production build | Passed; JS 651.64 kB / gzip 209.31 kB; CSS 42.73 kB / gzip 8.64 kB |
| Backend build/tests (dotnet test --no-restore) | 11 passed |
| Complete Chromium suite | 44 passed: 39 prior regressions + 5 focused Stage 2.5 tests |
| git diff --check | Passed |

Coverage includes month/week/agenda navigation, today, URL persistence/refresh/history; multiple events per day; reminder semantics; create validation and server failure retention; duplicate submission prevention; exact start/end preservation; vehicle lock and HTTP/backend guard; failed and successful appointment deletion preserving worksheet history; explicit unequal worksheet/appointment IDs; Stage 1 create/reopen/edit/print; login/logout and permissions; Stage 2.2 invalidation/session races; Stage 2.3 shell; Stage 2.4 CRUD and responsive features.

Calendar views were checked at 1440, 1024, 768 and 390px with no document-level horizontal overflow. The six final screenshots below were visually inspected.

## 7. Retained legacy behavior

- This remains daily workshop planning, not an hourly scheduling grid. Timed appointments retain their exact data; details display start/end, while planner tiles use calendar days.
- New daily bookings retain the previous UTC day boundaries. No timezone-policy migration or reinterpretation of stored times was attempted.
- Agenda retains its existing thirty-day range. Narrow screens default to agenda only when the URL does not specify a view.
- No recurrence, drag/resizing workflow, dedicated worksheet list or worksheet editor redesign was introduced.
- Other feature pages, shell implementation, authentication, settings, user management and print document remain unchanged.

## 8. Warnings / issues

- Vite's existing >500 kB JavaScript chunk warning remains; code splitting is deferred.
- Existing backend warnings remain: non-nullable User.Role initialization, SQLite migration PRAGMA transaction warnings, unset HTTPS redirect port and an unordered First/FirstOrDefault query. These are outside this stage.
- Native date/time picker presentation follows the browser locale; labels and calendar text are Hungarian.
- Dense month/week views use controlled scrolling; agenda and day-count navigation provide the full list on narrow screens.
- Existing Playwright configuration and older suites remain outside the nested Git repository. New test source is inside Frontend/tests with an external loader, following prior stages.
- Preliminary regression testing exposed the extraction-related logout confirmation race; it was fixed and the complete final suite passes.
- Validation servers started for this task are stopped after verification. Changes remain uncommitted.

## 9. Screenshot locations

- C:/CarServiceApp/stage25-artifacts/month-desktop.png
- C:/CarServiceApp/stage25-artifacts/week-desktop.png
- C:/CarServiceApp/stage25-artifacts/appointment-details.png
- C:/CarServiceApp/stage25-artifacts/appointment-edit.png
- C:/CarServiceApp/stage25-artifacts/inspection-details.png
- C:/CarServiceApp/stage25-artifacts/mobile-agenda.png

## 10. Complete file manifest

### Modified (8)

- Backend/CarServiceShop/CarServiceShop.Tests/AppointmentsControllerTests.cs
- Backend/CarServiceShop/CarServiceShop/Controllers/AppointmentsController.cs
- Frontend/src/App.tsx
- Frontend/src/api/appointments.ts
- Frontend/src/components/modals/AppointmentModal.tsx
- Frontend/src/components/modals/EventDetailModal.tsx
- Frontend/src/hooks/useCarService.ts
- Frontend/src/index.css

### New (4)

- Frontend/src/features/calendar/CalendarPage.tsx
- Frontend/src/features/calendar/calendar.css
- Frontend/tests/stage25.spec.ts
- STAGE_2_5_REPORT.md

### Removed (1)

- Frontend/src/features/calendar/calendar.legacy.css

### Outside the nested repository

- Modified: C:/CarServiceApp/tests/login.spec.ts — deterministic booking action and native vehicle select.
- Modified: C:/CarServiceApp/tests/stage1.spec.ts — distinct reminder/appointment selectors and create/open worksheet actions.
- Modified: C:/CarServiceApp/tests/routing.spec.ts — calendar URL date/view canonicalization assertions.
- New: C:/CarServiceApp/tests/stage25.spec.ts — loader for the versionable test source.
- New screenshot artifacts: C:/CarServiceApp/stage25-artifacts/.
