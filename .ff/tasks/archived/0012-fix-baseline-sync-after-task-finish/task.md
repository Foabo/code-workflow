# Task

## Implementation
- [x] Add Baseline Outcome to task artifact templates and workflow-generated task.md.
- [x] Add closure-gate detection for missing Baseline Outcome.
- [x] Update clarify, plan, and check generated guidance for candidate capture and check-stage outcome recording.
- [x] Regenerate affected harness skills from adapter source.
- [x] Make generated workflow skill trigger wording harness-neutral across `.agents/skills` and `.claude/skills`.
- [x] Make finish actively merge ordinary `baseline-delta.md` content into Project Baseline by default.
- [x] Avoid high-impact false positives from empty baseline-delta section headers.

## Verification
- [x] Add tests for template and workflow-generated Baseline Outcome checklist items.
- [x] Add tests that finish is blocked when Baseline Outcome is absent and passes when it is recorded.
- [x] Add tests that accepted, selected, edited, and skipped baseline sync behavior is unchanged.
- [x] Add tests for generated clarify, plan, and check guidance.
- [x] Add tests rejecting host-bound generated workflow skill trigger wording.
- [x] Add tests for finish preflight warnings and default baseline-delta merge behavior.
- [x] Add regression coverage for empty `architecture.md` baseline-delta sections.
- [x] Run typecheck, tests, build, validate, and doctor.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded for this task.

## Notes
- cw-check verified the implementation with `npm run build && node dist/src/cli.js update --harness codex && node dist/src/cli.js update --harness claude && npm run typecheck && npm test && npm run build && node dist/src/cli.js validate --root . && node dist/src/cli.js doctor --root .`; Baseline Outcome candidate is recorded in `baseline-delta.md`.
- Dirty worktree handling: 0012 covers the source, tests, generated skills, learning note, and `.cw/tasks/0012-fix-baseline-sync-after-task-finish/`; `.cw/tasks/0013-harden-clarify-advisor-and-local-watchdog-gates/` is unrelated and remains untouched.
- User identified that every generated workflow skill under `.agents/skills/` used host-bound trigger wording. The generator now emits harness-neutral CW workflow action trigger text, and verification passed with `npm run typecheck && npm test && npm run build && node dist/src/cli.js validate --root . && node dist/src/cli.js doctor --root .`.
- User identified that finish should actively merge `baseline-delta.md`. Accepted and selected baseline sync now merge delta content into existing Project Baseline by default; edited still requires user-supplied current-state sections, and skipped records no Project Baseline change.
- Finish initially hit a high-impact false positive because an empty `## architecture.md` delta section was scanned as text. High-impact detection now uses parsed non-empty baseline section content.
