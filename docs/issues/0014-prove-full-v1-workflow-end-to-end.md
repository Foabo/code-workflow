# Prove The Full V1 Workflow End To End

Label: `ready-for-agent`

## Parent

`docs/prd/ff-version-1-workflow-kernel.md`

## What to build

Add a full v1 workflow proof that exercises Flowflow as a user would. The scenario should initialize a repository, create and clarify a task, plan it, run implementation, check it, sync a baseline delta, finish it, exercise resume/discard auxiliary flows, run understand, and report doctor health.

## Acceptance criteria

- [ ] The end-to-end scenario starts from an empty temporary repository.
- [ ] The scenario initializes Flowflow and generates at least one harness entry.
- [ ] The scenario runs work, clarify, plan, run, check, finish, resume, discard, understand, and doctor through the workflow action seam.
- [ ] The scenario verifies task closure through finish and Project Baseline update through accepted baseline delta.
- [ ] The scenario verifies resume consumption and discard removal.
- [ ] The scenario verifies understand drafts and doctor output.
- [ ] The scenario is automated and runs with the normal test command.

## Blocked by

- `0006-finish-task-through-closure-gate.md`
- `0007-promote-project-baseline-from-baseline-delta.md`
- `0008-resume-task-from-user-triggered-resume-note.md`
- `0009-discard-abandoned-task-safely.md`
- `0010-run-preflight-and-repository-doctor.md`
- `0011-draft-existing-repo-project-baseline-with-understand.md`
