# Finish A Task Through Closure Gate

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement task completion through `cw-finish`. Finish should be the only normal path to closing a task. It should run the Closure Gate, verify checklist completeness, handle dirty worktree state, delete consumed resume notes, append trace evidence, and set the task lifecycle to closed only when the task can be responsibly finished.

## Acceptance criteria

- [ ] Direct lifecycle mutation to closed is rejected outside finish.
- [ ] Finish fails when acceptance criteria or checklist completion are insufficient.
- [ ] Finish fails when unresolved drift remains.
- [ ] Finish handles clean, covered, unrelated, and ambiguous dirty worktree decisions.
- [ ] Finish deletes any consumed resume note.
- [ ] Finish appends a trace event and sets lifecycle to closed on success.
- [ ] Tests verify Closure Gate failure and success through externally observable state.

## Blocked by

- `0005-run-and-check-task-through-checklist-loop.md`
