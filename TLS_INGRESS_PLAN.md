# Trusted HTTPS ingress

The production topology uses host Caddy on public TCP 80/443, loopback-published frontend Nginx and a private ASP.NET backend. Caddy serves the workshop hostname and handles certificate automation and HTTP-to-HTTPS redirects. The frontend and API share the public origin.

## Trust boundaries

- Caddy sets the private edge client and scheme headers from its socket peer and request scheme. The imported credential directive sets the private token on every upstream request. Setting these fields replaces client-supplied values. This topology assumes Caddy directly receives clients.
- Nginx matches the actual immediate peer address and the edge credential against an exact entry in a protected map. It requires an HTTPS scheme and a single valid IP. The private credential prevents other loopback clients that share the Docker gateway peer from claiming edge identity. Requests outside that trust boundary use the socket IP and inner scheme.
- Nginx replaces the standard forwarding pair on every API and upload route and removes the private edge fields before proxying. ASP.NET trusts only the configured frontend socket address, currently `172.30.90.3`, and consumes one symmetric pair before HSTS, authentication and rate limiting.
- The SPA and backend retain their existing HSTS policy and duration. Nginx uses the verified HTTPS scheme for SPA responses and ASP.NET applies its policy to API/upload responses. Caddy adds no duplicate HSTS header.

## Deployment inputs

1. Prove the actual immediate peer Nginx sees when Caddy connects to the published loopback port. Observe it during the isolated Linux rehearsal using Nginx's socket-peer access log. The bridge gateway is a candidate that must be measured. Use the exact address as logged. For IPv6, use the canonical address text without brackets or a port.
2. Generate one independent 32-byte random token as 64 hexadecimal characters on the target host. Keep the token out of shell tracing, Git, tickets and printed config. Both files below use the same token. These are syntax examples with unusable placeholders.

   ```nginx
   # /etc/carserviceapp/trusted-edge.conf
   "OBSERVED_PEER:EDGE_TOKEN_HEX" 1;
   ```

   ```caddyfile
   # /etc/caddy/carservice-edge-header.conf
   header_up X-CarService-Edge-Token EDGE_TOKEN_HEX
   ```

3. Place the map under the root-only `/etc/carserviceapp` directory. For the documented rootful Compose setup, use `root:101` and mode `0440` for the map so Nginx can read the read-only bind. Use `root:caddy` and mode `0640` for the Caddy snippet, with traversal limited to the service and administrators as appropriate. Verify the effective container identity and host permissions.
4. Apply `docker-compose.ingress.yml` after the base Compose file. It mounts only the Nginx map. The base image has an empty map for loopback staging. Keep both Compose files in the production command context for startup, upgrades and rollback.
5. Use `ingress/Caddyfile.example` as the dedicated host Caddy configuration. Replace the reserved hostname and match the loopback bind port. Its global options disable the admin API and config autosave to protect the imported credential. Validate protected configs without printing their effective contents. Coordinate Caddy restarts and frontend recreation during credential rotation.
6. Keep backend host ports unpublished. Configure only Nginx's private IP in `ReverseProxy__KnownProxies__0` and keep framework-wide forwarded-header auto-enabling off. Restrict privileged host access and access to the application bridge.

## Acceptance before public traffic

- Validate Linux Compose, the mounted file permissions, effective Caddy configuration and `nginx -t` in isolated staging. Verify the recorded immediate peer against the running topology.
- Verify real certificate issuance, hostname and renewal, HTTP redirect, firewall and IPv4/IPv6 reachability. Check that only the approved public listeners respond externally.
- Compare HTTPS SPA/API/upload responses and expected CSP, HSTS and other security headers. Confirm a single HSTS header on each intended HTTPS response and ordinary internal HTTP health checks.
- Use two controlled external client IPs and synthetic accounts to prove distinct login source limits. Try forged standard and private headers at the public edge and directly from an untrusted peer. Check that backend access stays private.
- Exercise same-origin login/session/logout, image upload and worksheet print through the final ingress.

References. [Caddy reverse proxy headers](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#headers) · [Caddy global options](https://caddyserver.com/docs/caddyfile/options) · [Nginx maps](https://nginx.org/en/docs/http/ngx_http_map_module.html) · [Nginx address parsing](https://nginx.org/en/docs/http/ngx_http_geo_module.html)
