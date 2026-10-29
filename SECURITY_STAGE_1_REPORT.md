# Security Stage 1 — P0 remediation

Baseline: committed post-Stage-2.7 `106d841`. Scope: SEC-001 through SEC-005 only.
No deployment, database-provider change, migration creation or Git history rewrite.

## Implementation

### SEC-001 — external JWT signing material

Removed literal signing keys from appsettings.json and Compose. Every environment now requires
`Jwt__Key` supplied externally: base64 encoding of at least 32 random bytes. Startup rejects
missing, blank, malformed, short, low-diversity and obvious example/default values. Generate
48 random bytes using a cryptographic generator; never choose a sentence/passphrase.
HS256, current identity/role claims, seven-day lifetime and database user/role validation remain.
The signing and validation paths both decode the external base64 key.

Historical exposed keys are compromised. Any existing deployment must rotate them externally;
this change does not rotate a running deployment or remove historical values from Git. Existing
tokens issued with the old keys become invalid when the new configuration is activated.

Local development also requires an external key. For a disposable PowerShell development session:

```powershell
$env:Jwt__Key = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Do not print or commit this value. Use persistent external secret storage for an actual installation;
generating a different key on every production restart would invalidate all sessions.

### SEC-002 — explicit initial-admin provisioning

Removed DbSeeder and fixed-password automatic account creation. Ordinary startup migrates the
configured SQLite database but never creates a user, even when provisioning variables are present.
There is no development fallback account. Existing user/account data is not changed by this patch.

Provision an initial administrator as a separate operator action with the web process stopped:

1. Select the correct database using an absolute `ConnectionStrings__DefaultConnection` path.
2. Supply the external `Jwt__Key`, `InitialAdmin__Email`, and `InitialAdmin__Password` securely.
3. Run `dotnet CarServiceShop.dll --provision-admin` from the published application directory.
4. Remove the InitialAdmin variables from the process environment/secret injection afterwards.
5. Start the ordinary web process without the provisioning flag.

The command exits without starting an HTTP listener. Required missing/weak values fail the command.
Only the BCrypt hash is stored. Provisioning checks the user store inside a transaction: any existing
account makes it a no-op; existing accounts/admins/hashes are never overwritten. Run only one
provisioning command at a time. Repeating it against an initialized database is harmless. Deliberately
running the command against a newly emptied/different database can initialize that database; normal
startup cannot. Back up/select the intended database carefully. No plaintext password is logged.

This intentionally removes the old predictable login on a fresh database. Normal admin API user
creation is preserved. Existing weak passwords are not silently changed.

### SEC-003 — raster-only profile uploads

PNG and JPEG only, requiring an allowed MIME plus successful content decoding. Original names and
extensions do not control storage. SkiaSharp decodes at most 2048 by 2048 pixels, rejects multiple
frames and incomplete decoding, and re-encodes pixels as PNG without original active payloads or
metadata. Upload files are limited to 2 MiB, with a small HTTP multipart-envelope allowance.
Stored names contain the authenticated user's ID and a GUID, always ending in `.png`.

Validation completes before creating a file. A failed database save removes the newly created file.
Replacements are serialized within the single application process; after a successful save the previous
owned raster basename is deleted. Deletion accepts only a generated basename belonging to the user,
never a path. No multi-instance upload lifecycle guarantee is claimed.

Public uploads are restricted to generated raster filenames, including legacy timestamp names.
Old HTML/SVG/JS/executable upload paths are blocked regardless of whether files remain on disk.
Upload responses use `nosniff` and a restrictive sandbox CSP. Existing legacy raster images continue
to work. Historical non-raster orphan cleanup is deferred; do not restore general-purpose serving.

Added SkiaSharp and its Linux native assets at 4.153.1. A maintained cross-platform decoder is needed
to reject malformed images and safely re-encode, rather than attempting a handwritten PNG/JPEG
validator. Native assets increase artifact size and require container-platform verification. No broad
dependency upgrades were made; the new packages are not flagged by the vulnerability check.

### SEC-004 — application/proxy readiness

Forwarded-header middleware runs before rate limiting and HTTPS redirection. It processes one hop
of X-Forwarded-For and X-Forwarded-Proto, preserving default loopback trust and adding only explicit
`ReverseProxy__KnownProxies__0`, `__1`, etc. addresses. Arbitrary forwarding headers are not trusted.

Compose no longer publishes the backend. It uses a dedicated subnet with backend `172.30.90.2` and
Nginx `172.30.90.3`; only the Nginx address is added as a trusted proxy. The frontend HTTP binding is
`127.0.0.1:5173`, so this configuration does not expose a public HTTP service. Check for subnet conflicts
before use. Ordinary localhost dotnet/Vite development remains separate and unchanged in topology.

Nginx overwrites forwarded headers using its observed client and scheme; it does not relay arbitrary
browser-supplied headers. **Actual HTTPS remains a deployment requirement.** The supplied Nginx
listener is still HTTP. A later deployment must terminate TLS in Nginx or configure a specific trusted
upstream TLS terminator and safely propagate its scheme/client address. Blindly trusting incoming
X-Forwarded-* headers would enable spoofing and undermine source throttling. An extra ingress hop
requires corresponding trust/hop configuration; this stage does not configure that future topology.

Do not expose the backend directly. Do not infer TLS from UseHttpsRedirection. Validate certificates,
redirects, trusted scheme/client-IP propagation and absence of alternate HTTP ingress before exposure.
Docker/Nginx runtime validation was unavailable because Docker is not installed on this host.

### SEC-005 — login abuse and password safety

Login: 30 requests/source/minute by default, no queue; bounded 8192 account-counter stripes with
10 attempts/account/minute and at most four concurrent BCrypt operations process-wide. Account
counters expire after a minute; successful verification resets that account's count. No permanent
lockout exists. Hash stripes can rarely share a counter. Limits are process-local: multiple replicas
would require coordinated enforcement and are outside this single-instance stage.

`Login__SourcePermitLimit` can tune source capacity (clamped to 1–1000). Keep the default for the small
workshop unless justified. The isolated browser regression server explicitly uses 1000 so 74 accelerated
workflow tests can share localhost; security integration tests use the production default and assert
throttling. Account and global controls remain enabled for both. Login HTTP bodies are capped at 4 KiB.

Missing user and wrong password return the same 401 message. Missing-user requests perform a
BCrypt verification against a process-random dummy hash. No claim of perfectly constant network
timing is made across legacy BCrypt work factors. Oversized login passwords are rejected before hashing.

All user creation, password changes and initial provisioning enforce the same policy: nonblank,
at least 12 Unicode scalar characters, at most 72 UTF-8 bytes, no arbitrary composition rules. BCrypt
is preserved. Login still accepts existing short passwords so existing accounts are not silently broken;
new or changed passwords must satisfy the policy. Existing business roles/authorization are preserved.

## Regression coverage and validation

SecurityIntegrationTests uses Production configuration, fresh random keys and disposable SQLite/upload
directories. It exercises HTTP routing, authentication, admin authorization, login/source throttling,
uniform failures, invalid-password writes, multipart uploads, public serving, image replacement and
negative cases. Additional tests cover startup key failure, provisioning idempotence/no account on
ordinary startup, credential-free logs, UTF-8 boundaries, dimensions, safe deletion and actual trusted/
untrusted forwarded-header middleware behavior.

Existing browser tests retain their assertions and workflows. Fixture passwords were lengthened;
the runner now explicitly provisions its disposable administrator with a fresh per-run key. The expired
token test signs with that per-run key instead of reading repository secrets. Failure text assertions
now expect the generic response. A malformed PNG fixture was replaced with a valid CRC-correct PNG.
The calendar locator now selects the exact navigation link instead of also matching a dashboard link.

Final validation:

- Backend suite: 28 passed, zero failed/skipped (17 new security cases plus 11 existing cases).
- Complete Chromium suite: 74 passed, zero failed/skipped; final run 2.6 minutes.
- Strict TypeScript check and frontend production build: passed.
- `git diff --check`: passed.
- Historical committed-key token: safely checked against the disposable HTTP server; rejected with 401.
- Compose YAML parsing and assertions for internal backend, loopback frontend and external key: passed.
- Current runtime configuration signing-literal scan: passed.
- NuGet vulnerability check: new SkiaSharp packages were not flagged; the five previously reported
  transitive package findings remain deferred.

The expired-token browser regression also verifies that the fixture key reproduces the original
server signature before generating the expired token, so it exercises expiration rather than an
unrelated signature failure. The test key is inherited consistently by browser workers and the server.

P0 code/configuration gate: PASS for the scoped implementation and automated verification.
Production deployment is not verified. Docker is unavailable, so Linux native image decoding and
the Nginx/container topology require release-environment verification before deployment approval.
The existing User.Role nullable warning, Git line-ending notices and existing dependency advisories
remain. No application-data migration was added and no real workshop database was used for tests.

## Changed files

Backend: Program.cs; appsettings.json; CarServiceShop.csproj; Controllers/AuthController.cs;
Controllers/UsersController.cs; new Security/SecurityRules.cs, Security/LoginThrottle.cs,
Security/ProfileImages.cs and Data/InitialAdmin.cs. Removed Data/DbSeeder.cs.

Tests: backend test project and new SecurityIntegrationTests.cs; Frontend/playwright.config.ts;
Frontend/scripts/start-test-backend.mjs; browser specs full-workflow, login, routing, stage1,
stage22, stage23, stage24, stage25, stage26, stage27. Infrastructure: docker-compose.yml and
Frontend/nginx.conf. Documentation: this report.

## Deferred scope and gates

SEC-006 session revocation; SEC-007 entity binding; SEC-008 business validation; SEC-009 general
quotas/pagination; SEC-010 concurrency/uniqueness; SEC-011 destructive permissions/history;
SEC-012 production Seed; SEC-013 CORS; SEC-014 general headers; SEC-015 broad dependency/runtime
updates; SEC-016 general startup/errors; SEC-017 broad hygiene; SEC-018 audit trails; SEC-019 JWT
issuer/audience policy. Only necessary P0 dependencies were touched: provisioning failures propagate,
upload-specific headers/serialization/limits, trusted source handling and image-decoding dependencies.

Historical secrets still require external deployment rotation. No real credentials, data or deployment
were changed. Passing the P0 code/configuration gate does not satisfy the remaining P1 business-data
gate. Internet exposure remains blocked until actual TLS ingress and deployment behavior are verified.
