# Security Stage 3E — Security and business audit trail

Date: 2026-11-01. Scope: **SEC-018 only**. Clean committed/pushed Stage 3D baseline: `e8aeeab` (`Add bounded resource access and pagination`). No unrelated uncommitted changes or local recovery edits were present. Work remains uncommitted.

Before modification, the authentication/session/JWT validation, all mutating controllers, role guards, safe-error logging, EF saves/migrations, shared frontend shell/resource patterns and existing security tests were inspected. The plan was a small persistent event model, one reusable bounded writer, atomic mutation/event persistence, sampled login-failure events, a bounded admin read API/page, focused integration/browser tests and complete regression. Existing business flows and authorization policies were retained.

## 1. Schema and focused migration

`AuditEvent` / `AuditEvents` stores:

| Field | Type / bound | Purpose |
| --- | --- | --- |
| Id | SQLite auto-increment integer / C# long | Stable event identity and ordering tie-break |
| TimestampUtc | DateTime, UTC on creation and materialization | Event time |
| ActorUserId | Nullable integer | Server-resolved account; null for unknown/system |
| ActorName | 200 characters | Bounded display snapshot |
| ActorRole | 16 characters | Role snapshot |
| Action | 64 characters, internal letters/dots vocabulary | Business/security action |
| ResourceType | 32 characters, internal letters vocabulary | Affected resource |
| ResourceId | Nullable positive integer | Survives resource deletion |
| Outcome | 16 characters; server uses Success/Failure | Result |
| Details | 2048 characters maximum | Explicitly allowlisted JSON |
| TraceId | 64 characters | Sanitized server correlation ID |

Actor display snapshots strip control characters. Action/type and resource-ID bounds are checked by the writer. Metadata has a fixed server-constructed schema, selected scalar values and at most 16 changed field names. EF max-length metadata documents the schema limits; SQLite does not turn those annotations into text-length constraints, so enforcement occurs in the internal writer. No arbitrary event-create API exists.

Migration **`20261101174037_AddAuditTrail`** creates only the audit table and three indexes:

- `(TimestampUtc, Id)` for newest-first reading;
- `(ActorUserId, TimestampUtc)` for actor investigation;
- `(ResourceType, ResourceId, TimestampUtc)` for resource history.

No foreign key points to users/business records: their deletion cannot cascade into audit history. No existing table is reset, data merged, history deleted or provider changed. The generated designer/snapshot use the current EF 10.0.14 model; formatting/order changes to existing concurrency-property declarations do not generate unrelated DDL. Upgrade tests migrate from the Stage 3D schema and preserve existing data; model consistency passes.

`DesignTimeContextFactory` supplies an in-memory SQLite model for EF schema tooling, avoiding ordinary application startup against the configured workshop database while scaffolding. No signing secret or real database was needed for migration generation. The migration was exercised only on disposable test databases; it was not applied to the workshop database by this task.

## 2. Writer and transactional consistency

`AuditWriter` is a scoped backend service, exposed through the existing DbContext's `SaveAuditedAsync` convenience method. Controllers select the business root, not raw audit columns. The writer captures original/current **allowlisted** values before persistence, saves the mutation inside an explicit SQLite transaction, obtains generated resource IDs, appends one audit event and commits. A second save is necessary for generated IDs; both saves share the same transaction. Audit appends do not recursively generate audit events.

Database mutation failures keep their existing controlled validation/conflict behavior and do not create successful events. Required audit failures are wrapped separately so controllers cannot mistake an audit constraint error for a duplicate username or relationship conflict. The existing safe exception handler returns sanitized 500 details; the transaction rolls back the business operation and child-line replacements. Cancellation flows from the request into transaction/audit work.

Logout keeps its SQL-based SessionVersion invalidation to avoid lost revocations, now inside a transaction with the audit append. If its target disappears it does not record a false successful revocation. Initial provisioning and the existing development-only local recovery command append through the same writer before their existing transaction commits. Recovery received only a one-line audit append, without changing its role/password/session/environment/interactive behavior. Development seeding's existing multiple saves now share one transaction and one aggregate event.

Profile replacement commits its database reference and event together; the filesystem is outside the SQLite transaction. Existing newly-created-file rollback/old-file cleanup remains. A crash or file-cleanup failure can still leave an orphan addressed by the Stage 3D maintenance procedure. Successful login must persist its authentication event before returning a token. Sampled failed-login writes are deliberately best effort, as described below.

## 3. Security event coverage

| Event | Identity/context and behavior |
| --- | --- |
| `Auth.LoginSucceeded` | Resolved database user ID/name/role; no token/password |
| `Auth.LoginFailed` | Sampled after credential/identity resolution; known account snapshot or null/empty unknown identity; Failure outcome |
| `Auth.PasswordChanged` | Authenticated actor and target user ID; no old/new password, hash or SessionVersion value |
| `Auth.SessionRevoked` | Current authenticated user only; transaction includes SQL revocation |
| `Auth.ProfileImageChanged` | Current actor/user ID; no original filename, file bytes or image contents |
| `User.Created` / `User.Deleted` | Acting admin, target ID, changed field names and role scalar |
| `Auth.InitialAdminProvisioned` | System actor, new account ID and fixed role context |
| `Auth.LocalAdminRecovered` | System actor, target ID, fixed Role/Password/Sessions field names |
| `Development.Seeded` | Acting Development admin, one aggregate event; Production Seed remains unavailable |

There is no current role-update HTTP endpoint; none was invented. Role-relevant user creation/deletion and existing local recovery are covered. The local command's OS operator identity is not inferred as an authenticated application user.

Failed-login sampling uses **constant memory** and a process-global budget of **one/minute and twenty/hour**, independent of attacker-supplied login strings. Unknown usernames are never copied to audit rows. Existing login body/password/source/identity throttles remain. Generic failed-login responses are identical for known and unknown identities; optional sampled audit failure emits a fixed warning and does not change that response. Throttled attempts do not create extra audit rows. Sampling can omit attacks and resets on process restart; this is intentional bounded evidence, not a complete authentication-attempt ledger.

Authenticated identity comes from validated server claims; login snapshots come from the database credential lookup. Clients cannot supply an audit actor through request JSON. Authenticated display names reflect the session's signed name snapshot, which may predate an administrative database name change. A failed-login account identifies an attempted account, not a proven human actor.

## 4. Business and completed-history coverage

| Resource | Events / selected details |
| --- | --- |
| Customer | Created, Updated, Deleted; personal field names only |
| Vehicle | Created, Deleted; field names and customer-ID relationship, without plate/VIN/text copies |
| Appointment | Created, Updated, Deleted; vehicle IDs and before/after start/end times; note field name only |
| Worksheet | Created, Updated, Completed, Reopened, CompletedCorrected, Deleted, LineItemAdded |
| Inventory | Created, Updated, Deleted; stock and net/gross price before/after; part text field names only |
| Settings | Created, Updated; company/contact field names only; hourly rate/VAT before/after |

Worksheet events explicitly distinguish completion, admin reopen, correction while already completed and deletion. Direct JobParts append records the parent worksheet ID and line-change field, rather than one row for internal child inserts. Labor deltas and old/new completion state are retained. Full notes, item names, child snapshots or worksheet contents are not duplicated. Normal worksheet replacement, including 500 lines, is one business event. A worksheet created already completed records that state in its Created event rather than inventing a separate action.

Vehicle update/owner-reassignment and user role-edit APIs do not currently exist; no new business operation was introduced. Appointment deletion retains the existing worksheet-history detachment behavior inside the audited transaction. Unauthorized mechanic completed-history changes and blocked relationship/concurrency operations create **no false successful mutation event**. Not every rejected business request is independently audited.

## 5. Metadata minimization and privacy

Details are built from selected EF properties, never serialized request/entity objects. Numeric/date/status/reference/role deltas are explicit scalar fields. Customer contact values, addresses, company contact/tax values, free-text descriptions/notes, vehicle plate/VIN values and inventory text are represented only by field names. Security values and uploaded content are omitted entirely. Actor names and resource/actor identifiers remain sensitive operational/personal context and survive referenced-record deletion; database/backup access must remain restricted.

The frontend renders actor/action/resource/details as React text, without HTML parsing, `dangerouslySetInnerHTML`, eval or external content loading. The malicious-text browser test verifies that a supplied `<img ...>` string produces text and no DOM image/script execution. No request/IP/header logging, analytics, external sink or SIEM integration was introduced.

## 6. Admin read API and frontend

**`GET /api/Audit`** is admin-only: anonymous requests receive 401; mechanics 403. It has no write/edit/delete/clear endpoint, and ordinary EF saves reject modifications/deletions of existing audit events. This is application append-only behavior, not tamper resistance against privileged direct database access.

It follows Stage 3D's array contract with `X-Total-Count`, `X-Page`, `X-Page-Size`: default 50, maximum 100 rows/page, pages 1–100000, deterministic timestamp-descending/ID-descending order. Filters: exact `actorId`, `action`, `resourceType`, `resourceId`, `outcome`, UTC `from` and inclusive final-day `to`. Invalid paging, dates/ranges, IDs, outcomes and bounded text produce 400. Queries use parameterized EF LINQ, `AsNoTracking`, SQL count/offset/limit and cancellation. Existing collection rates/concurrency and sensitive-response no-store headers apply. GET does not audit itself.

The lazy-loaded **`/audit`** page uses the existing RequireAdmin guard, admin navigation, shell PageHeader, Card/Table/Input/Select/Badge and Loading/Error/Empty states. Filters debounce by 250 ms, reset page 1, and cancel superseded requests with stale-result protection. It has page/total/previous/next controls and the established mobile card-table pattern. Times are explicitly labelled UTC. It is a read-only page with no destructive controls, real-time polling or monitoring dashboard. Existing shell/workshop pages retain their behavior.

## 7. Abuse, retention and operations

Audit details/identity/query fields and per-response rows are bounded. Unauthenticated failure evidence is globally sampled, with existing login limits still applied. Important mutations add one row per business action, not a row per internal EF change. Existing Stage 3D request, worksheet, upload and collection bounds remain intact.

Recommended starting retention: **24 months online**, subject to an operator review of business needs. Actual implementation retains history indefinitely until a separately authorized maintenance process is designed: no automatic pruning, archive system or log-clear API was added. Growth, backup protection, safe manual archival review and failure semantics are documented in [AUDIT_TRAIL_OPERATIONS.md](AUDIT_TRAIL_OPERATIONS.md).

Planning example only: 200 business actions plus 20 successful logins and the maximum 480 sampled failures/day yields about 700 events/day; assuming 1 KiB average storage/event gives roughly 250 MiB/year before index/page/backup overhead. Actual volume varies. Authenticated misuse can still grow business/audit tables; there is no total log-table disk quota or distributed sampling service. These are documented limits, not claims of fixed total storage or complete attack detection.

## 8. Tests added and existing tests changed

`Stage3EAuditTests.cs`: **19 integration cases** covering:

- login/password/logout events and credential/token omission; generic sampled known/unknown failures and bounded failure budget;
- account creation/deletion, target role context, surviving references and admin-only audit access;
- customer/vehicle/appointment mutations and minimal date/reference deltas;
- full worksheet lifecycle, completion, completed correction, reopen, direct lines and completed deletion, one event/action;
- mechanic denial without false history success;
- inventory create/update/delete and stock deltas; settings fields/pricing deltas without private text dumps;
- audit paging/order/count/max/filters/validation and absence of HTTP mutation routes;
- audit writer field bounds/control cleanup and tracked-row append-only guard;
- failed business conflicts produce no success event;
- forced audit insert failure rolls back worksheet edit/delete, user deletion, settings changes and SQL logout revocation; sanitized errors expose no internal failure message;
- system provisioning/recovery events omit credentials;
- upgrade from the Stage 3D schema preserves business data and matches the current model.

`stage3e.spec.ts`: **three browser tests** cover real recent business events, filters/pagination, admin page/navigation, mechanic direct API/page denial, malicious text rendering and a 390px viewport without document overflow. Synthetic customers are created through the disposable test API, not the workshop database.

Existing changes are limited to:

- `UsersControllerTests.cs` and `AppointmentsControllerTests.cs`: replace transactionless EF InMemory fixtures with isolated in-memory SQLite, opening/creating the test schema; appointment fixtures now include a valid customer FK. Every original assertion remains. This resolves the initial seven fixture failures without weakening atomicity in production code.
- `Frontend/tests/stage23.spec.ts`: admin navigation now has three links instead of two because Audit is intentionally added; the six ordinary navigation links and all role/keyboard assertions remain.

No earlier security/business assertions were removed or weakened. No test retries were enabled.

## 9. Required regression results

| Check | Result |
| --- | --- |
| dotnet restore | PASS; current projects restored/up to date |
| Backend/test build | PASS, zero errors |
| Complete backend suite | **PASS: 170 passed, 0 failed, 0 skipped** |
| Migration/model consistency | **PASS**, Stage 3D-to-audit upgrade plus unchanged older upgrade/integrity tests; no pending model change |
| Frontend npm ci | PASS, locked dependency versions unchanged |
| Strict TypeScript | PASS |
| Frontend production build | PASS |
| Focused new Chromium tests | **PASS: 3/3** |
| Complete Chromium suite | **PASS: 85 passed, 0 failed, no retries (3.6 minutes)** |
| git diff --check / new-file whitespace | **PASS**, no whitespace errors |

Validation uses the existing external .NET 10 SDK 10.0.403/runtime 10.0.14 and Node 24.22.2/npm 11.19.1 tools. Browser Development/Production hosts and integration tests use disposable SQLite/upload locations. No real workshop database/password/account was changed, no packages were upgraded, and no deployment was attempted.

## 10. Changed/new/removed files

Modified (21):

- `Backend/CarServiceShop/CarServiceShop.Tests/AppointmentsControllerTests.cs`
- `Backend/CarServiceShop/CarServiceShop.Tests/UsersControllerTests.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/AppointmentsController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/AuthController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/CustomersController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/JobPartsController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/PartsController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/SeedController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/ServiceJobsController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/SettingsController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/UsersController.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/VehicleController.cs`
- `Backend/CarServiceShop/CarServiceShop/Data/ApplicationDbContext.cs`
- `Backend/CarServiceShop/CarServiceShop/Data/InitialAdmin.cs`
- `Backend/CarServiceShop/CarServiceShop/Data/TestAdminRecovery.cs`
- `Backend/CarServiceShop/CarServiceShop/Migrations/ApplicationDbContextModelSnapshot.cs`
- `Backend/CarServiceShop/CarServiceShop/Program.cs`
- `Frontend/src/app/router.tsx`
- `Frontend/src/components/layout/AppShell.tsx`
- `Frontend/src/components/layout/Sidebar.tsx`
- `Frontend/tests/stage23.spec.ts`

New (12):

- `Backend/CarServiceShop/CarServiceShop.Tests/Stage3EAuditTests.cs`
- `Backend/CarServiceShop/CarServiceShop/Controllers/AuditController.cs`
- `Backend/CarServiceShop/CarServiceShop/Data/DesignTimeContextFactory.cs`
- `Backend/CarServiceShop/CarServiceShop/Migrations/20261101174037_AddAuditTrail.cs`
- `Backend/CarServiceShop/CarServiceShop/Migrations/20261101174037_AddAuditTrail.Designer.cs`
- `Backend/CarServiceShop/CarServiceShop/Models/AuditEvent.cs`
- `Backend/CarServiceShop/CarServiceShop/Security/AuditWriter.cs`
- `Frontend/src/components/Pages/Audit.tsx`
- `Frontend/src/components/Pages/audit.css`
- `Frontend/tests/stage3e.spec.ts`
- `AUDIT_TRAIL_OPERATIONS.md`
- `SECURITY_STAGE_3E_REPORT.md`

Removed tracked files: none. No unrelated recovery work was incorporated. The committed recovery command received only the audit append described above, not a recovery redesign or actual invocation against local business data. Generated test/build output remains ignored; no temporary tooling script was added to the repository. The four disposable browser database/upload/build-copy directories created by this stage's focused and final runs were removed after server shutdown, using verified absolute paths. Earlier local artifacts and real application data were preserved.

## 11. Warnings and practical limits

- Existing nullable warning CS8618 on `User.Role` remains; zero build errors. The new test analyzer warning observed during development was corrected.
- npm reports the same six moderate development-tool chain findings as Stage 3D, plus the ESLint deprecation/esbuild install-script notice. `npm audit --omit=dev --json` reports **zero production findings**. No forced dependency fix or upgrade was included. Browser tooling emits the existing NO_COLOR/FORCE_COLOR notice.
- Audit events are durable application records, not an external immutable store, signed hash chain, complete attempted-request log or monitoring system. A database/filesystem administrator can bypass application guards. Historical pre-migration activity is not backfilled. Future mutation code must use the writer; raw SQL/maintenance is not automatically inferred.
- Sampled failed-login writes are best effort; failures have a fixed safe server warning. Successful security/business mutations require their event; audit storage failure can therefore make writes/login unavailable. That fail-closed tradeoff is deliberate.
- SQLite serialized writes now include an extra bounded insert in the same transaction. Concurrent-writer and history/concurrency regressions are retained, but no high-load certification was performed. Offset paging can shift under concurrent new events; refresh/filtering is the normal recovery.
- File cleanup and database commit cannot be atomically coordinated; Stage 3D upload maintenance remains relevant. Retention is manual policy, not implemented automatic disk reclamation. Backups retain actor/resource history even after source-record deletion.
- Git line-ending conversion notices reflect existing repository settings. No container/Nginx configuration changed, so no new container execution claim is made.

## 12. Scope decision

**SEC-018: fully remediated within the requested application audit-trail scope. Security Stage 3E scoped gate: PASS.** Required regressions pass: 170 backend tests, 85 Chromium tests, restore/build, migration/model consistency, npm ci, strict TypeScript, production build and final whitespace checks. The deliberate sampling, retention and application-level immutability limitations are documented above; this is not an overall deployment/security certification.

No final security re-audit, production deployment, HTTPS/domain/certificate setup, monitoring platform, SIEM, provider migration or later stage was started. No commit/push was made. Work stops at Security Stage 3E.
