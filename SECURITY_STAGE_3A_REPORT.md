# Security Stage 3A — Production hardening

Scope: SEC-012, SEC-013, SEC-014, SEC-016 and SEC-019. Baseline: `fc0aac4`
(`Add concurrency guards and protect service history`). The working tree was clean before this
stage. No commit, deployment, domain/certificate setup, package upgrade or migration was performed.

## Working tree boundary and plan

The existing development-only recovery block in Program.cs, Data/TestAdminRecovery.cs and
CarServiceShop.Tests/TestAdminRecoveryTests.cs are already tracked in the baseline. They have no
Stage 3A edits. The Program.cs recovery block was compared directly with HEAD and is unchanged.
No unrelated uncommitted recovery work was present. Stage 3A tests do not use recovery.

The implementation plan was to inspect the baseline/configuration/tests; restrict Seed and CORS;
add compatible browser policies; enforce safe startup/errors and JWT scope; add direct integration
and Production browser coverage; then run the complete regression checks. Existing authorization,
password, upload, session, concurrency and history protections remain in place.

Tests use isolated SQLite databases, generated test keys and explicitly provisioned synthetic
accounts. The application database, real accounts and real uploads were not modified.

## SEC-012 — Seed

Outside Development, an MVC feature provider removes SeedController from controller discovery.
An additional fixed-environment middleware returns HTTP 404 for the `/api/Seed` path segment,
preventing the SPA fallback from returning a misleading successful document response. This applies
to Production and other non-Development environments, including Staging.

Production administrators cannot seed. Headers and query parameters cannot enable it. Tests verify
the controller is absent, requests return 404 and no customer/sample data is created.

In Development, the existing admin-only endpoint remains: administrator 200, mechanic 403,
anonymous 401. Environment selection is exclusively host configuration. There is no request switch
or remotely enabled feature flag. A dedicated Test environment also fails closed; tests needing
Seed deliberately create a Development host.

## SEC-013 — CORS

Production grants no cross-origin API access. The intended topology remains same-origin `/api`.
There is no AllowAnyOrigin, wildcard origin or credential grant.

Only Development grants these exact origins:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

Allowed methods: GET, HEAD, POST, PUT, DELETE. Allowed request headers: Authorization, Content-Type.
Credentials are not enabled. Other ports, protocols, hosts and websites receive no permissive
Access-Control-Allow-Origin response. CORS is a browser response policy; backend authentication
and authorization still apply independently. Tests verify an unauthenticated API request remains
401 even from an allowed origin.

## SEC-014 — Browser policies

Production CSP, exactly:

```text
default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'
```

The backend and Nginx static-document configuration use this policy. A source-consistency test
compares the Nginx CSP with the tested backend constant. External scripts, inline script handlers,
inline scripts, eval, object/embed, arbitrary connections and framing by other documents are denied.
Self frames support the application's print iframe.

The deliberate compatibility relaxation is inline CSS: React components/calendar use style
attributes and react-to-print copies/injects stylesheet content. No application page was redesigned
to replace these. Production does not permit unsafe-eval or unsafe-inline JavaScript. Raster profile
images and data-image previews work. Production Chromium coverage exercises login, uploaded-image
display, the saved worksheet preview and the actual print iframe, including its stylesheet rules
and computed print font, with no CSP violations. The test intercepts the browser's print dialog
only; application print-frame creation and styling still execute.

Development additionally permits inline script for Vite React refresh/Swagger and explicit local
API/image and HMR WebSocket endpoints. Vite sends the Development policy and other browser headers.
It does not permit unsafe-eval. Development relaxation is not used in the built Production SPA.

| Header/behavior | Policy |
|---|---|
| X-Frame-Options | DENY |
| CSP frame-ancestors | none |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | no-referrer |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=(), usb=() |
| API cache | Cache-Control: no-store, including authentication errors |
| Nginx static SPA cache | Cache-Control: no-cache |
| Nginx error-document cache | Cache-Control: no-store |
| HSTS | max-age=15552000 (180 days), HTTPS only, non-Development backend |

HSTS does not include subdomains or preload. ASP.NET's loopback exclusions remain. Forwarded HTTPS
is accepted only through the existing trusted-proxy configuration. Nginx's static policy emits HSTS
only when its own scheme is HTTPS; its current HTTP listener is unchanged. A future TLS termination
topology must deliberately preserve HTTPS semantics. No certificate or public HTTPS was configured.

The upload middleware retains its stricter `Content-Security-Policy: default-src 'none'; sandbox`
and nosniff. The generic backend policy never replaces an existing upload CSP. Nginx `/uploads/`
and `/api/` proxy responses retain their backend policies instead of adding a conflicting static
document CSP.

## SEC-016 — Startup and errors

The current Stage 2B migration call already propagates failure; no catch-and-continue block remains.
That behavior is preserved. Signing key and issuer/audience are validated before required database
migration and before Run/listening. Required provisioning/migration/upload-directory initialization
failures propagate; the app cannot continue into serving traffic. No broad startup redesign or
monitoring platform was introduced.

A direct startup test uses an invalid SQLite database target and confirms migration failure prevents
host creation. Mandatory configuration tests confirm invalid security configuration also prevents
host creation. Existing secure initial provisioning remains an explicit offline operation.

Central exception handling now returns sanitized HTTP 500 ProblemDetails with a generic title and
traceId, without exception messages, SQL, stack traces, request data or secrets. The response is
no-store and receives security headers. The same client-safe behavior applies in Development so
ordinary unexpected errors do not become diagnostic pages after an accidental environment change.

The handler logs only exception type and server trace identifier. The framework exception-handler
category's automatic exception logging is suppressed to avoid separately logging raw exception
messages. No sensitive-body logging, password/JWT/provisioning-secret logging or EF sensitive-data
logging was added. Tests inject a private marker in database/unexpected exception messages and
verify it appears in neither the response nor captured logs.

Controller validation/authorization/conflict behavior is unchanged. Dedicated regression assertions
cover 400 invalid input, 404 missing target, 409 protected relationship, 401 anonymous and 403 role
denial. Earlier validation/concurrency tests remain intact. Unexpected database failures become
sanitized 500 responses; known business conflicts keep their existing controlled client responses.

Development still intentionally enables Swagger and Seed. A host incorrectly configured as
Development is therefore not suitable for public service, even though error responses are sanitized.

## SEC-019 — JWT scope

Issuance explicitly sets issuer, audience and HS256. Validation explicitly requires:

- the configured issuer and audience;
- a signed token and the configured external signing key;
- HS256 only;
- an expiration and a valid lifetime, with zero clock skew;
- the existing database user, matching database role and SessionVersion.

Bearer failures omit authentication exception details. Deleted users, role changes, password/logout
revocation and stale session stamps retain their existing behavior. No refresh-token infrastructure,
key storage redesign or asymmetric signing was introduced.

Production and all non-Development environments require explicit `Jwt:Issuer` and `Jwt:Audience`.
Values must be nonblank absolute URI/URN identifiers, at most 256 characters, with no surrounding
whitespace. Obvious example/default/changeme/placeholder identifiers and the built-in Development
identifiers are rejected. Errors identify the invalid configuration field without printing its value.

Development alone supplies absent values as `urn:carserviceapp:development` and
`urn:carserviceapp:development-client`. Explicit blank/invalid values still fail. These identifiers
are nonsecret scope labels, not keys or credentials.

**Previously issued tokens without the new issuer/audience are invalid after this change. Existing
browser sessions must sign in again.** Signing-key management and the seven-day access-token lifetime
are otherwise unchanged. Changing the configured issuer/audience also invalidates tokens scoped to
the previous values.

## Configuration and frontend compatibility

Compose now requires external JWT_ISSUER and JWT_AUDIENCE values, mapped to Jwt__Issuer and
Jwt__Audience, in addition to its existing external JWT_KEY. No real key, credential or production
domain was committed. Operators must choose explicit scope identifiers; no public domain is required
to use URNs. Missing mandatory compose variables fail before service startup, with backend validation
as a second boundary.

appsettings.json and launchSettings.json were reviewed and remain unchanged. There is no
appsettings.Development.json in this repository. Launch profiles intentionally remain Development.
Frontend API configuration, page components and user workflows are unchanged.

The frontend Dockerfile only adds the new Nginx header include. Vite configuration adds development
headers. The Playwright harness adds a separate Production host on localhost:15232 using a copy of the
built SPA, an isolated database/upload root and explicit synthetic provisioning. The existing
Development host remains localhost:5232. No real database/server is needed for this coverage.

## Tests

New backend coverage comprises 30 test cases in Stage3ATests.cs:

- eight mandatory issuer/audience startup failures, including Development defaults in Production;
- migration failure prevents serving;
- Production Seed discovery/removal/no mutation and explicit Development role behavior;
- expected 400/404/409/401/403 behavior;
- Nginx/backend Production CSP source consistency;
- five environment/origin CORS cases, with independent authentication checks;
- document/API headers, sensitive caching and HTTPS-only HSTS;
- three sanitized error/logging cases, including database failure and Development;
- nine JWT cases: valid, wrong issuer, wrong audience, unsigned, HS384, expired, retired key,
  stale SessionVersion and missing expiration.

SecurityIntegrationTests.cs adds explicit test issuer/audience configuration and a disposable static
document. Existing expired/retired-key tests now include the correct scopes so they continue testing
their original failure reasons. Stage2ASecurityTests.cs similarly scopes its crafted stale/versionless
token. Upload replacement coverage adds an exact sandbox-CSP assertion. Existing assertions were not
weakened or removed.

One new Chromium test covers the built Production SPA and print behavior under CSP. The earlier
77 Chromium tests remain. No frontend permission or concurrency expectations were relaxed.

## Verification

Regression results:

| Check | Result |
|---|---|
| Backend tests | 120 passed, 0 failed, 0 skipped |
| Complete Chromium suite | 78 passed |
| Strict TypeScript | Passed |
| Frontend production build | Passed |
| Migration/model consistency | Passed in Stage2B migration-upgrade/HasPendingModelChanges tests; no schema/model changes |
| git diff --check | Passed |

Commands: `dotnet test Backend/CarServiceShop/CarServiceShop.Tests/CarServiceShop.Tests.csproj
--no-restore --nologo`; from Frontend, `npx playwright test --project=chromium`,
`npm run typecheck`, `npm run build`; from repository root, `git diff --check`.

An initial sandboxed backend rerun aborted before executing tests because the VSTest process could
not connect to its test host. The final run uses local test-host socket access. This is a test-runner
environment issue, not a failed application assertion.

## Changed/new/removed files

Modified:

- Backend/CarServiceShop/CarServiceShop/Program.cs
- Backend/CarServiceShop/CarServiceShop/Controllers/AuthController.cs
- Backend/CarServiceShop/CarServiceShop.Tests/SecurityIntegrationTests.cs
- Backend/CarServiceShop/CarServiceShop.Tests/Stage2ASecurityTests.cs
- Frontend/Dockerfile
- Frontend/nginx.conf
- Frontend/vite.config.ts
- Frontend/playwright.config.ts
- Frontend/scripts/start-test-backend.mjs
- docker-compose.yml

New:

- Backend/CarServiceShop/CarServiceShop/Security/ProductionHardening.cs
- Backend/CarServiceShop/CarServiceShop.Tests/Stage3ATests.cs
- Frontend/security-headers.conf
- Frontend/tests/stage3a.spec.ts
- SECURITY_STAGE_3A_REPORT.md

Removed: none. Migrations/model/schema changes: none. Recovery helper/test/block: unchanged.

## Warnings, limits and deferred scope

The pre-existing CS8618 warning on User.Role remains. Package/runtime versions were not changed;
SEC-015 review/upgrades remain deferred. No package was installed for this stage.

Docker and Nginx executables are unavailable locally. Container startup and `nginx -t` could not be
run. The configuration was inspected, its CSP is compared by automated test, and the same Production
policy was exercised in actual Chromium against the built SPA served by ASP.NET. This does not claim
runtime verification of Nginx itself. Real TLS/proxy termination and public HTTPS remain unverified
and outside this stage.

SEC-009 pagination/general quotas, SEC-015 dependency/runtime upgrades, SEC-017 broad repository/
container hygiene and SEC-018 audit trail are explicitly deferred. No Stage 3B, deployment, real
domain/certificate configuration, database-provider migration or unrelated feature work was started.

## Scoped gate

**Security Stage 3A scoped gate: PASS**, with the Nginx/container runtime verification limitation
documented above. Backend: 120/120; complete Chromium: 78/78; strict TypeScript, production build,
migration/model consistency and diff checks passed. This gate concerns only Security Stage 3A; it
is not an overall approval to expose the application publicly. The changes remain uncommitted for review.
