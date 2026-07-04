# Draft Existing-Repo Project Baseline With `cw-understand`

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Implement existing-repository understanding as a draft-first action. CW should inspect repository structure, available package scripts, docs, and observable project facts, then create Project Baseline drafts for user review. It must not automatically overwrite baseline files.

## Acceptance criteria

- [ ] `cw-understand` creates drafts for overview, architecture, rules, and commands.
- [ ] Understand drafts include observed commands when package scripts or equivalent configuration are present.
- [ ] Understand drafts are separate from Project Baseline files.
- [ ] Accepted draft content can be semantically merged later without making automatic scan output canonical.
- [ ] Tests verify draft creation and absence of direct baseline overwrite.

## Blocked by

- `0001-initialize-usable-cw-repository.md`
