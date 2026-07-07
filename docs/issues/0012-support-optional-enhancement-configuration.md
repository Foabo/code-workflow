# Support Optional Enhancement Configuration

Label: `ready-for-agent`

## Parent

`docs/prd/ff-version-1-workflow-kernel.md`

## What to build

Add skippable enhancement configuration for code intelligence and external memory/context detection. Enhancements should improve guidance or diagnostics without becoming workflow prerequisites or Repo Truth.

## Acceptance criteria

- [ ] Init asks about code intelligence configuration after required harness selection.
- [ ] Init asks about external memory/context detection after required harness selection.
- [ ] Users can skip all enhancements.
- [ ] Skipping enhancements preserves a fully usable workflow.
- [ ] Doctor can report configured enhancement status or absence without failing core health.
- [ ] Tests verify skipped and configured enhancement paths.

## Blocked by

- `0001-initialize-usable-ff-repository.md`
- `0010-run-preflight-and-repository-doctor.md`
