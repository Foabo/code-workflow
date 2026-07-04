# Run Action-Local Preflight And Repository Doctor

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement lightweight preflight before key actions and a manual repository-level doctor. Preflight should catch action-local task and worktree problems. Doctor should inspect overall workflow health without becoming a full background system.

## Acceptance criteria

- [ ] Preflight runs before work, run, check, finish, resume, and discard.
- [ ] Preflight validates selected task state, lifecycle/phase consistency, artifact presence, and stale resume concerns.
- [ ] Preflight reports dirty worktree concerns where relevant.
- [ ] `cw-doctor` reports malformed `.cw` files, stale or blocked tasks, missing next action, schema mismatch, leftover resume notes, and adapter drift.
- [ ] Doctor returns a structured health report usable by CLI and agent commands.
- [ ] Tests verify healthy initialized repositories and representative unhealthy states.

## Blocked by

- `0003-create-and-clarify-task-into-spec.md`
