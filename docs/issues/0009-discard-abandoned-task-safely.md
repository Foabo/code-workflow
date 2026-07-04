# Discard An Abandoned Task Safely

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement discard as the path for abandoning work. Discard should remove the task record only after explicit confirmation and worktree handling. It should not close a task or create a finished result. The behavior should cover shared worktrees first and leave room for isolated worktree deletion.

## Acceptance criteria

- [ ] `cw-discard` requires explicit confirmation before removing a task.
- [ ] Shared-worktree discard requires a selected handling mode.
- [ ] Confirmed discard removes the task record and task artifacts.
- [ ] Discard does not produce lifecycle `closed`.
- [ ] Discard appends or preserves enough trace/command output to explain the action when applicable.
- [ ] Tests verify refusal without confirmation and task removal with confirmation.

## Blocked by

- `0003-create-and-clarify-task-into-spec.md`
