# Plan A Task Into `plan.md` And `task.md`

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement the planning path that turns an accepted task spec into an implementation approach and executable checklist. Planning should read task truth and Project Baseline context, update the plan and checklist, and advance the task toward execution without writing implementation code.

## Acceptance criteria

- [ ] `cw-plan` requires a usable task spec before planning.
- [ ] `cw-plan` updates the implementation approach.
- [ ] `cw-plan` updates the executable checklist with implementation, verification, and check sections.
- [ ] Planning advances the task phase toward run when successful.
- [ ] Planning returns to clarification or blocks the task when the spec is insufficient.
- [ ] Tests verify plan/checklist output, phase transition, and trace event behavior.

## Blocked by

- `0003-create-and-clarify-task-into-spec.md`
