# Plan

## Approach
Implement Baseline Outcome as a task-level closure requirement, not as a mandatory baseline-delta write in every phase.

1. Add a required Baseline Outcome checklist item to the task artifact templates and generated task rendering.
2. Teach the closure gate to reject finish when neither a baseline delta nor an explicit checked Baseline Outcome is present.
3. Update generated clarify, plan, and check guidance so agents capture candidates early and resolve the final outcome during check.
4. Keep finish-time baseline sync unchanged except for tests proving existing accepted, selected, edited, and skipped paths still work.

## Key Decisions
Use `task.md` as the normal place to record a no-update or not-yet-stable Baseline Outcome.
Treat an existing `baseline-delta.md` as a recorded Baseline Outcome, while still requiring the existing finish decision.
Do not add automatic semantic summarization to the CLI core.

## Risks
Agents may treat the new checklist item as a checkbox-only ritual. Generated guidance and behavior-review checks must require evidence, not just wording.
Older manually authored task.md files might lack the new item. The closure gate should produce a clear repair message.

## Validation Strategy
Add tests for new task templates, workflow-generated task.md, closure blocking when Baseline Outcome is absent, closure passing when the outcome is recorded, generated skill guidance, and unchanged baseline sync decisions.
Run `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, and `node dist/src/cli.js doctor --root .`.
