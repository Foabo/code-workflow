# Generate Harness-Native `ff-*` Command Entries

Label: `ready-for-agent`

## Parent

`docs/prd/ff-version-1-workflow-kernel.md`

## What to build

Extend initialization and update flows so selected coding harnesses receive native `ff-*` command entries. Generated entries should point back to Repo Truth, describe the workflow action semantics, and remain adapter outputs rather than canonical workflow state. This slice should preserve the generic command surface while supporting harness-specific generation.

## Acceptance criteria

- [ ] Init can generate at least one generic harness command entry for every v1 `ff-*` command.
- [ ] Init can generate native entries for a selected supported coding harness.
- [ ] Generated command content states that `.ff` is Repo Truth.
- [ ] Generated command names use the `ff-` prefix.
- [ ] Update can regenerate stale generated command entries.
- [ ] Tests verify generated files, manifests where applicable, and core command text.

## Blocked by

- `0001-initialize-usable-ff-repository.md`
