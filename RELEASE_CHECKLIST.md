# Production release decision checklist

Every box is intentionally **unchecked**: preparation documents and local tests are not future VPS evidence. Record operator, date, release SHA/image IDs and links to protected verification results. Do not publish secrets/customer data in evidence.

## Source and images

- [ ] Clean intended commit/tag; reviewed FINAL-001 correction/regression included; no accidental local/test files.
- [ ] Backend/full Chromium, strict TypeScript, production build and migration/model checks green for this release.
- [ ] Current package and actual runtime image scans reviewed; HIGH/CRITICAL gate resolved; dev lint warning tracked.
- [ ] Both immutable image IDs/base digests recorded and previous release images retained.

## Security and ingress

- [ ] Production environment/key/issuer/audience external and valid; no template/test secrets; no long-lived initial-admin password.
- [ ] Development disabled; Seed unavailable; Swagger not exposed; backend has no public host port.
- [ ] Host firewall IPv4/IPv6/SSH recovery verified; frontend remains loopback behind the sole approved edge.
- [ ] Actual TLS hostname/chain/renewal/HTTP redirect/HSTS approved and verified.
- [ ] Trusted two-hop scheme/client-IP handling and spoofed-header rejection verified; login source partitions distinguish clients.
- [ ] CSP/security/upload headers and actual saved worksheet print verified through final ingress.
- [ ] Non-root/read-only/capability/no-new-privileges/tmpfs/resource/mount controls verified on the actual engine.

## Data and recovery

- [ ] Correct persistent DB/upload paths, owners/permissions, free space and no unexpected links/writers.
- [ ] Single backend writer; migration rehearsal on a restored copy; no destructive reset/down-migration.
- [ ] Fresh paired backup exists, checksums/integrity/files verified; offsite encrypted copy retrievable.
- [ ] Actual offsite restore/application drill succeeds; release/secret recovery information accessible to authorized operators.
- [ ] Initial admin explicitly provisioned/verified; safe account inventory, personal mechanic roles; no defaults/test accounts.
- [ ] Audit/upload/backup retention and capacity ownership assigned; data copied/imported only after these gates.

## Application trial (synthetic first)

- [ ] Login, session restoration, logout/password revocation; anonymous/mechanic/admin restrictions.
- [ ] Customer/vehicle create/search/paging and protected deletion behavior.
- [ ] Calendar date ranges, appointment edits and linked worksheet rules.
- [ ] Worksheet line/labor totals, direct append bounds, save/concurrency, completion/admin reopen/history/print.
- [ ] Inventory selection retains snapshots and does not auto-consume stock; protected delete.
- [ ] Normalized upload/quota/serving/replacement and restart persistence.
- [ ] Company settings including zero rate/VAT, users and admin-only audit read/events.

## Operations and explicit go-live

- [ ] Health, HTTP 5xx, restart/unhealthy, disk/inodes, DB/upload/backup growth and auth-abuse indications monitored.
- [ ] Backup success/failure/offsite age and certificate-expiry alerts actually delivered/tested.
- [ ] Log privacy/rotation, patch window, rollback, incident contact and restore owner agreed.
- [ ] Quiet-window backup stop/start automation tested for both success and failure.
- [ ] Separate operator release approval recorded; public access remains closed until all blocking checks pass.
