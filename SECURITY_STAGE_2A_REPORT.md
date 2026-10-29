# Security Stage 2A — sessions, request DTOs and backend validation

Baseline: committed Security Stage 1 `d4e0832`. Scope: SEC-006, SEC-007 and SEC-008 only.
No commit, deployment, provider migration, package update or Stage 2B work was performed.

## SEC-006: session revocation

`User.SessionVersion` is a persisted security stamp included in issued JWTs as `session_version`.
Every authenticated API request checks the current database user, role and stamp. Missing or stale
stamps fail authentication. Deleted users, changed roles and expired tokens remain rejected.

Password changes replace the hash and stamp in the same SaveChanges operation. All previous tokens
for the account are revoked, including the token making the request. The response includes a newly
issued access token using the new stamp. The frontend stores this replacement so settings, image
upload, refresh and normal work can continue. A separate login with the new password also works.
No refresh-token infrastructure was introduced.

`POST /api/Auth/logout` is authenticated and changes only the current JWT identity's stamp with an
atomic database update. It accepts no target-user parameter. This deliberately logs out **all sessions
for that account**, not only the current browser. The frontend initiates revocation using an independent
keepalive request and clears local identity and cached-session state immediately, even when the request
fails. Failed/offline revocation cannot invalidate the server token; local cleanup is not represented as
successful server revocation. There is no new admin account-management operation: existing account
deletion already rejects that account's tokens through the database existence check.

### Migration

`20261029000100_AddSessionVersion` adds one non-null TEXT column to Users, with `initial` as the value
for existing records. The snapshot and target model are updated. Down drops only this column.
No password hash, account, role or business record is changed by the migration. Existing tokens lack
the claim and require a fresh login after upgrading. Back up an actual installation before applying its
schema upgrade; this task exercised migration only against disposable/in-memory databases. Existing
startup migration behavior remains the mechanism for applying migrations when the application starts.

## SEC-007: explicit write contracts

New contracts in `Requests/WriteRequests.cs`:

- CustomerRequest
- VehicleRequest
- AppointmentRequest
- LineItemRequest and JobPartRequest
- CreateWorksheetRequest and UpdateWorksheetRequest
- PartRequest
- SettingsRequest

Existing CreateUserDto, LoginDto and ChangePasswordDto receive bounded/required-field validation.
No request DTO exposes EF navigation properties. Controllers explicitly construct/update entities.
Unknown fields are ignored by the JSON binder for compatibility: a nested `customer`, `vehicle`,
`serviceJob`, child `id` or `serviceJobId` cannot become a tracked graph through these contracts.
Line-item writes construct fresh snapshots; supplied child identities cannot overwrite another row.

Legacy body IDs on customer, appointment, worksheet and inventory writes are identifiers only:
when present on an update they must match the route; they are never copied into a created entity.
Worksheet updates intentionally expose no writable vehicle/appointment/date relationship. Existing
frontend/entity-shaped payloads may contain those extra properties but cannot alter those links.
Read response shapes remain unchanged.

Referenced customer, vehicle, appointment and worksheet IDs are checked before writes. A worksheet
appointment must exist and match its vehicle; creation can still derive its vehicle from an appointment.
Existing duplicate-worksheet conflict behavior remains. A linked appointment still cannot move to
another vehicle. Current worksheet relationships are checked on update. These checks do not introduce
concurrent-deletion guarantees or uniqueness/concurrency redesign; SEC-010 remains deferred.

## SEC-008: validation rules

Validation occurs through ASP.NET model validation plus explicit controller relationship/password
checks, before persistence. Known invalid input returns HTTP 400; established relationship conflicts
remain HTTP 409. A missing target record remains 404. No general exception architecture was added.

| Input | Enforced rules |
|---|---|
| Customer | Required name/phone; name 200, phone 50, email 254, address 500 characters; optional email must have basic email format when nonempty |
| Vehicle | Required registration/make/model; lengths 64/100/100; VIN 50; year 1886–2100; existing customer; optional inspection dates within 1900–2100 |
| Appointment | Existing vehicle; note 5,000; dates within 1900–2100; end must not precede start; equal start/end remains valid |
| Worksheet | Required description, maximum 10,000; labor 0–100,000,000; valid vehicle/appointment relationships; optional creation date 1900–2100 |
| Worksheet batch | Up to 500 line items; no null list/items; batch total including labor at most 1,000,000,000,000 |
| Line item | Required name 200; optional part number 100; integer quantity 1–10,000; price 0–100,000,000; direct line-item endpoint requires an existing worksheet |
| Inventory | Required part number/name, lengths 100/200; net/gross price 0–100,000,000; integer stock 0–1,000,000 |
| Settings | Company 200, address 500, tax number 50, phone 50, email 254; optional nonempty email must have basic format; hourly rate 0–1,000,000; VAT 0–100; zeros accepted |
| User creation | Required bounded name/username; lengths 200/254; only admin/mechanic roles; if a username uses @ it must have basic email format |
| Passwords | Existing Stage 1 minimum 12 Unicode scalar characters and maximum 72 UTF-8 bytes retained for creation/change/provisioning; request strings bounded; existing short-password login compatibility retained |

Accounts support usernames as well as email-shaped login identifiers, as implied by the existing
product and tests. This stage does not suddenly require @ for every existing/new username.
Date limits reject default/sentinel and extreme values while retaining historical records, expired
inspection dates, daily planning and future bookings. No scheduling-capacity or automatic inventory
consumption feature was added. Completion, reopening, historical prices and printing remain intact.
No additional database constraints or schema redesign were necessary for these input rules.

## Frontend compatibility

- Password-change API type now includes the replacement access token; settings saves it on success.
- Logout attempts authenticated revocation independently of the aborted ordinary API requests.
- ValidationProblemDetails field errors are flattened into useful error text by apiErrorMessage.
  Existing forms retain drafts on failure; pages were not redesigned.
- Write request field names remain compatible, so existing business request types do not need a rewrite.

## Tests and existing coverage

Stage2ASecurityTests covers HTTP password-change revocation, replacement/new tokens, logout and
cross-account isolation, stale/versionless signed JWTs, deleted/role-changed accounts, nested entity
payloads, supplied child IDs, route/body mismatches, foreign keys and invalid inputs across all eight
business/account areas. Invalid writes assert that baseline records remain unchanged. Migration tests
upgrade an existing Users table, preserve its hash and check for pending model differences.

Existing SecurityIntegrationTests now put a valid session claim into their intentionally expired and
wrong-key JWTs, keeping those tests focused on the original defenses rather than missing-stamp rejection.
AppointmentsControllerTests and CoreWorkflowTests use the explicit DTO contract; response/persistence
assertions and history-preservation checks remain. Appointment unit fixtures now include the vehicles
required by explicit FK checks. No assertion was removed simply to make a failing test pass.

The stage24 negative-stock setup now asserts HTTP 400. Its existing UI rendering checks for a legacy
invalid stock record remain, using a mocked read response rather than persisting a prohibited value.
The new stage2a browser test verifies local cleanup when the logout endpoint returns 503.

Final validation:

- Backend: **78 passed**, zero failures/skips (the 28 Stage 1 tests plus 50 Stage 2A cases).
- Complete Chromium suite: **75 passed**, zero failures/skips, 2.6 minutes. All 74 existing
  regressions remain, plus the failed-logout cleanup test.
- Strict TypeScript check: passed.
- Frontend production build: passed.
- `git diff --check`: passed.
- Existing-user schema upgrade, unchanged password hash and EF model/snapshot consistency: passed.
- P0 security regressions remain part of the passing backend/browser suites.

**Security Stage 2A scoped gate: PASS.** This is a code and local verification result, not an
internet-deployment approval. No real workshop database was used for verification.

## Files changed

Backend controllers: Appointments, Auth, Customers, JobParts, Parts, ServiceJobs, Settings, Users,
Vehicle. Backend model/configuration: Models/User.cs and Program.cs.

New backend contracts: Requests/WriteRequests.cs. Migration: AddSessionVersion main/designer and
ApplicationDbContextModelSnapshot.cs. No dependency files changed.

Frontend: src/api/auth.ts, src/api/client.ts, src/auth/AuthProvider.tsx,
src/components/Pages/Settings.tsx. No page redesign or unrelated feature.

Tests: backend AppointmentsControllerTests.cs, CoreWorkflowTests.cs, SecurityIntegrationTests.cs;
new Stage2ASecurityTests.cs; Frontend/tests/stage24.spec.ts and new Frontend/tests/stage2a.spec.ts.
Documentation: this report. No existing files removed. Temporary editing scripts were removed.

## Warnings and deferred work

The existing User.Role nullable compiler warning and existing dependency/runtime advisories remain.
Git may report line-ending conversion notices. In-flight operations already authenticated before a
revocation are not retroactively cancelled; subsequent authenticated requests reject the old stamp.
Offline logout can only clear the client and attempt revocation; it cannot guarantee server contact.

Explicitly deferred: SEC-009 general quotas/pagination; SEC-010 concurrency/uniqueness and last-admin
invariants; SEC-011 destructive/history permissions; SEC-012 production Seed restrictions; SEC-013
CORS; SEC-014 general headers; SEC-015 dependency/runtime upgrades; SEC-016 broad startup/errors;
SEC-017 repository/container hygiene; SEC-018 audit trail; SEC-019 issuer/audience/algorithm policy.

No deployment or HTTPS certificate/domain configuration was performed. Actual TLS ingress remains
an independent deployment gate. Passing Stage 2A does not establish readiness for internet exposure
or completion of the remaining security stages.
