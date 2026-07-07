# Plan

## Approach

Apply the `writing-great-skills` lens to the generated CW skills: make the process predictable, keep each behavior in one source of truth, give steps checkable completion criteria, and prune generic instructions that do not change agent behavior.

The implementation should stay narrow:

- Update the adapter generator, not generated skill files by hand.
- Add phase-specific guidance for `cw-clarify` and `cw-plan` while keeping common workflow rules shared.
- Update workflow planning fallback so an insufficient `spec.md` sends the task back to clarify with one concrete next question.
- Regenerate repo-local Codex skills through `cw update --harness codex`.
- Add tests that verify the generated skill text and plan fallback behavior.

The same skill-writing standard should be reusable for later `cw-run`, `cw-check`, and `cw-finish` improvements, but this task should only change their behavior if a shared generator refactor requires harmless wording alignment.

## Key Decisions

- Use generated skill text as the product surface and `src/adapters.ts` as the single source of truth for it.
- Use compact leading words in the generated guidance where they carry behavior: `Proposed Spec`, `Expand`, `Grill`, and `spec quality gate`.
- Keep strict/light mode as behavior guidance, not persisted state.
- Keep `spec.md` as the confirmed contract; `cw-plan` may reject it but must not edit it.
- Represent a failed spec quality gate with the existing blocked/clarify task state and a concrete `nextAction`.
- Keep task checklist items behavior-oriented and verifiable rather than file-oriented.

## Risks

- Generated skills can sprawl if all phase detail is added to every command. Mitigate by adding clarify-specific and plan-specific sections only where needed.
- Overly strict spec checks can block valid small tasks. Mitigate by starting with obvious insufficiency checks and making the blocked message actionable.
- Existing tests may assert older generated skill text. Update them to check stable behavioral phrases rather than long snapshots.
- The worktree already has unrelated modifications. Keep edits scoped to this task's files and the implementation files needed later.

## Validation Strategy

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .`.
- Inspect generated `.agents/skills/cw-clarify/SKILL.md` and `.agents/skills/cw-plan/SKILL.md` after regeneration to confirm they contain the intended guidance.
