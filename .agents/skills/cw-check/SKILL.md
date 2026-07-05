---
name: cw-check
description: Run verification and review, reconcile drift, and update task.md before finish is allowed.
---

Use this skill for the `cw-check` CW workflow action in this repository. Trigger it for `/cw-check`, `$cw-check`, `cw check`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# cw-check

Run verification and review, reconcile drift, and update task.md before finish is allowed.

## Required Reading

- .cw/version.json
- .cw/project/overview.md
- .cw/project/architecture.md
- .cw/project/rules.md
- .cw/project/commands.md
- Current task files under .cw/tasks/<task-id>/ when a task exists

## Rules

- Treat .cw task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use cw internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Use `.cw/orchestration.json` and generated `cw-<role>` agent files as the role and model contract when delegation is available.
- Delegation is optional and permission-bound; continue inline when delegation is unavailable or unauthorized.
- Delegated work receives task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Delegated agents must not close tasks; closure decisions and unresolved drift return to the main session.

## Workflow Steps

1. Run `cw preflight --action check --task <task-id>`.
2. Run the relevant commands from .cw/project/commands.md.
3. For deterministic verification commands, the executable shim may be called with repeated `cw-check --task <task-id> --command <cmd>` flags and `--baseline-outcome <text>`.
4. Run artifact alignment review against spec.md, plan.md, and task.md.
5. Run implementation evidence review against every acceptance criterion.
6. Fix small local defects when the task contract is unchanged.
7. If spec drift appears, stop for user confirmation and update spec.md only after confirmation.
8. Record one Baseline Outcome before finish: baseline-delta.md created or updated, no reusable project facts, or candidate not stable yet.
9. Update task.md verification and check items.
10. Append a check trace event with `cw internal append-trace --task <task-id> --type check.passed --summary <summary>` or `check.failed`.
11. When check passes, run `cw internal set-state --task <task-id> --phase finish --next-action <text>`.

## Phase Guidance

- Artifact alignment review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work.
- Implementation evidence review maps every acceptance criterion to evidence in task.md Verification or Check entries. Evidence can be tests, commands, file checks, CI/CD or test-environment notes, or manual verification.
- CI/CD or test-environment evidence states environment, action, and result without relying on commit identity.
- Small local defects may be fixed during check when the accepted spec.md contract is unchanged. Changes to spec.md or out-of-scope implementation behavior return to clarify for user confirmation.
- Check owns the final Baseline Outcome. Update baseline-delta.md for stable reusable facts, or record that there are no reusable project facts or that candidates are not stable yet.
- Use an independent reviewer for broad, behaviorally large, or workflow-semantics changes only when the harness, tools, and user or environment permission allow delegation; otherwise perform the same artifact and evidence review inline.
- Run a final broad review when the change is cross-cutting, behaviorally large, or touches workflow semantics shared by multiple commands.


## Helper Commands

- cw validate
- cw doctor
- cw tasks
- cw preflight --action <action> [--task <task-id>]
- cw internal create-task --title <title> [--id <task-id>]
- cw internal select-task [--task <task-id>]
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary>
- cw internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- cw internal finish-task --task <task-id> --summary <summary> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none] [--edited-content <confirmed-current-state-sections>]
- cw internal discard-task --task <task-id> --confirm --worktree <handling>
- cw internal create-resume --task <task-id> --content <markdown>
- cw internal ensure-baseline-delta --task <task-id>
- cw internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped [--selected-files <overview.md,architecture.md,rules.md,commands.md>] [--edited-content <confirmed-current-state-sections>]
- cw internal consume-resume --task <task-id>
