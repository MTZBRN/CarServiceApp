# Security Stage 2B — integrity and history permissions

Baseline: `a72750f` (committed Security Stage 2A). Scope: SEC-010 and SEC-011 only.

## Working tree boundary

Before changes, Program.cs contained an uncommitted development-only recovery block, and
Data/TestAdminRecovery.cs and CarServiceShop.Tests/TestAdminRecoveryTests.cs were untracked.
These are separate local recovery work, not Stage 2B deliverables. They were not edited, staged,
discarded or committed. Program.cs still equals its committed baseline plus precisely that existing
recovery block. Do not include these three files when staging Stage 2B.

The local backend held build files. With explicit user permission it was stopped for verification.
It was not restarted against the application database. Tests used disposable/in-memory SQLite
databases. A read-only preflight found one local account and one distinct normalized identifier;
no duplicate collision was found and no real account/business row was changed.

## SEC-010: normalized identifier uniqueness

Users now have a database-generated virtual `NormalizedLogin` column and a unique index. The exact
normalization is SQLite `upper(trim(Email))`: remove surrounding U+0020 spaces and fold ASCII a–z
to A–Z. Non-ASCII characters retain their existing exact distinctions. The C# login lookup uses the
same explicit ASCII strategy, independent of machine culture. Stored/displayed identifiers are not
rewritten. Existing valid identifiers/passwords continue to work; ASCII case-equivalent logins work.

The index, not the pre-insert check, arbitrates parallel creation. Expected constraint conflicts return
a controlled HTTP 400 with a useful account error, without SQLite details. The normalized field is
not accepted by user DTOs or exposed in user-list responses. Existing provisioning and trusted local
recovery writes also encounter the database index.

Before adding it, the migration checks for duplicate normalized groups. Any collision aborts with
`Duplicate normalized usernames: resolve accounts before migrating`. No user is deleted, merged or
selected as a winner. Operators must inspect conflicting accounts and explicitly resolve identifier
ownership before retrying; do not remove users merely to bypass the check. Back up the database
before its schema upgrade.

## SEC-010: final administrator

The existing friendly count check remains, but the authoritative protection is a SQLite BEFORE DELETE
trigger. Deleting an admin when only one admin remains raises an abort. The count and deletion execute
within the same database statement/write transaction. SQLite serializes writers, so simultaneous
deletions cannot both act on an obsolete application-level count. Controller constraint handling maps
this expected rejection to HTTP 400. There is no new role-edit endpoint or broad account redesign.

## SEC-010: optimistic concurrency

ServiceJobs, Appointments, Parts and GlobalSettings have TEXT `Version` stamps. New rows receive
server-generated GUID stamps; existing rows receive `initial` during migration. Each accepted update
forces a new stamp, including no-op updates. EF configures the stamp as a concurrency token, so the
UPDATE compares the client's expected version against the stored original, rather than relying only
on a read-then-check sequence. Missing/stale versions on existing-record updates return HTTP 409.

Expected versions are carried in AppointmentRequest, UpdateWorksheetRequest, PartRequest,
SettingsRequest and JobPartRequest. A direct JobParts append checks/stamps the parent worksheet,
so it participates in conflicts with completion and other worksheet edits. Appointment deletion also
stamps a worksheet when detaching its appointment relationship.

Worksheet stale checks happen before replacing tracked line items. SaveChanges encloses the parent
and line-item mutations in one transaction; a race discovered by EF rolls back the entire write. A
failed stale writer cannot remove or partially replace the successful writer's snapshots. Expected
delete-time concurrency exceptions are also returned as 409 rather than exposing database errors.

Successful worksheet/appointment/inventory updates return HTTP 200 with the updated entity and
version. Settings POST returns the saved settings. This intentional additive/read-contract change lets
forms advance their stamp only after their own successful save. Settings creation uses key 1 when
the table is empty; simultaneous first creation conflicts on the primary key rather than introducing
two settings rows. Existing rows are updated in place; no legacy settings cleanup is performed.

## SEC-011: role policy

One shared workshop remains; there is no assigned-mechanic model.

| Action | Admin | Mechanic |
|---|---|---|
| Read workshop/customer/vehicle/history data and print worksheets | Yes | Yes |
| Create/edit customers and create vehicles | Yes | Yes |
| Create/edit appointments, with linked-vehicle guard | Yes | Yes |
| Create/edit active worksheets and add active line items/labor | Yes | Yes |
| Complete an active worksheet | Yes | Yes |
| Modify/reopen completed worksheet | Yes | No |
| Direct JobParts append to completed worksheet | Yes, with expected version | No |
| DELETE /api/ServiceJobs/{id} | Yes | No |
| DELETE /api/Parts/{id} | Yes | No |
| DELETE /api/Customers/{id} | Yes, relationship guard | No |
| DELETE /api/Vehicle/{id} | Yes, history guard | No |
| DELETE /api/Appointments/{id} | Yes, preserve worksheet | No |
| DELETE /api/Users/{id} | Yes, final-admin invariant | No |
| Account/company administration | Yes | No |
| Ordinary inventory creation/editing | Yes | Yes |

Completed-state checks use the current database worksheet, not a client-supplied status. A mechanic
cannot reopen by sending `isCompleted:false`, edit charges, append a direct JobPart, or erase the
worksheet. Admin can correct completed work directly or reopen it; after reopening mechanics may
edit it again. API policies apply regardless of hidden controls or direct URLs.

Existing relationship guards remain. Database BEFORE DELETE guards additionally reject customer
deletion with vehicles and vehicle deletion with appointments/jobs, preventing a race between the
application check and a newly inserted dependent from cascading into history. No new cascade was
introduced. Explicit authorized worksheet deletion still removes its line items. Appointment deletion
continues to detach, not delete, the worksheet and preserves its parts.

## Migration

`20261029000200_IntegrityGuards` and its designer/snapshot:

- Preflight normalized-user collisions; add virtual normalized field and unique index.
- Add Version only to the four prioritized business tables.
- Add database last-admin and customer/vehicle history deletion guards.

No table reset, user merge/deletion, password/session rewrite, provider change or unrelated schema
redesign. Upgrade tests run from `20261029000100_AddSessionVersion`, preserve existing rows/hash,
test rejection of duplicate accounts without loss, and assert EF model/snapshot consistency.
Normal application startup will apply the migration when the operator later starts it; this task did
not apply it to the local application database.

## Frontend compatibility

Forms send the version of their loaded draft, never a freshly fetched version immediately before
writing. Appointment editing freezes that stamp with the initial form state. Worksheet/settings save
responses update their stamps after success. A 409 displays the backend reload/refresh instruction
and retains entered values; no silent retry or overwrite occurs.

Printing fetches a fresh printable snapshot without advancing an older editor draft's version. This
prevents print-preview reads from accidentally authorizing a later overwrite with stale draft values.
Completed mechanic worksheets disable fields and hide save/reopen controls, while keeping print
available. Destructive buttons are hidden from mechanics on customer, garage, inventory, vehicle,
calendar and dashboard surfaces. Backend remains authoritative. No page redesign or stock-consumption
behavior was introduced.

## Tests and changes to existing tests

New Stage2BTests covers normalized duplicate/case-equivalent/parallel creation and valid login;
single/two/concurrent administrator deletion; raw database final-admin enforcement; stale and parallel
worksheet writes with atomic children; fresh retries; appointment/part/settings stale writes; mechanic
active editing/parts/completion and completed-history denial; admin correction/reopen/deletion;
relationship guards, direct database history protection, appointment detachment, safe schema upgrade
and duplicate-migration failure. Both sequential stale and simultaneous writes are exercised.

New stage2b browser tests cover two stale worksheet editors (including print-preview between reads
and stale save), preservation of draft/server values, and mechanic read-only/history/delete controls.

Existing test changes are contract-specific:

- Appointment/core controller tests supply loaded versions and expect 200 saved-entity responses.
- The historical schema-upgrade fixture seeds its old schema through SQL, because the current EF
  model now requires columns that did not exist at that old migration. Its history assertions remain.
- Stage2A deleted/role-changed-token tests retain a second administrator so the intended account can
  be removed without violating the new last-admin invariant; the original 401 assertions remain.
- Normal direct API update fixtures in stage1/stage25 and settings restoration in stage27 explicitly
  read versions through versioned-request.ts. Production forms do not use that helper. The new
  stale-write tests deliberately retain older versions and bypass it.
- Stage1 first asserts mechanic appointment DELETE is forbidden, then uses admin deletion for its
  original worksheet-history preservation assertions.

All earlier workflow/P0/Stage2A tests remain. No assertion was weakened to suppress a security failure.

Final validation:

- Backend: **90 passed**, zero failed/skipped. This includes the 78 committed baseline cases,
  11 new Stage 2B cases and the one untouched, unrelated local recovery test.
- Complete Chromium: **77 passed**, zero failed/skipped, 2.9 minutes (75 existing plus two new).
- Strict TypeScript and frontend production build: passed.
- Migration upgrade/data preservation, duplicate migration failure and EF model consistency: passed.
- `git diff --check`: passed.
- Read-only check: the IntegrityGuards migration is **not** applied to the application database.
- Program.cs comparison: exactly the committed baseline plus its pre-existing recovery block.

**Security Stage 2B scoped gate: PASS.** No commit was made. The authorized local backend remains
stopped; restart is an operator action and will apply pending migrations through existing startup behavior.

## Changed-file inventory (Stage 2B only)

Backend:

- Controllers/AppointmentsController.cs, AuthController.cs, CustomersController.cs, JobPartsController.cs,
  PartsController.cs, ServiceJobsController.cs, SettingsController.cs, UsersController.cs, VehicleController.cs.
- Data/ApplicationDbContext.cs; new Data/Integrity.cs.
- Models/Appointment.cs, GlobalSettings.cs, Part.cs, ServiceJob.cs, User.cs.
- Requests/WriteRequests.cs.
- Migrations/ApplicationDbContextModelSnapshot.cs; new IntegrityGuards migration and designer.

Frontend:

- src/api/settings.ts, worksheets.ts; src/types/domain.ts, requests.ts.
- src/components/Pages/Customers.tsx, Garage.tsx, Inventory.tsx, MainDashboard.tsx, Settings.tsx,
  VehicleDetails.tsx; src/components/modals/AppointmentModal.tsx, EventDetailModal.tsx.
- src/features/records/PartForm.tsx; src/features/worksheets/WorksheetWorkspace.tsx.

Tests/documentation:

- AppointmentsControllerTests.cs, CoreWorkflowTests.cs, Stage2ASecurityTests.cs; new Stage2BTests.cs.
- Frontend/tests/stage1.spec.ts, stage25.spec.ts, stage27.spec.ts; new stage2b.spec.ts and
  versioned-request.ts; this SECURITY_STAGE_2B_REPORT.md.

No existing files removed. Temporary editing scripts were removed. Program.cs and both local
TestAdminRecovery files are excluded local recovery work, as described above.

## Warnings, limits and deferred scope

The User.Role nullable warning and existing dependency/runtime advisories remain. Git may print
line-ending notices. Normalization deliberately uses SQLite-compatible ASCII folding, not full Unicode
case folding. External/manual database maintenance must respect application version stamps. Raw
SQL operational updates are not automatically versioned by EF. No broad audit/soft-delete system exists.

Explicitly deferred: SEC-009 general pagination/quotas; SEC-012 Seed hardening; SEC-013 CORS;
SEC-014 general headers; SEC-015 dependency/runtime upgrades; SEC-016 broad startup/error redesign;
SEC-017 repository/container hygiene; SEC-018 broad audit trail; SEC-019 issuer/audience/algorithm
policy. No production deployment, provider migration or public HTTPS/domain work. Stage 3 was not
started. Passing the scoped code/test gate is not approval for internet exposure.
