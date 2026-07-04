---
description: Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.
argument-hint: "[--task <task-id>] [--root <path>] [workflow flags]"
---

Use CW's repository-local workflow state to run cw-work.

# cw-work

Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.

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

## Workflow Steps

1. Run `cw preflight --action work`.
2. If no task exists, create one with `cw internal create-task --id <task-id> --title <title>` after deriving a clear title from the user request.
3. Select the task with `cw internal select-task` or `cw internal select-task --task <task-id>`.
4. Read spec.md, plan.md, task.md, and relevant project baseline files.
5. If the task needs clarification, follow cw-clarify behavior.
6. If planning is missing or stale, follow cw-plan behavior.
7. If executable checklist items exist, follow cw-run behavior.
8. Run cw-check behavior when implementation appears complete.
9. When check passes, stop and ask whether to run cw-finish.

## Helper Commands

- cw validate
- cw doctor
- cw tasks
- cw preflight --action <action> [--task <task-id>]
- cw internal create-task --id <task-id> --title <title>
- cw internal select-task [--task <task-id>]
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary>
- cw internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- cw internal finish-task --task <task-id> --summary <summary>
- cw internal discard-task --task <task-id> --confirm --worktree <handling>
- cw internal create-resume --task <task-id> --content <markdown>
- cw internal ensure-baseline-delta --task <task-id>
- cw internal sync-baseline-delta --task <task-id> --decision accepted|edited|skipped
- cw internal consume-resume --task <task-id>

