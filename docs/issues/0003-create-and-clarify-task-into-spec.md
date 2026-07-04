# Create And Clarify A Task Into `spec.md`

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement the task creation and clarification path. A user should be able to start work from a request, create or select a task, generate the minimal task files, update the task spec, and record phase/state changes. Clarification should stop for user confirmation when required information is missing and should not write implementation code or Project Baseline files.

## Acceptance criteria

- [ ] `cw-work` can create a new task with task state, trace events, and core task artifacts.
- [ ] `cw-clarify` can update the task spec from user-provided goal, scope, constraints, decisions, and acceptance criteria.
- [ ] Clarification can move a task to the next phase when the spec is accepted.
- [ ] Clarification can mark a task blocked with a reason and next action when user input is required.
- [ ] Trace events are appended chronologically for task creation and spec acceptance.
- [ ] Tests verify task state, lifecycle, phase, next action, generated artifacts, and trace events.

## Blocked by

- `0001-initialize-usable-cw-repository.md`
- `0002-generate-harness-native-cw-command-entries.md`
