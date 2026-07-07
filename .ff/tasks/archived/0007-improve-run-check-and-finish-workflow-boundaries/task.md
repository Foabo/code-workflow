# Task

## Implementation
- [x] Update generated `cw-clarify` guidance to replace strict/light mode labels with a single clarify quality gate, fast path conditions, and expand-then-grill fallback triggers.
- [x] Update generated guidance so references to grill, TDD, domain modeling, subagents, implement, or Superpowers are self-contained and external skills remain optional enhancements.
- [x] Update generated `cw-plan` guidance to require post-plan artifact cross-review of `spec.md`, `plan.md`, and `task.md`, preferring an independent reviewer subagent for nontrivial tasks with inline fallback.
- [x] Update generated `cw-run` guidance to define execution against the accepted task contract, stop conditions for drift or out-of-scope behavior, and behavior-change test evidence expectations.
- [x] Update generated `cw-check` guidance to define artifact alignment review, implementation evidence review, CI/CD evidence shape, small local defect fixes, spec drift escalation, final broad review, and drift handling rules.
- [x] Update generated `cw-finish` guidance to define the closure packet, Git independence, commit-ledger independence, and baseline merge responsibility.
- [x] Remove `generated-by-cw` marker comments from generated skill bodies while preserving stale generated skill detection.
- [x] Define the deterministic baseline helper contract for confirmed current-state markdown sections keyed by baseline file name.
- [x] Replace append-only baseline sync semantics with current-state baseline application for accepted, selected, and edited decisions.
- [x] Preserve skipped baseline decisions as no-op project baseline changes with trace evidence.
- [x] Keep baseline merge intelligence in finish-stage agent guidance and deterministic helpers; do not add LLM calls to the CLI core.
- [x] Regenerate repo-local Codex skills from adapter source after implementation.
- [x] Create a baseline delta candidate only if implementation discovers stable reusable project facts that should outlive this task.

## Verification
- [x] Tests cover generated `cw-clarify` quality gate, fast path, and expand-then-grill fallback guidance.
- [x] Tests cover self-contained guidance for optional external practices and skills.
- [x] Tests cover generated `cw-plan` post-plan artifact cross-review guidance, including subagent preference and inline fallback.
- [x] Tests cover generated `cw-run` contract execution, drift stop conditions, and behavior-change test evidence guidance.
- [x] Tests cover generated `cw-check` artifact alignment, evidence mapping, CI/CD evidence shape, small local defect fixes, spec drift escalation, final broad review, and drift handling guidance.
- [x] Tests cover generated `cw-finish` closure packet, Git independence, commit-ledger independence, and baseline candidate diff guidance.
- [x] Tests cover stale generated skill detection after removing body marker comments.
- [x] Tests cover deterministic baseline helper input and output shape for confirmed current-state markdown sections.
- [x] Tests cover current-state baseline sync behavior for accepted, selected, edited, and skipped decisions without silent append accumulation.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Check
- [x] Acceptance criteria in spec.md are covered by generated skill guidance assertions, baseline sync tests, stale detection tests, regenerated skills, and command validation.
- [x] `spec.md`, `plan.md`, and `task.md` have no contradictions, missing coverage, overbuilding, unclear interfaces, or placeholder work after check review.
- [x] Every acceptance criterion has evidence in Verification or Check entries:
  - `cw-clarify`: generated skill tests cover quality gate, fast path, and expand-then-grill fallback.
  - optional external practices: generated skill tests cover self-contained guidance for grill, TDD, domain modeling, implement, Superpowers, and subagents.
  - `cw-plan`: generated skill tests cover post-plan artifact cross-review, reviewer-subagent preference, and inline fallback.
  - `cw-run`: generated skill tests cover accepted contract execution, drift stop conditions, and behavior-change test evidence.
  - `cw-check`: generated skill tests cover artifact alignment, evidence mapping, CI/CD evidence shape, small defect fixes, spec drift escalation, and final broad review.
  - `cw-finish`: generated skill tests cover closure packet, Git independence, commit-ledger independence, current-state baseline diff guidance, and deterministic CLI boundary.
  - marker removal and stale detection: generated skill tests assert no body marker and doctor detects stale generated skills through render comparison.
  - baseline current-state sync: baseline tests cover accepted, selected, edited, and skipped decisions without silent append accumulation.
- [x] No unresolved drift between implementation and spec; broad diff review found implementation aligned with the accepted task contract.
- [x] Dirty worktree handling is clear: dirty files are generated skills, adapter/validate/baseline/CLI/test changes, and `.cw/tasks/0007-improve-run-check-and-finish-workflow-boundaries/`, all covered by this task.

## Notes

- Post-plan artifact cross-review should run before moving to run. If a reviewer subagent is unavailable, perform the same alignment check inline and record that fallback.
- Existing dirty feedback to preserve: `.agents/skills/cw-check/SKILL.md` has the generated marker removed.
- Baseline sync is changing from append-only task history to current-state baseline maintenance; avoid treating old `## From <task-id>` append behavior as the product target.
- Spec acceptance criteria checkboxes are accepted-contract markers in this CW workflow; implementation progress is tracked by unchecked items in this file.
- No baseline delta was created during run; implementation did not discover stable reusable project facts beyond this task contract.
- Verification run during implementation: `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
- Check run evidence: `npm run typecheck && npm test && npm run build && node dist/src/cli.js validate --root .`, `node dist/src/cli.js doctor --root .`, `git diff --check`, artifact alignment review, implementation evidence review, and final broad diff review.
