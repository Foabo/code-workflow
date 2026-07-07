# Task

## Implementation
- [x] Generated `cw-clarify` skill explains strict default mode, light-mode triggers, automatic strict escalation, and the requirement to stop for user judgment on high-risk assumptions.
- [x] Generated `cw-clarify` skill explains the Expand then Grill process: expand result-oriented options only when needed, offer at most three directions with one recommendation, then ask one important question at a time.
- [x] Generated `cw-clarify` skill requires a short Proposed Spec before writing `spec.md`, with the existing six spec sections and no new persisted clarify artifact.
- [x] Generated `cw-plan` skill explains the spec quality gate, states that plan must not edit `spec.md`, and tells the agent to return to clarify with one concrete next question when the gate fails.
- [x] Workflow plan fallback produces an actionable blocked reason or next action when `spec.md` is insufficient.
- [x] Planning guidance tells agents to break work into small, verifiable vertical slices and keep file-level edits as implementation details.
- [x] Repo-local Codex skills are regenerated from the adapter source after implementation.
- [x] A baseline delta candidate is created only if implementation discovers stable reusable project facts that should outlive this task.

## Verification
- [x] Tests cover generated `cw-clarify` guidance for strict/light mode, Expand/Grill, and Proposed Spec.
- [x] Tests cover generated `cw-plan` guidance for the spec quality gate, no direct spec edits, and one concrete next question.
- [x] Tests cover the workflow fallback when planning receives an insufficient spec.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.

## Notes

- Use `writing-great-skills` as the quality bar for generated skill text: predictable process, single source of truth, checkable completion criteria, relevant wording, and no unnecessary duplication.
- Later `cw-run`, `cw-check`, and `cw-finish` improvements should use the same skill-writing bar, but this task is scoped to clarify and plan.
- No baseline delta was created during run; implementation did not discover additional reusable project facts beyond the accepted task contract.
- Dirty worktree entries covered by this task: `.agents/skills/cw-clarify/SKILL.md`, `.agents/skills/cw-plan/SKILL.md`, `src/adapters.ts`, `src/workflow.ts`, `tests/kernel.test.ts`, and `.cw/tasks/0006-improve-clarify-plan-boundaries/`.
- Existing unrelated dirty entries: `AGENTS.md`, `src/index.ts`, `.cw/tasks/archived/0005-public-interface-surface/`, and `docs/adr/0039-no-stable-typescript-package-surface-for-v1.md`.
