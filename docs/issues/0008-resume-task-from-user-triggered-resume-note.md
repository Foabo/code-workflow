# Resume A Task From A User-Triggered `resume.md`

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement task-local resume notes. A user should be able to explicitly create a concise resume note, later invoke resume for that task, and have CW consume the note without making it the primary source of recovery. Normal recovery should still use task state, trace, and task artifacts.

## Acceptance criteria

- [ ] A task can have at most one current resume note.
- [ ] Resume note creation records the artifact in task state.
- [ ] `cw-resume` reads the resume note and returns the task to normal workflow.
- [ ] Resume consumption clears the artifact and resume condition in task state.
- [ ] Consumed resume notes are removed from disk.
- [ ] Tests verify create/consume behavior and trace events.

## Blocked by

- `0003-create-and-clarify-task-into-spec.md`
