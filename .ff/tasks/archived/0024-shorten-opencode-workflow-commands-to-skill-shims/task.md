# Task

## Implementation
- [x] Change OpenCode command renderer to emit thin shims that reference generated skills.
- [x] Update tests for shim content and absence of copied workflow body.
- [x] Refresh `.opencode/commands/` generated outputs.
- [x] Update Project Baseline wording for thin OpenCode command shims.

## Verification
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
- [x] Run `node dist/src/cli.js doctor --root .`.
- [x] Run `git diff --check`.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded.

## Notes
Verification: `npm run typecheck && npm test && npm run build && node dist/src/cli.js validate --root . && node dist/src/cli.js doctor --root . && git diff --check` passed.

Dirty Worktree: task changes are covered by this task plus the immediately prior uncommitted OpenCode command-generation task; nothing was staged or committed.

Baseline Outcome: Project Baseline wording for OpenCode command generation was updated directly in `.ff/project/architecture.md`; no separate baseline-delta is pending.
