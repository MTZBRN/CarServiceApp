# Future single-VPS hardening checklist

Preparation only. No firewall, SSH daemon or host service was changed here.

- [ ] Choose a supported Linux release; install OS security updates and verify time sync before Docker/data use.
- [ ] Create a named administrative/deployment user and use unique SSH keys (passphrase/hardware-backed where practical). Docker access is root-equivalent; do not casually add users to the docker group.
- [ ] Keep provider console/recovery access. Confirm a second key-based SSH session works **before** disabling password/root login or changing firewall rules. Disable direct root SSH and password SSH after that test; use controlled sudo for reviewed operations.
- [ ] Prefer management IP/VPN restrictions for SSH where practical. If SSH must be public, protect keys, limit sources/abuse and monitor failed authentication. Do not lock out recovery access.
- [ ] Default-deny unsolicited inbound traffic. Allow approved SSH TCP 22 (or the deliberately chosen management port), TCP 80 for redirect/ACME and TCP 443 for HTTPS. Do not open UDP 443 unless HTTP/3 is separately chosen/tested.
- [ ] Do not allow public 5173, 5232, 7214, 8080, Docker API 2375/2376, DB shares, development services, backup repositories or metrics/admin ports. SQLite has no network listener.
- [ ] Verify IPv6 rules as well as IPv4. Test from outside later; a host GUI rule alone is not proof of Docker port isolation. Keep the Compose frontend bind fixed to 127.0.0.1 and publish no backend port.
- [ ] Inspect Docker's effective packet filtering and actual listeners (`ss -lntup`, reviewed engine/container port metadata); Docker-managed forwarding can differ from a host firewall's ordinary input rules.
- [ ] Keep source/config root-owned and non-writable to application UID. Data/uploads only for 1654; backups/config root-only. Check symlinks, mount owners and disk capacity; never chmod 777.
- [ ] Protect Docker daemon socket and Caddy administrative endpoint; neither should be public. Do not expose socket mounts inside application containers.
- [ ] Preserve read-only rootfs, capability drops, no-new-privileges, tmpfs and service limits. Validate effective settings on Linux before relying on them.
- [ ] Keep secrets out of shell history/tracing, unredacted Compose output, logs, tickets and images. Lock down `/etc/carserviceapp` and backup/offsite credentials.
- [ ] Verify provider console, host firewall, trusted forwarding/TLS, offsite backup/restore and basic alert delivery before go-live.

This is an intended rule set and access policy, not a ready-to-run firewall script. Choose commands for the actual distribution/management network later, with recovery access tested first.
