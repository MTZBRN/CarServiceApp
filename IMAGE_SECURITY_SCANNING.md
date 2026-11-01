# Image security scanning plan

No image scan was executed: Docker/Trivy are unavailable locally. npm/NuGet advisory results do not scan Ubuntu/Alpine/OpenSSL/native image libraries. Use a current supported Trivy build and refreshed vulnerability DB in the later isolated environment; verify scanner provenance and protect reports.

Build/pull the **reviewed release tags**, capture local image content IDs and available repository digests (locally built images may not have RepoDigests), base-image resolved digests, source commit, platform, scanner/version and scan date. Scan backend and frontend runtime images, including OS and application/library packages where detected; review native SQLite/Skia/Linux dependencies separately if scanner identification is incomplete.

Future command shape, in the protected operator environment:

```bash
# IMAGE_ID and PRIVATE_REPORT_DIR are explicit reviewed values, not secret text.
trivy image --scanners vuln,secret --format json \
  --output "$PRIVATE_REPORT_DIR/all-findings.json" "$IMAGE_ID"
trivy image --scanners vuln,secret --severity HIGH,CRITICAL --exit-code 1 \
  --format json --output "$PRIVATE_REPORT_DIR/high-critical-gate.json" "$IMAGE_ID"
```

Run each against **both** runtime image IDs with separate report names. Full reports retain lower severities; the second command is the blocking severity gate. A scanner error/stale DB/unsupported platform is not a pass. Do not use `--ignore-unfixed`, a blanket ignore file or silent severity suppression to manufacture success.

HIGH/CRITICAL findings block release until patched/rebuilt or a documented, time-bounded risk decision verifies false positive/non-applicability and mitigation with owner/review expiry. Review package version/backports, actual reachable feature, platform and attack preconditions using upstream/distribution advisories; scanner counts alone do not establish exploitability. Keep LOW/MEDIUM maintenance visible too, including the known dev-only lint chain. Secret findings require investigation/rotation if real, not publishing matched contents. Reports can contain sensitive matches; root-only storage, redacted sharing.

Rebuild/rescan after base-image/dependency/security changes and before go-live; retain the exact approved image IDs/digests for release/rollback. A clean historical report is not evidence for a newly resolved tag. Reference: [Trivy container image scanning](https://trivy.dev/docs/latest/target/container_image/).
