# Automatic TEST deployment from main

A push to protected `main` runs Workshop CI. After that run succeeds, the
dispatcher verifies the originating workflow, event, repository and full SHA
through GitHub’s API. It checks that SHA against the protected tip before the
`isolated-test` job and again after environment approval. The secret-bearing
job has no checkout, cache, or CI artifact inputs.

The dispatcher keeps the existing `TEST_DEPLOY_ENABLED` repository variable
and the host keeps its root-owned `actions-enabled` marker. Deployments share
the existing GitHub concurrency group and server lock. The server refuses
replays of a revision with a healthy journal. Keep those journals as deployment
records and resolve any `in-progress` state through the existing recovery
procedure before requesting another run.

## Activation prerequisites

1. Keep both activation gates closed during Gate C/D execution. Complete the
   separately approved TEST cutover and acceptance, verify recovery readiness
   and run the installed preflight. Gate D acceptance authenticates the
   previously reviewed helper bytes, so leave that helper installed through
   acceptance.
2. With the gates still closed, review and stage this PR’s root-owned
   `scripts/test_deploy.py` and `ops/test-deploy/ssh-gate` at the existing
   `/usr/local/sbin/carservice-test-deploy` and
   `/usr/local/sbin/carservice-test-ssh-gate` destinations. They derive from
   the reviewed post-cutover implementation at `e1afb2e`. Retain its
   preflight, storage helper, reviewed frozen Compose, native baseline,
   environment and backup paths. Verify installed bytes, run the installed
   preflight against accepted TEST, and verify refusal with the gates closed.
   Preserve the existing forced command, key restrictions and exact sudo rule
   for `carservice-test-ci`. The updated forced command accepts only
   `deploy-test main <40 lowercase hex>` and sends only the SHA to sudo.
3. Require protection on `main` and restrict the existing `isolated-test`
   environment to `main`, with its required reviewer protection. Verify
   `TEST_SSH_HOST` and the environment-scoped `TEST_DEPLOY_KEY` and
   `TEST_KNOWN_HOSTS` against the restricted account and independently
   verified host key. The fixed GitHub mirror must be able to fetch
   `refs/heads/main`, and the server’s separate read-only Actions credential
   must be able to verify Workshop CI.
4. Approve the first current `main` SHA after its Workshop CI push run is green.
   The root-owned, private `approved.json` must set `branch: main`,
   `revision` to that SHA and `storage_layout: test-root-v1`, and bind the
   existing baseline, frozen Compose and environment digests and the full
   ordered migration inventory. This exact per-release approval remains
   required for future pushes. Under separate activation authorization, open
   the server marker and set `TEST_DEPLOY_ENABLED` to `true`. If the first
   successful CI run completed with the gates closed, rerun **Workshop CI** for
   that original push while it is still the tip. Approve the environment only
   after the matching server approval and maintenance window are in place.

The server independently refetches the fixed `main` ref and checks exact tip
equality, commit type, activation, private approval and successful push CI
before building and again before stopping TEST. Coordinate branch changes
during the short deployment window after the final server-side tip check.
