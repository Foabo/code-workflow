# Generate Harness-Native `cw-*` Command Entries

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Extend initialization and update flows so selected coding harnesses receive native `cw-*` command entries. Generated entries should point back to Repo Truth, describe the workflow action semantics, and remain adapter outputs rather than canonical workflow state. This slice should preserve the generic command surface while supporting harness-specific generation.

## Acceptance criteria

- [ ] Init can generate at least one generic harness command entry for every v1 `cw-*` command.
- [ ] Init can generate native entries for a selected supported coding harness.
- [ ] Generated command content states that `.cw` is Repo Truth.
- [ ] Generated command names use the `cw-` prefix.
- [ ] Update can regenerate stale generated command entries.
- [ ] Tests verify generated files, manifests where applicable, and core command text.

## Blocked by

- `0001-initialize-usable-cw-repository.md`
