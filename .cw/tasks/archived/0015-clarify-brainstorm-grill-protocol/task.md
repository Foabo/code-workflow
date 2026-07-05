# Task

## Implementation
- [x] Add the smallest adapter-source structure needed for `cw-clarify` to render explicit in-file protocol sections, without adding a broad renderer DSL or changing unrelated command formats.
- [x] Add the Brainstorm Pass section in generated `cw-clarify` guidance with goal/motivation restatement, at most three directions, smallest-path recommendation, assumptions, risks, acceptance evidence, Open Decisions, and a clear ban on writing `spec.md` during brainstorm.
- [x] Add the Grill Loop section in generated `cw-clarify` guidance with Open Decisions/high-risk assumptions as input, one concrete question at a time, a recommended answer and trade-off, high-risk escalation cases, and a stop condition.
- [x] Preserve the fixed clarify sequence through Proposed Spec, advisor review, concern/blocker handling, explicit accept, and writing `spec.md`, without expanding the 0013 runtime clarify gate/watchdog.
- [x] Keep Brainstorm Pass and Grill Loop inside `cw-clarify`; do not add generated `cw-brainstorm` or `cw-grill` skills, and do not require cross-skill lookup.
- [x] Regenerate the checked-in harness artifacts affected by adapter source, including `.agents/skills/cw-clarify/SKILL.md` and `.claude/skills/cw-clarify/SKILL.md`.

## Verification
- [x] Add or update tests that fail if generated `cw-clarify` loses explicit Brainstorm Pass or Grill Loop protocol sections.
- [x] Test Brainstorm Pass guidance covers goal/motivation restatement, up to three directions, smallest-path recommendation, assumptions, risks, acceptance evidence, Open Decisions, and no `spec.md` write.
- [x] Test Grill Loop guidance covers Open Decisions/high-risk assumptions, one concrete question at a time, recommendation and trade-off, high-risk escalation cases, and stop condition.
- [x] Test generated guidance does not introduce or require `cw-brainstorm` or `cw-grill` skills.
- [x] Test generated guidance preserves the accepted clarify order through advisor review and explicit accept before writing `spec.md`.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded.
- [x] Behavior review confirms the generated wording would not let an agent skip brainstorm, skip grill, rely on cross-skill lookup, write `spec.md` prematurely, or accept vague evidence.

## Check Evidence
- `npm run typecheck`
- `npm test`
- `npm run build`
- `node dist/src/cli.js validate --root .`
- `git diff --check`
- Generated `cw-clarify` protocol sections in `.agents/skills/cw-clarify/SKILL.md` and `.claude/skills/cw-clarify/SKILL.md` match the adapter-source `cw-clarify` Brainstorm Pass and Grill Loop wording in `src/adapters.ts`.

## Notes
- Planning baseline candidate: generated workflow guidance should define internal phases inside the owning workflow skill; independent skills should be reserved for independently invokable workflow actions.
