# Corrected Gate C implementation and focused verification

Status: local correction complete; NOT approved for VPS execution. No live VPS/Docker connection, container stop, source data read, migration, Gate D, deployment activation, package change, commit or PR was performed.

## Corrections

1. Recovery now requires a separately hashed JSON authorization with its own UTC validity window, approving decision-maker/authority, explicit safety attestations and tty approval. It binds the original Gate C approval fingerprint and is saved in a fresh exclusive root-private attempt journal before disruptive recovery actions. Original window expiration does not expire a valid new recovery authorization. Expired new authorizations still refuse. The verified launcher executes the same in-memory script bytes it authenticated.
2. Stopped metadata checks distinguish configured network intent from active endpoint fields. The exact independently inspected network ID/name/IPAM, static requested IP and configured network mode remain mandatory. Empty stopped NetworkID/IP/gateway are accepted only alongside that unchanged intent; nonempty contradictory values refuse. Running endpoints require the exact active values. Absent/stale stopped health does not prove liveness; running health remains mandatory for readiness. Transitional/restarting/paused/dead and auto-remove states refuse.
3. Recovery modes explicitly cover frontend-only, complete original capture and missing-capture fresh-quiesced verification. Fresh verification requires a separately approved expected migration list and continuous custody. Existing complete capture mismatches cannot be waived. An ambiguous stop requires explicit engine-settlement evidence; optionally quiescing remaining originals requires its own fresh-mode approval. No restart follows an exception automatically. Expiration after backend start prevents frontend startup until a new approved attempt.
4. Gate C refuses admission until a ready reviewed/fingerprinted Gate D package, verified/fingerprinted old-path recovery procedure and reviewed real disposable Docker report exist. A decision deadline prevents entering further capture phases indefinitely. Both C and D still need separate execution approval. Gate D preparation is supplied as a candidate, not falsely marked ready.
5. Exact images, source custody/identity checks, pinned storage-helper bytes, private exclusive journals, paired backup/scratch restore and complete history/count/upload comparisons are preserved. A dedicated operation flock serializes C/recovery. Duplicate JSON approval keys are refused. New templates retain false readiness/approval flags.

## Tests performed

- `python3 -I -B test_gate_c.py`: **32 tests PASS** on the final production-script bytes. Lifecycle tests use explicit synthetic Docker responses and fictional temporary files; no Docker tool/API is invoked. Fictional SQLite checks use real local SQLite. Unit tests explicitly adapt root-ownership/custody preconditions for unprivileged fixtures rather than changing production checks.
- Covered: stopped field retention/clearing, null/stale health, wrong ID/image/network/static address/publication, transition rejection, stop timeout intent/ambiguity, independent original/recovery windows, source capture absent/fresh mode, existing snapshot mismatch refusal, frontend-only no-source-read mode, explicit quiesce/start order, partial recovery expiration, exclusive attempt records, required Gate D/recovery readiness, exact implementation fingerprint in evidence, backup/restore failures and expiration during backup/verification. Expired C decision deadline does not affect an independently valid recovery authorization.
- Parsed all Python files; validated embedded operator shell snippets with `bash -n` and launcher Python with AST parsing. These checks did not execute the launcher or shell actions. Verified script fingerprint/byte count agree with the operator document and template booleans remain false.

PASS messages printed inside mocked tests are NOT evidence of VPS or real container operations.

## Tests not performed and concrete limitation

- No real Docker lifecycle test was run. Rootless tooling exists, but the sandbox rejected `unshare --user --map-root-user --net /usr/bin/true` with `Operation not permitted`. The shared daemon was not contacted and privilege/sandbox bypass was not attempted.
- `test_gate_c_docker.py` is prepared for an explicitly supplied, labelled, empty disposable daemon with a private test socket/data root and a preloaded immutable Python fixture image. It records actual stopped metadata, exercises real stop/start/recovery lifecycle calls and wrong-network/image/ID refusal while stopped. Source/custody prerequisites are mocked explicitly; it is not a full migration rehearsal. It has been syntax-checked, not real-Docker-executed here.
- Real Docker verification therefore remains an execution blocker: no hand-written/synthetic report may replace it. Its actual report must match final `gate-c.py` bytes and be accepted for the target Engine before Gate C approval.
- No privileged installation, production-source ownership verification, live capture/backup/restore/recovery, Windows/PowerShell execution, complete Gate D copy/cutover rehearsal or activation was performed. Existing accepted infrastructure/rehearsal evidence was retained, not rerun.

## Remaining execution inputs

The private old-path baseline/hash, TEST ingress close/verify/reopen method, custody plan and named operators, expanded-upload bound, approved windows/deadline and explicit C approval remain operator inputs. The ready Gate D execution package, verified recovery package and real disposable Docker report must be reviewed before setting readiness flags. Fresh recovery additionally needs the approved expected migration list/hash and a separately authenticated recovery decision. None are invented or automatically approved by these deliverables.

See `GATE-C-EXECUTION.md` for exact PowerShell → gta-test → interactive sudo procedures and all failure boundaries. See `GATE-D-PREPARATION.md` for the separate cutover preparation and its remaining implementation/approval inputs. `FILE-FINGERPRINTS.txt` lists exact SHA256/byte counts for every delivered file except the inventory itself.
