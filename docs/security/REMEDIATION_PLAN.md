# Phase 7A — Prioritized remediation plan

Baseline `8b6b7ad`, 2026-11-11. Phase 7A was audit-only; Phase 7B now implements the profile-image fix in this working tree. No destructive jobs or deployment changes were introduced. Findings, verified results and remaining limitations are in [GDPR_AUDIT.md](GDPR_AUDIT.md); fields and flows in [DATA_INVENTORY.md](DATA_INVENTORY.md).

Phase 7B application status: **GAP-01 completed and verified locally**. Retrieval is owner/admin-only for the current image; API and legacy URLs require live sessions and return no-store. The frontend fetches authenticated bytes and uses transient data URLs compatible with existing CSP. All 201 backend tests, frontend build and seven focused browser cases passed. The two formerly red privacy tests now pass without exclusions. Deployment/proxy verification remains a separately authorized operational step. GAP-09 observability and other P1 work below remain deferred; Phase 7B did not add retention or orphan-deletion jobs.

## Phase 7B — Immediate application security fixes

| Priority / owner | Concrete implementation | Acceptance evidence |
|---|---|---|
| P0 / backend + frontend — GAP-01 | Replace public profile-image serving with authenticated retrieval; decide owner/admin versus approved staff viewing; use safe generated basename mapping and no-store; frontend fetches authenticated blobs and clears them on session changes | Both `KnownPrivacyGap` tests turn green; anonymous, expired, revoked and deleted sessions fail GET/HEAD; disallowed other-user requests fail; authorized display/replacement works; no tokens in URLs; actual reverse-proxy path checked in separate deployment review |
| P1 / backend — GAP-09 | Report owned-image deletion failures without identifiers/paths in general logs; provide a bounded dry-run orphan report for operator review | Simulated IO/permission failure produces actionable non-PII signal; rollback still removes a newly written file on DB failure; no unrelated paths deleted |
| P1 / API + product owner — GAP-04 | Approve role/field matrix, then minimize customer data in dashboard/calendar/worksheet/lookup DTOs; add scoped policies only where the business requires them | Mechanic/admin matrix covers list/detail/history/search/print; DTOs contain only required fields; denied writes create no success audit; no client-only authorization |
| P1 / security owner — GAP-08 | Define bounded signals for access denials, suspicious bulk retrieval and export intent; preserve audit transaction/minimization rules | Synthetic identifiers, tokens and free text never enter diagnostic logs; required mutations still roll back on audit failure; volume bounded; authorized investigators can correlate events |

Re-check baseline differences when Phase 6D/6E merges; do not transplant or edit their deployment files here. Per the Phase 7B request, implementation remains uncommitted on the same isolated branch; no PR was created. The original failing assertions have been retained and now pass.

## Parallel operational verification — high-impact uncertainties

These items are prioritized because impact could be High, not because an exposed production service has been demonstrated. Assign the infrastructure owner to collect evidence in a separately authorized task; this audit does not authorize live access.

1. **RISK-02:** verify DB/uploads/backups ACLs, encryption at rest, off-host independent copies, recovery objectives, backup failure monitoring, key custody and authorized restore operators. Propose encryption/key separation and an independently recoverable copy where absent. Test recovery with fictional data and deliberate corruption; checksums alone are not authenticity protection.
2. **RISK-03:** design a restore-before-reopen gate that invalidates restored sessions and reconciles changed/deleted accounts and approved data-rights decisions. Test an old token, changed password, deleted account and deleted/restricted fictional customer against a restored snapshot. Document expiry of older backup sets and protected decision records. Never run a blanket deletion job to “repair” a restore.
3. Verify deployed TLS/proxy trust, logging categories and log retention, volume ownership, server snapshot policy, secret injection/rotation and release identity. Source configuration is not evidence that these controls are active. Keep deployment changes with the deployment owners/review, not this branch.
4. Establish workshop workstation lock policy, separate staff browser profiles, physical printer access, secure PDF delivery and download/paper disposal. Review staff profile-photo necessity and incident contacts.

## Phase 7C — Business and legal policy decisions before automation

| Decision | Accountable owner | Required deliverable |
|---|---|---|
| Purposes/lawful bases, fields and access scope | Controller + legal adviser + workshop lead | Approved inventory and role matrix; separate repair delivery, history, contact, employee and accounting purposes |
| Retention and holds | Controller + legal/accounting adviser | Category-specific periods/triggers, claim/accounting exceptions, review authority and treatment of ownership changes; no universal five/eight-year assumption |
| Rights handling | Controller's designated request owner | Intake channel, proportionate identity check, request tracking/deadlines, scoped search, reviewed disclosure/redaction, refusal/exception reasons and recipient follow-up |
| Export/restriction/correction | Product + controller | Definition of relevant customer/vehicle history, third-party data redaction, restricted-use behavior, corrected-document propagation and authorized delivery |
| Notice/processors/transfers | Controller + legal adviser | Approved accurate notice and actual processor/hosting/invoicing/backup arrangements; verify draft claims and external manual flows |
| Employee records/audit/privacy | Controller + security lead | Photo necessity, audit access and retention, staff transparency, proportionate incident detection and preservation |
| Incident readiness | Controller + security/operations | Escalation contacts, assessment/decision process, evidence preservation and notification responsibilities; legal assessment of applicable duties |

The [official GDPR text](https://eur-lex.europa.eu/eli/reg/2016/679) is the legal reference, not an assertion that technical work alone establishes compliance. Legal advisers should determine local retention rules and applicability of portability, objection, restriction, erasure exceptions and impact-assessment duties.

## Phase 7D — Implement approved rights and lifecycle capabilities

* Start with an **admin-reviewed subject export**, generated on demand from the selected identity and related records; redact other people's information, omit passwords/tokens/internal audit secrets, log minimal intent, use no-store and short-lived authorized delivery. A PDF worksheet is not a complete subject export. Test two unrelated fictional subjects and reused/changed vehicle owners.
* Add **restriction and hold controls** with explicit reasons/access rules and tests across all list, detail, print/export and write paths. Define permitted continued processing rather than equating restriction with deletion.
* Improve **rectification**, including vehicle identifiers/ownership and handling already-issued documents. Preserve necessary integrity and accountability without indiscriminately copying old personal values into logs.
* Implement **review-first retention** only after policy approval: inventory/dry-run counts and reasons, preview, authorized confirmation, exceptions/holds, audit evidence and recoverability decisions. No automatic purge is approved by Phase 7A.
* Design approved erasure/de-identification across relations and external copies, retaining only what is justified. Removing a customer FK is not anonymization when plate/VIN/notes still identify someone. Keep audit integrity and document justified residual personal data.
* Integrate approved backup expiry and restore reconciliation under operations change control; physical media/SQLite/WAL/snapshots require their own treatment. Do not promise immediate deletion from every historical backup without a feasible and approved process.

## Regression strategy and completion gates

Retain existing authentication, session boundary, authorization, upload, input/integrity, logging and backup tests. New backend tests use in-process Production hosts, random keys, fictional identities and temporary SQLite/upload roots; browser tests start disposable loopback fixtures. No real-data connection strings or deployed endpoints are used. Runtime changes are limited to protected image retrieval, response headers and frontend image loading.

Phase 7B exit: all 12 new privacy cases and existing backend suite pass, image delivery remains usable, frontend session/cache regressions pass, security-relevant logging remains bounded, and proxy behavior is separately validated. Phase 7C exit: named decision owners sign off inventory/policy/notice. Phase 7D exit: synthetic subject isolation, third-party redaction, hold/restriction, corrected data, approved deletion and restore-reconciliation scenarios pass, with operational evidence and human review. None of these gates alone is a legal compliance certificate.
