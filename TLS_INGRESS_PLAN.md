# TLS ingress plan — design only

**Recommendation: Option A, host-level Caddy -> loopback frontend container.** One TLS edge/service and its protected certificate storage are sufficient for one VPS. Keep the existing application Compose network/private backend and loopback publication. A TLS container could also work, but adds certificate mounts/network trust changes with no demonstrated need here. Nothing in this document acquires a certificate, configures DNS or makes the current Nginx TLS-ready automatically.

## Required future traffic behavior

1. Real DNS points to the chosen VPS only after the isolated gates pass. Public TCP 80 serves only HTTPS redirect/ACME as appropriate; business requests use 443 HTTPS. Keep backend 8080 and frontend host 5173 non-public.
2. Caddy terminates TLS and proxies to `127.0.0.1:5173`. Use its supported automatic HTTPS/certificate renewal. Start HSTS only after valid HTTPS/renewal/redirects are proved; initially avoid includeSubDomains/preload. Caddy should own one consistent HSTS header for all SPA/API/upload/error responses.
3. Do not trust client-supplied Forwarded/X-Forwarded-* headers or enable arbitrary trusted proxies. With Caddy directly facing clients, its normal reverse-proxy forwarding behavior derives verified client/scheme and ignores spoofed incoming values. If another upstream proxy/CDN is ever added, redesign/test that trust first.

## Critical two-hop forwarding work still required

Current application Nginx uses `$scheme` and `$remote_addr`. Behind a host TLS edge forwarding HTTP, those describe the **inner** hop. Simply adding Caddy without adapting/verifying trusted forwarding would lose HTTPS/client identity and can collapse login throttling into a single proxy address. Do not deploy that incomplete topology.

Later, in a disposable Linux test first:

- Observe the actual immediate host-edge peer address seen by the Nginx container (often the Docker bridge gateway, not 127.0.0.1). Do not guess it or trust the whole private subnet.
- Configure Nginx real-IP handling for **only that verified immediate ingress address**, using the edge-sanitized X-Forwarded-For. Preserve the original peer (`$realip_remote_addr`) for trust decisions after real-IP rewriting.
- Derive a verified original scheme only when the original peer is the approved edge and the edge's sanitized proto value is exactly the expected HTTPS value. Unknown peers/values must not be upgraded to trusted HTTPS.
- Continue forwarding a single verified client address from Nginx to the API, not blindly appending an incoming arbitrary chain. Forward the verified scheme to the API. Backend trusts only frontend `172.30.90.3`, ForwardLimit=1; it should not separately trust the public internet/host CIDR.
- Keep direct host-loopback access as a trusted operator-only boundary: no untrusted local accounts/workloads should be able to inject forwarding headers. Backend network access remains private. A host compromise is outside header-based isolation.

No deployable Nginx/Caddy trust configuration is fabricated here because the actual host network/peer does not exist yet. This future adaptation is an explicit remaining go-live blocker, not an env toggle silently enabled in Stage 4A.

## Acceptance tests before enabling traffic

- Public HTTP redirects without sending credentials; HTTPS certificate/hostname/chain and renewal work. IPv4/IPv6 firewall/DNS agree.
- Backend observes Request.IsHttps on verified edge HTTPS; redirects do not loop, and HSTS appears once, only after the HTTPS policy is approved. SPA/API/401/403/413/500/uploads/print headers remain correct.
- Two controlled client addresses reach distinct source-based login limit partitions; spoofed X-Forwarded-For/proto from each client cannot choose an identity/scheme.
- A request directly to the private frontend/backend with an untrusted peer/header cannot become a trusted external client. Host 5173/8080 and SQLite data are unreachable publicly.
- Test login/session restoration, logout/revocation, normalized images, actual saved worksheet printing and audit under the final ingress CSP/origin.
- Healthchecks continue to work on intentional internal HTTP; do not break their loopback targets with blanket redirects.

Authoritative references: [Caddy reverse-proxy header behavior](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults), [automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Nginx real-IP module](https://nginx.org/en/docs/http/ngx_http_realip_module.html). Review the installed versions' behavior during actual validation. No real domain/certificate or public listener was configured in this stage.
