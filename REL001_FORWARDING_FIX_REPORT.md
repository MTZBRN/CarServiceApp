# REL-001 trusted HTTPS forwarding

Baseline `805396725efcdf96f4a8db13626b9fd27fbc3ebc`. Verified on 2026-11-03. The pre-existing untracked pre-release report remains available as the record of the original finding.

## Root cause

Host Caddy terminates TLS and connects to Nginx over loopback HTTP. The previous Nginx configuration forwarded its own `$scheme` and `$remote_addr` to ASP.NET. In that topology the API saw HTTP and the immediate Docker peer. The login rate limiter could therefore pool unrelated clients under one source address. Passing incoming forwarding headers through would let clients choose their scheme and identity.

## Changes and trust design

1. **Caddy → Nginx.** The dedicated Caddy example sets the private client and scheme headers from the request socket and TLS scheme. A protected imported directive overwrites the private credential on each upstream request. The example disables the Caddy admin API and config autosave because the effective config contains the credential. [Caddy reverse-proxy headers](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers) · [Caddy global options](https://caddyserver.com/docs/caddyfile/options)
2. **Nginx verifies the edge.** `nginx.conf` matches the exact socket peer plus the credential in its protected map. It accepts an HTTPS claim only with one valid client IP from that hop. Otherwise it uses its socket peer and inner scheme. The credential is an additional check because multiple local processes can appear as the same bridge gateway address after Docker forwarding. [Nginx map matching](https://nginx.org/en/docs/http/ngx_http_map_module.html) · [Nginx address parsing](https://nginx.org/en/docs/http/ngx_http_geo_module.html)
3. **Nginx → ASP.NET.** The shared `proxy-headers.conf` replaces the standard forwarding pair for API, profile upload and uploaded-file routes. It removes the private fields and alternate forwarding headers before proxying. `Program.cs` replaces implicit loopback/network trust with the configured exact peers, requires a symmetric pair and retains a one-hop limit. Missing peer configuration disables header processing.
4. **Topology and headers.** The base Compose topology retains the loopback frontend publication, private backend and frontend IP `172.30.90.3` as the configured backend peer. The ingress overlay adds only a read-only map bind. The image has an empty map for base staging. Nginx applies its existing SPA HSTS duration using the verified scheme, and ASP.NET applies its existing API policy after forwarding. Same-origin requests continue through the frontend.

The changed runtime files are `Program.cs`, `Frontend/nginx.conf`, `Frontend/proxy-headers.conf`, `Frontend/Dockerfile`, `Frontend/.dockerignore`, `docker-compose.ingress.yml` and `ingress/Caddyfile.example`. The production architecture, deployment runbook and ingress plan now describe the two-hop configuration.

## Verification

| Check | Result |
| --- | --- |
| Complete backend xUnit suite | **172 passed, 0 failed, 0 skipped** |
| Strict TypeScript and Vite production build | **PASS** |
| Complete Chromium, retries disabled | **94 passed, 0 failed, 0 skipped** |
| Native Nginx config syntax and loopback chain | **PASS**, Nginx 1.30.6 and Caddy 2.11.7 with ASP.NET and synthetic TLS/data |
| Compose/topology assertions | **PASS**, static YAML including the ingress mount, exact backend peer, loopback publication and absent backend host port |
| `git diff --check` | **PASS** |

The backend tests exercise the configured immediate proxy, a neighboring address, a public test address, both loopback families and the disabled-forwarding configuration. The native test used an isolated local certificate, fresh database and temporary account. It verified an IPv6 client address through the trusted pair, rejection of forged or missing credentials, a correct credential from the wrong source, malformed and multi-address fields, and an invalid scheme. Direct API access from an untrusted loopback peer returned 401 and produced no HTTPS HSTS claim.

Through Caddy, one client logged in and received 429 on its second request even after changing spoofed addresses. Another actual socket IP logged in successfully under the same one-request limit. The SPA and API returned exactly one HSTS header each on the verified HTTPS path. The SPA retained its CSP and the authenticated same-origin API call succeeded. The temporary test used portable Windows proxy binaries, substituted loopback bindings and local paths, and exercised the repository's actual header rules. Docker networking and the RackForest ingress are separate operational checks.

Reproduce the proxy test after the backend Debug build and frontend production build with `python scripts/tests/check-forwarding.py --nginx <nginx> --caddy <caddy> --openssl <openssl>`. The executables can also be on PATH. The test starts only loopback processes and creates its own disposable certificate, credentials and data. [Backend test results](C:/CarServiceApp/rel001-tools/results/rel001.trx)

## Deployment requirements and remaining checks

- Measure the actual immediate peer at Nginx on the target Linux topology. Create the matching protected map and Caddy import as described in the ingress plan, and apply the ingress overlay after the base Compose file. Use the overlay consistently for production operations and coordinate credential rotation.
- Rehearse Linux Compose configuration, container health and file permissions, exact-peer identity and backend port isolation. Confirm the Caddy import and Nginx syntax without printing protected contents.
- On the authorized target, verify real DNS, the certificate and renewal, HTTPS redirect, single HSTS headers, external IPv4/IPv6 reachability and firewall behavior. Repeat the two-client throttling and spoofing probes and verify login, uploads and print through the public origin using synthetic records.

The forwarding implementation passed local verification. The public production gate still requires the target-host evidence above. [Ingress configuration and acceptance plan](C:/CarServiceApp/CarServiceApp/TLS_INGRESS_PLAN.md)
