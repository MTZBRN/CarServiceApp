# Minimal monitoring and update plan

Design only; no collector, timer, alert integration or monitoring platform was installed. A small workshop needs clear ownership and tested alerts, not a SIEM stack.

| Signal | Initial operating check / action |
| --- | --- |
| HTTP/app availability | Local health/status checks every few minutes plus a later independent external HTTPS probe; alert on consecutive failures/unhealthy/restart loops. `/healthz` is liveness, not continuous DB-write proof. |
| HTTP 5xx | Review/alert on sustained or repeated failures, sanitized API errors and proxy upstream errors; correlate server trace IDs, not request bodies. |
| Authentication abuse | Review source throttling/429s and sampled failed-login audit indications; samples are intentionally incomplete. Investigate unusual locations/volume with trusted proxy identity. No password/token logging. |
| Disk/capacity | Monitor filesystem/inodes, DB/WAL, uploads, local backups, Docker layers/build cache and temp usage daily; initial warning around 70%, urgent at 85% or insufficient backup/upgrade headroom, tuned from actual measurements. |
| Backup | Per-run success, completion age (alert >26h for daily schedule), offsite snapshot age/checks and failed-transfer alerts. Partial/local-only artifacts are not offsite success. |
| Certificates | Renewal error and expiry checks with advance alert (e.g. <21 days); test notification delivery. |
| Host/container | OS disk/OOM/kernel errors, service restart/unhealthy state and resource saturation; health transitions do not automatically repair/notify on their own. |
| Audit/uploads | Capacity/retention review, managed storage 507/429 and cleanup failures; no automatic audit deletion or arbitrary orphan pruning. |

Start with system service timers/journal, Docker health/status/log review, disk/backup checks and one reliable notification route selected by the workshop owner. Test an alert failure/recovery path before go-live. No notification was sent or external account configured in Stage 4A.

## Log privacy and retention

Keep JWTs, Authorization headers, signing/provisioning secrets, passwords/hashes and request bodies out of all logs. Keep shell xtrace off and do not save expanded production Compose/environment output. Existing application error/audit minimization remains; proxy logging must avoid authentication/query/body dumps. Treat access logs as sensitive (IP/URL can identify activity).

Select/test Docker log rotation and host journald retention later (initial concept: bounded files/roughly 14–30 days for operational logs depending on capacity; separate incident preservation). No rotation setting is silently applied here. Audit retention is separately recommended at 24 months, currently indefinite in code; see AUDIT_TRAIL_OPERATIONS.md. Offsite data/secret backups have their own protected retention. Assign a human owner for alert acknowledgement and incident recovery.

## Maintenance cadence and update procedure

- Daily automated health/backup/capacity/certificate checks; operator checks alerts promptly.
- Weekly short review of backup age/offsite status, errors, restart/abuse indicators and available security updates.
- Monthly planned maintenance window: review OS/Docker/Caddy releases, dependencies/base images and known advisories; refresh scans/rebuilds and verify restore capability. Critical exploited issues require expedited review rather than waiting a month.
- Quarterly full isolated offsite restore/application drill; repeat before important schema upgrades and after meaningful backup/host changes.

For each application update: select/review commit and migration diff -> full local/staging regressions -> tagged image build and scan -> protected pre-upgrade paired backup -> maintenance traffic stop/single writer -> candidate startup migration -> health plus business/security/print smoke tests -> explicit release decision -> watch signals. Preserve previous source/image IDs/paired backup. If failed, stop candidate/preserve diagnostics and follow reviewed rollback/restore procedure; never reset data or run blind down-migrations. Do not deploy unattended application upgrades or auto-pull mutable tags. OS security automation, if chosen later, must account for reboot/service downtime and a recovery window. No packages/OS/services were upgraded by this preparation.
