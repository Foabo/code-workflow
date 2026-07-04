# Run And Check A Task Through The Checklist Loop

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement the core execution loop. `cw-run` should execute the next checklist work and update task progress. `cw-check` should combine verification and review, update the checklist, detect unresolved drift, and move the task toward finish only when implementation satisfies the task spec.

## Acceptance criteria

- [ ] `cw-run` reads task truth and executes the next checklist item or requested work.
- [ ] `cw-run` updates checklist progress and appends a trace event.
- [ ] `cw-check` can run verification commands or record manual verification results.
- [ ] `cw-check` reviews implementation against the task spec and plan.
- [ ] `cw-check` records pass/blocking status in the checklist and trace.
- [ ] Drift detected during check prevents finish readiness until spec, plan, or task checklist is updated.
- [ ] Tests verify run output, check command recording, checklist updates, and phase progression.

## Blocked by

- `0004-plan-task-into-plan-and-task-checklist.md`
