# Encode Inline, Subagent, And Hybrid Execution Strategies

Label: `ready-for-agent`

## Parent

`docs/prd/cw-version-1-workflow-kernel.md`

## What to build

Encode execution strategy guidance in generated command entries and harness adapters. CW should support inline, subagent, and hybrid execution without changing Repo Truth or task state. Inline execution must remain complete; subagents and hybrid execution should improve context efficiency where supported.

## Acceptance criteria

- [ ] Generated command guidance describes inline execution as fully supported.
- [ ] Generated command guidance describes subagent delegation where the harness supports it.
- [ ] Generated command guidance describes hybrid execution as recommended when available.
- [ ] Implementer guidance forbids closing tasks.
- [ ] Checker guidance returns spec drift or product behavior changes to the main session.
- [ ] Subagent guidance limits context to task artifacts, relevant Project Baseline files, and necessary code.
- [ ] Tests verify generated guidance contains the execution strategy rules.

## Blocked by

- `0002-generate-harness-native-cw-command-entries.md`
- `0005-run-and-check-task-through-checklist-loop.md`
