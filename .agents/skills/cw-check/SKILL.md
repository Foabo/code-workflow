---
name: cw-check
description: Run verification and review, reconcile drift, and update task.md before finish is allowed.
---

Use this skill when the user asks Codex to run `cw-check` or the matching CW workflow action in this repository.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

<!-- generated-by-cw:v1 -->

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
- If a subagent, skill, hook, MCP tool, or code intelligence tool is unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Hybrid execution is recommended when the harness supports delegation: keep coordination in the main session while delegating implementation or checking.
- Subagents receive task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Implementer subagents may write code and update checklist progress, but must not close tasks.
- Checker subagents must return spec drift or product behavior changes to the main session for user confirmation.

## Workflow Steps

1. Run `cw preflight --action check --task <task-id>`.
2. Run the relevant commands from .cw/project/commands.md.
3. For deterministic verification commands, the executable shim may be called with repeated `cw-check --task <task-id> --command <cmd>` flags.
4. Review the implementation against spec.md, plan.md, and task.md.
5. Fix small local defects when the task contract is unchanged.
6. If spec drift appears, stop for user confirmation and update spec.md only after confirmation.
7. Update task.md verification and check items.
8. Append a check trace event with `cw internal append-trace --task <task-id> --type check.passed --summary <summary>` or `check.failed`.
9. When check passes, run `cw internal set-state --task <task-id> --phase finish --next-action <text>`.

## Helper Commands

- cw validate
- cw doctor
- cw tasks
- cw preflight --action <action> [--task <task-id>]
- cw internal create-task --title <title> [--id <task-id>]
- cw internal select-task [--task <task-id>]
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary>
- cw internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- cw internal finish-task --task <task-id> --summary <summary>
- cw internal discard-task --task <task-id> --confirm --worktree <handling>
- cw internal create-resume --task <task-id> --content <markdown>
- cw internal ensure-baseline-delta --task <task-id>
- cw internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped
- cw internal consume-resume --task <task-id>

