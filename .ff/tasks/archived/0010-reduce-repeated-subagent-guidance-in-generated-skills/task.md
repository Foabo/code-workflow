# Task

## Implementation
- [x] Move the inline-completeness invariant into generated `Rules`.
- [x] Make `Execution Strategy Guidance` conditional in the adapter renderer.
- [x] Define `cw-work`, `cw-plan`, `cw-run`, and `cw-check` as the initial commands that emit `Execution Strategy Guidance`.
- [x] Preserve command-specific delegation authorization and inline-fallback wording in `cw-work`, `cw-plan`, `cw-run`, and `cw-check` Phase Guidance.
- [x] Ensure generated `cw-clarify`, `cw-finish`, `cw-resume`, `cw-discard`, `cw-doctor`, and `cw-understand` do not include `Execution Strategy Guidance`.
- [x] Update tests for conditional section presence and absence.
- [x] Update tests for retained command-specific delegation guidance.
- [x] Regenerate Codex repo-local skills from adapter source.

## Verification
- [x] Inspect generated `cw-work`, `cw-plan`, `cw-run`, and `cw-check` skills for `Execution Strategy Guidance` and command-specific delegation guidance.
- [x] Inspect generated `cw-clarify`, `cw-finish`, `cw-resume`, `cw-discard`, `cw-doctor`, and `cw-understand` for absence of `Execution Strategy Guidance`.
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
- This task deliberately leaves the generic Helper Commands list unchanged.
- Post-plan artifact cross-review used inline fallback. It checked that spec, plan, and task all preserve inline completeness, command-specific delegation detail, concise common guidance, deterministic tests, and no Helper Commands changes.
- Task was returned to clarify after an initial narrower implementation. The current accepted contract is conditional `Execution Strategy Guidance` generation, so implementation and verification checklists were reset to match the new spec.
- Post-plan artifact cross-review rechecked spec, plan, and task for the conditional section-generation contract.
- Implemented conditional `Execution Strategy Guidance` generation in `src/adapters.ts`, leaving all skills with a minimal inline-completeness rule in `Rules`.
- Updated generated-skill tests to assert strategy-section presence for `cw-work`, `cw-plan`, `cw-run`, and `cw-check`, and absence for `cw-clarify`, `cw-finish`, `cw-resume`, `cw-discard`, `cw-doctor`, and `cw-understand`.
- Regenerated Codex skills with `node dist/src/cli.js update --harness codex`.
- Verification passed: `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
- Check-stage verification passed again: `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
- Artifact alignment review found no contradiction between spec.md, plan.md, task.md, adapter changes, tests, and regenerated Codex skills.
- Acceptance evidence: generated `Execution Strategy Guidance` appears only in `cw-work`, `cw-plan`, `cw-run`, and `cw-check`; all generated skills keep the inline-completeness rule; support commands do not contain the removed high-noise subagent guidance; tests cover both presence and absence.
- Broad workflow-semantics review was performed inline using the same artifact and evidence responsibilities.
- Dirty worktree handling is clear for finish: 0010 covers `src/adapters.ts`, `tests/kernel.test.ts`, generated `.agents/skills/*`, and `.cw/tasks/0010-reduce-repeated-subagent-guidance-in-generated-skills/`; `.cw/tasks/0011-clarify-agent-orchestration-for-cw-workflows/` is unrelated and remains untouched.
