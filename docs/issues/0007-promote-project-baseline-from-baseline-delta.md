# Promote Project Baseline Updates From `baseline-delta.md`

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement finish-time Project Baseline promotion. A task may carry a baseline delta with candidate reusable project facts. During finish, CW should preview the delta, require user confirmation, support accepted/selected/edited/skipped outcomes, let the agent semantically edit baseline files, and use helpers to validate and record the sync.

## Acceptance criteria

- [ ] A task can create or maintain an optional baseline delta.
- [ ] Finish previews baseline delta content before Project Baseline changes are applied.
- [ ] Accepted baseline deltas update the appropriate Project Baseline files.
- [ ] Skipped baseline deltas allow finish to continue without baseline changes.
- [ ] High-impact or conflicting baseline changes require explicit confirmation.
- [ ] Sync records a trace event with the selected decision.
- [ ] Tests verify accepted and skipped baseline sync behavior.

## Blocked by

- `0006-finish-task-through-closure-gate.md`
