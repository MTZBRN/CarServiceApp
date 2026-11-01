# Audit trail operations and retention

The application stores audit events in its existing SQLite database. Administrators can read `/audit` or `GET /api/Audit`; mechanics cannot. There are no application endpoints to create arbitrary events, change events, delete events or clear the log. Ordinary EF saves also reject modification/deletion of tracked audit records. This is application-level append-only history, not cryptographic tamper evidence against a database/filesystem administrator.

## Content and interpretation

Events include UTC time, server-resolved actor ID/name/role snapshot, action, resource type/ID, outcome, bounded details and server trace ID. A resource or actor ID remains after that record is deleted. Authenticated actor names reflect the authenticated session's name snapshot; login events use the resolved database account. A failed-login account is an attempted identity, not proof that the person owning that account made the attempt. Unknown-account attempts do not store the supplied identifier.

Details contain selected field names and operational scalar changes: completion state, labor amount, appointment dates/vehicle references, stock/prices, company hourly rate/VAT and account role. Customer names/contact values, vehicle registration/VIN values, worksheet/appointment descriptions, inventory text, passwords/hashes/tokens/session values, request bodies, uploaded names/bytes and secrets are not copied into details. Actor names and linked IDs are still personal/operational information; protect the database and backups accordingly.

Successful mutations have one event per business action, including worksheet edits with child-line replacement. Development seeding has one aggregate event. Existing initial provisioning and local development administrator recovery record a system event, not an invented authenticated user or a password. The recovery command's existing environment/interactive restrictions are unchanged.

Required database mutation/audit writes commit together. If required audit persistence fails, the mutation rolls back and the API returns a sanitized error. Successful login is audited before a token is returned. Profile-file creation/cleanup cannot share a SQLite transaction: the account reference and event commit together; existing failure cleanup and the upload maintenance procedure still apply to files.

Failed logins are sampled globally per application process: at most one/minute and twenty/hour, without an attacker-keyed cache. Existing login/source throttles still apply. Sampled-write failure is best effort, emits a fixed server warning without credentials, and preserves the generic login failure response. Throttle rejections, rejected business validation/authorization attempts and GETs are not a complete event stream. Never interpret absent events as proof that no attack was attempted. Restarting/multiplying processes resets/multiplies the sampling budget.

## Retention and growth

Recommended initial operating policy: retain **24 months** of online events, then review the business need before any archival/removal decision. This is a technical recommendation, not a legal retention conclusion. The implemented default is **indefinite retention**: no automatic deletion, archive job, clear button or retention migration exists.

Review database size and backup capacity periodically with the normal workshop maintenance process. Example planning assumption only: 200 successful business actions plus 20 successful logins/day, plus the worst-case 480 sampled login failures/day, gives about 700 events/day. At an assumed average 1 KiB/event this is about 250 MiB/year before index, SQLite-page and backup overhead. Actual sizes and use vary; this is not a measured storage guarantee. Metadata is capped at 2048 characters, actor name at 200, action at 64, resource type at 32, role/outcome at 16 and trace at 64. Each mutation adds a bounded row, but there is no total audit-table quota. Authenticated misuse can still grow business data and audit history.

If retention work becomes necessary:

1. Agree the retention scope with the workshop owner and obtain explicit authorization for archival/removal. This stage does not authorize deleting history.
2. Stop writes in a maintenance window and take a consistent, restorable SQLite backup using the established procedure. Include required sidecars or use SQLite's consistent backup facility. Keep the archive access-controlled like the active database.
3. Preserve complete events, IDs, UTC times and actor/resource relationships in the archive. Verify completeness and restore/read access before considering removals. Do not alter remaining event content or repurpose audit events as editable business records.
4. Plan any privileged maintenance against a copy first. The application deliberately offers no delete/edit API. Document authorized archival/removal externally and verify existing business records and log paging afterward.

Do not place database/archive exports in the public upload directory, source repository or container image. File-level access can bypass application authorization; retain the existing least-privilege storage/backup controls. No automatic cleanup or monitoring platform was introduced here.

## Querying

`GET /api/Audit` returns an array plus `X-Total-Count`, `X-Page`, `X-Page-Size`. Default page size is 50, maximum 100, pages 1–100000. Results sort by UTC timestamp descending, then ID descending. Filters are exact `actorId`, `action`, `resourceType`, `resourceId`, `outcome` (`Success`/`Failure`) and UTC `from`/`to` calendar dates (inclusive final day). Dates are bounded to 1900–2100; reversed ranges and invalid paging/filter values return 400. The endpoint uses the existing collection-read rate/concurrency policy and no-store responses.

The page loads on navigation/filter/page/retry; it is not a live monitoring feed. Refresh to see later activity. Current normal API writes must continue to use the audit writer when future features are added. Direct SQL, raw EF maintenance, historical data and external database tools are not automatically reconstructed or backfilled as application events.
