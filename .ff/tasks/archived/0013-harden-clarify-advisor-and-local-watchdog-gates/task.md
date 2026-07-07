# Task

## Implementation
- [x] Add a deterministic clarify gate module that validates required events, proposal identity, freshness, advisor review or degradation evidence, concern/blocker handling, and gate stage without model calls.
- [x] Extend trace event recording so clarify gate events can carry structured identity data such as `attempt_id`, `proposal_id`, proposal hash, advisor harness, failure reason, and fallback checklist result.
- [x] Add an internal CLI validator command for clarify attempts that returns structured errors and a non-zero exit code on failure.
- [x] Update `runClarify` so `cw clarify --goal ...` without explicit accept cannot write `spec.md` or advance to plan.
- [x] Add the explicit accept path for `runClarify` and require the deterministic validator before writing `spec.md` or moving to plan.
- [x] Update generated `cw-clarify` guidance with Brainstorm Pass, Grill Loop, Proposed Spec, advisor review, concern/blocker handling, explicit accept, and no `clarify.md`.
- [x] Update advisor role guidance so clarify review targets the current Proposed Spec and cannot ask the user, edit files, accept spec, or move phase.
- [x] Add local watchdog artifacts for Codex, Cursor, Claude, OpenCode, and Pi that call the deterministic validator.
- [x] Keep Codex watchdog implementation lightweight and local; do not add app-server watcher, persistent service, event subscriber, or OMP runtime machinery.
- [x] Add explicit degraded execution guidance for environments where a local harness hook or advisor invocation is unavailable.
- [x] Update `DESIGN.md` with clarify-specific gate/watchdog behavior without rewriting the 0011 orchestration contract.
- [x] Regenerate relevant harness artifacts from adapter source.

## Verification
- [x] Test clarify gate success and failure cases: missing events, out-of-order events, stale events, mismatched proposal identity, advisor unavailable evidence, concern handling, blocker handling, and override handling.
- [x] Test `cw clarify --goal ...` without explicit accept leaves `spec.md` unchanged and does not advance to plan.
- [x] Test the explicit accept path writes `spec.md` only when the validator passes.
- [x] Test generated `cw-clarify` guidance includes the accepted sequence and Brainstorm Pass output requirements.
- [x] Test generated guidance and role agents preserve advisor authority boundaries.
- [x] Test local watchdog artifacts exist for Codex, Cursor, Claude, OpenCode, and Pi and invoke the deterministic validator.
- [x] Test generated docs and artifacts describe only local Cursor execution.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded.
- [x] Behavior review confirms generated clarify guidance would not let an agent skip brainstorm, grill, advisor review, concern/blocker handling, explicit accept, or validator evidence.
- [x] Behavior review confirms local watchdogs enforce the deterministic gate at write/phase boundaries and only warn during intermediate clarify work.
- [x] Behavior review confirms 0011 orchestration behavior was extended only where clarify-specific correctness requires it.

## Notes
- Existing dirty worktree entries from 0012 touch shared generated skills and source files. Work with those changes and do not revert them.
- Planning discovered reusable workflow facts for possible baseline handling: clarify correctness belongs in deterministic CW gates first, and local watchdogs should call a shared validator rather than each carrying separate gate logic.
- Run-stage implementation created `baseline-delta.md` with reusable workflow facts for finish-time baseline handling.
- Git status contains unrelated staged deletions and ignore-rule changes outside 0013, including `DESIGN.md` being staged for deletion while still present in the working tree. Do not resolve those from this task without user confirmation.
- Check evidence: `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, and `node dist/src/cli.js doctor --root .` all passed.
- Check evidence: local-only Cursor wording scan returned no matches in the 0013 task, DESIGN, source, tests, and generated harness artifacts.
- Artifact alignment review found the spec acceptance criteria covered by `src/clarify-gate.ts`, `src/workflow.ts`, `src/cli.ts`, `src/adapters.ts`, `src/validate.ts`, generated local watchdog artifacts, and `tests/kernel.test.ts`.
- Dirty worktree handling: 0013 changes are covered by verification; unrelated staged deletions, ignore-rule changes, historical OpenSpec deletions, and the untracked 0014 task remain outside this check.
- Baseline Outcome: `baseline-delta.md` is present and contains reusable workflow facts for finish-time baseline handling.
