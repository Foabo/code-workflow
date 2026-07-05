# Task

## Implementation
- [x] Update generated `cw-clarify` guidance in `src/adapters.ts` to remove named fast-path behavior and describe one proportional challenge process.
- [x] Add `cw-clarify` challenge-pass guidance covering original problem, motivation, assumptions, scope, acceptance criteria, risk, and shortest path.
- [x] Add `cw-clarify` expand-then-grill guidance for broad, ambiguous, high-risk, or workflow-affecting tasks, with one-question-at-a-time grilling and recommended answers.
- [x] Add dedicated `cw-work` Phase Guidance in `src/adapters.ts` for create/select behavior, task-truth reading, phase routing, repeated `/cw-work` progress, and stop-before-finish behavior.
- [x] Update common execution guidance so subagent use requires harness support, available tools, and user or environment permission.
- [x] Update plan/review guidance so inline fallback performs the same responsibility when subagents are unavailable or unauthorized.
- [x] Add generated-guidance review expectations that check likely agent behavior, not only string presence.
- [x] Improve executable `work` status details if needed so existing selected tasks return actionable next-step information.
- [x] Update tests for generated `cw-clarify` and `cw-work` guidance.
- [x] Update tests for generated subagent-boundary and deterministic behavior-review guidance.
- [x] Update tests for existing-task executable `work` behavior.
- [x] Regenerate Codex repo-local skills from adapter source.

## Verification
- [x] Inspect generated `.agents/skills/cw-clarify/SKILL.md` for the unified challenge process and absence of named fast-path guidance.
- [x] Inspect generated `.agents/skills/cw-work/SKILL.md` for phase routing and explicit stop-before-finish guidance.
- [x] Inspect generated guidance for subagent permission boundaries and complete inline fallback.
- [x] Run independent reviewer/subagent review during check if authorization and tools allow it.
- [x] If independent reviewer/subagent review is unavailable or unauthorized, record the inline reviewer checklist and reason here before finish.
- [x] Confirm deterministic tests do not require LLM or subagent execution in CI.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Post-plan artifact cross-review found no contradiction, missing coverage, overbuilding, unclear interfaces, or placeholder work.

## Notes
- `cw-work` orchestration is planned at the generated skill layer; the executable helper stays deterministic and returns task status for the agent.
- `cw-finish` remains an explicit confirmation step.
- Post-plan artifact cross-review used inline fallback because current subagent tooling requires explicit delegation authorization before spawning. The review checked spec/plan/task alignment, coverage of subagent permission boundaries, behavior-oriented generated-guidance review, CI determinism, and stop-before-finish behavior.
- Implementation updated `src/adapters.ts`, `src/workflow.ts`, `tests/kernel.test.ts`, and regenerated `.agents/skills/*`.
- Deterministic verification passed: `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
- Independent reviewer/subagent `019f311c-6575-7c42-ac22-cd1d29b06a78` found no blocking issues. It verified the failure modes covered by the spec: clarify challenge/grill behavior, subagent permission boundaries, `cw-work` stop-before-finish guidance, deterministic executable `work` scope, and deterministic tests.
- Independent reviewer residual risk: `cw-work` still includes the generic Helper Commands list, including finish and baseline helpers. This is not blocking because the `cw-work` Phase Guidance explicitly says not to close tasks from `cw-work`; a future phase-scoped helper list could reduce ambiguity.
- Subagent review was available and authorized for this check, so the inline fallback reason item is not applicable.
- Dirty worktree entries are covered by this task: `.agents/skills/*`, `src/adapters.ts`, `src/workflow.ts`, `tests/kernel.test.ts`, and `.cw/tasks/0009-improve-cw-work-as-the-default-progress-command/`.
