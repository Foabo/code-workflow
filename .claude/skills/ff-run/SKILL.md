---
name: ff-run
description: Execute the next checklist items from task.md, modify repository code, update progress, and append trace events through helpers.
---

Use this skill for the `ff-run` Flowflow workflow action in this repository. Trigger it for `/ff-run`, `$ff-run`, `ff run`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-run

Execute the next checklist items from task.md, modify repository code, update progress, and append trace events through helpers.

## Required Reading

- .ff/version.json
- .ff/project/overview.md
- .ff/project/architecture.md
- .ff/project/rules.md
- .ff/project/commands.md
- Current task files under .ff/tasks/<task-id>/ when a task exists

## Rules

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use ff internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Use `.ff/orchestration.json` and generated `ff-<role>` agent files as the role and model contract when delegation is available.
- Explicitly ask the harness to spawn the named `ff-<role>` agent for bounded delegated work; Codex only spawns subagents after the main session asks.
- Delegation is optional and permission-bound; continue inline when delegation is unavailable or unauthorized.
- Delegated work receives task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Delegated agents must not close tasks; closure decisions and unresolved drift return to the main session.

Role routing for this command:

- Use `ff-implementer` only for bounded, independent implementation slices with a clear file or checklist scope.
- Keep requirement drift, scope changes, and phase movement in the main session.

## Workflow Steps

1. Run `ff preflight --action run --task <task-id>`.
2. Read spec.md, plan.md, task.md, and relevant code.
3. Implement the next unchecked task.md items against the accepted spec.md and plan.md contract.
4. Stop for user confirmation when work reveals requirement drift, plan contradiction, or product behavior outside scope.
5. Add or update tests by default for behavior, workflow semantics, CLI/API behavior, state transitions, parsing, validation, and error handling.
6. For simple file creation or replacement tasks, the executable shim may be called with `ff-run --task <task-id> --write-file <path> --content <text>`.
7. Update task.md checklist progress.
8. Record material progress with `ff internal append-trace --task <task-id> --type run.updated --summary <summary>`.
9. Run `ff internal ensure-baseline-delta --task <task-id>` when stable reusable project facts are discovered.
10. Run `ff internal set-state --task <task-id> --phase check --next-action <text>` when implementation items are complete enough to verify.

## Phase Guidance

- Run executes the accepted task contract. Do not expand product behavior or implementation scope beyond spec.md and plan.md without user confirmation.
- Behavior changes require test evidence by default. Use red-green TDD when a clear public seam exists; use commands, fixtures, snapshots, file checks, or manual review when those are the right evidence.
- Use `ff-implementer` for independent vertical slices only when the harness, tools, and user or environment permission allow delegation; otherwise implement the same checklist items inline.
- Delegated implementers may write code and update checklist progress, but they must not close tasks or decide requirement drift.
- Domain modeling is optional. Use it only when terms or stable reusable project concepts change; otherwise record task-local terms in spec.md or task.md.
- External TDD, domain modeling, implement, Superpowers, or subagent skills may help when installed, but this generated guidance is sufficient to proceed without them.


## Helper Commands

- ff validate
- ff doctor
- ff tasks
- ff preflight --action <action> [--task <task-id>]
- ff internal create-task --title <title> [--id <task-id>]
- ff internal select-task [--task <task-id>]
- ff internal append-trace --task <task-id> --type <event-type> --summary <summary>
- ff internal append-trace --task <task-id> --type <event-type> --summary <summary> --data-json <json-object>
- ff internal propose-spec --task <task-id> --spec-file <path>
- ff internal accept-spec --task <task-id> (--verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>)
- ff internal validate-clarify --task <task-id> --stage proposal|accept|advance
- ff internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- ff internal finish-task --task <task-id> --summary <summary> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none] [--edited-content <confirmed-current-state-sections>]
- ff internal discard-task --task <task-id> --confirm --worktree <handling>
- ff internal create-resume --task <task-id> --content <markdown>
- ff internal ensure-baseline-delta --task <task-id>
- ff internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped [--selected-files <overview.md,architecture.md,rules.md,commands.md>] [--edited-content <confirmed-current-state-sections>]
- ff internal consume-resume --task <task-id>
