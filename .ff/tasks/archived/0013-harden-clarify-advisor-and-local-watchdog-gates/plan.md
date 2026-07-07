# Plan

## Approach

Implement 0013 as a narrow follow-up to 0011. Keep the existing role-agent and model profile system intact, then add clarify-specific gates, trace identity, and local watchdog artifacts on top.

1. Add a deterministic clarify gate module.
   - Define the required clarify attempt events: `brainstorm.done`, `spec.proposed`, `advisor.reviewed` or `advisor.unavailable`, and `spec.accepted`.
   - Require shared proposal identity through `attempt_id` plus `proposal_id`, or an equivalent proposal hash.
   - Validate event order, freshness, advisor evidence, accepted proposal identity, and gate stage.
   - Return structured errors and avoid model calls.

2. Expose the gate through CLI/kernel seams.
   - Add a local internal validator command that reads task state, trace, and proposal identity.
   - Extend trace writing enough to record structured clarify event data.
   - Change `runClarify` so `cw clarify --goal ...` cannot write `spec.md` or advance to plan unless explicit accept and validator checks pass.
   - Keep manual, skill-driven spec edits possible, but require generated guidance and watchdog validation before plan/run progress.

3. Strengthen generated `cw-clarify` guidance.
   - Replace the current challenge-pass wording with the accepted fixed sequence: Brainstorm Pass -> Grill Loop -> Proposed Spec -> advisor review -> concern/blocker handling -> explicit accept -> write `spec.md`.
   - Specify Brainstorm Pass outputs, Open Decisions, advisor fallback evidence, inline checklist shape, and `concern`/`blocker` handling.
   - Keep `spec.md` as the only long-lived clarify artifact.

4. Add local watchdog artifacts through harness adapters.
   - Generate or refresh local hook/watchdog surfaces for Codex, Cursor, Claude, OpenCode, and Pi.
   - Make each surface call the same deterministic validator rather than duplicating gate logic.
   - Use Codex's lightweight local Stop-hook style path only. Do not add app-server watchers, persistent services, event subscribers, or OMP runtime machinery.
   - For harnesses where the local hook surface is absent or not installed in the user's environment, generate an explicit degraded path that points to the validator command and records the degradation.

5. Update design and tests.
   - Add a clarify-specific section to `DESIGN.md` without rewriting the 0011 orchestration contract.
   - Cover generated guidance, CLI/kernel accept gate, structured trace data, validator errors, local watchdog artifacts, Codex simplicity, Pi fallback, and Cursor local-only wording.
   - Regenerate relevant harness artifacts from adapter source.

## Key Decisions

- The source of correctness is CW's deterministic gate; hook/watchdog surfaces are local enforcement points that call that gate.
- `cw clarify --goal ...` without explicit accept produces proposal/blocked state only. It does not write `spec.md` and does not move to plan.
- The implementation may use `--confirm`, an internal helper, or equivalent state token for explicit accept, but tests must prove the default path cannot bypass the gate.
- Trace events used for gating need stable identity data. Event order alone is insufficient.
- A `blocker` requires a revised advisor review or a recorded user override. A `concern` requires resolution, a deferral rationale, or explicit user risk acceptance.
- Codex gets the simple local watchdog path first. A fuller OMP-style watcher remains future work.
- All harness support is local-only. Cursor support covers local execution only.

## Risks

- Existing dirty worktree entries from 0012 touch shared files such as `src/workflow.ts`, `src/adapters.ts`, `src/tasks.ts`, `src/templates.ts`, and `tests/kernel.test.ts`. Implementation must preserve those changes and avoid reverting unrelated edits.
- Hook file formats vary by harness. The validator contract must stay stable so harness artifacts can be corrected without changing the core clarify gate.
- If trace identity is too loose, old advisor events could satisfy a new proposal. Tests must include stale-event and mismatched-proposal failures.
- If the validator is warning-only at write or phase gates, the old failure mode remains. Tests must cover hard failures before writing `spec.md` and before moving to plan.
- Overfitting to one harness would make CW harder to maintain. The common validator and small harness-specific wrappers are the boundary.

## Validation Strategy

- Unit-test the clarify gate with valid, missing, out-of-order, stale, mismatched-proposal, advisor-unavailable, concern, blocker, and override cases.
- Kernel-test `runClarify` so `--goal` without explicit accept does not write `spec.md` or move to plan.
- Kernel-test the accepted path with matching proposal identity, advisor review or recorded degradation, and explicit accept.
- Adapter-test generated `cw-clarify` guidance for the required sequence, Brainstorm Pass fields, advisor fallback, and concern/blocker handling.
- Adapter-test generated local watchdog artifacts for Codex, Cursor, Claude, OpenCode, and Pi, and prove they call the deterministic validator.
- Text-test that generated docs and artifacts describe only local Cursor execution.
- Regenerate relevant harness artifacts and run `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.

## Baseline Candidates

- Clarify correctness belongs in deterministic CW gates first, with generated skills and local hooks as execution surfaces.
- Local watchdogs should call a shared validator rather than carrying independent per-harness logic.
