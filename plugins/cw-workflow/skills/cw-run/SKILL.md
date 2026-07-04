---
name: cw-run
description: Execute the next checklist items from task.md, modify repository code, update progress, and append trace events through helpers.
---

Use this skill when the user asks Codex to run `cw-run` or the matching CW workflow action in this repository.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated plugin skills as invocation surfaces, and Git as the source of truth for code changes.

# cw-run

Execute the next checklist items from task.md, modify repository code, update progress, and append trace events through helpers.

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

1. Run `cw preflight --action run --task <task-id>`.
2. Read spec.md, plan.md, task.md, and relevant code.
3. Implement the next unchecked implementation items in task.md.
4. For simple file creation or replacement tasks, the executable shim may be called with `cw-run --task <task-id> --write-file <path> --content <text>`.
5. Update task.md checklist progress.
6. Record material progress with `cw internal append-trace --task <task-id> --type run.updated --summary <summary>`.
7. Run `cw internal ensure-baseline-delta --task <task-id>` when stable reusable project facts are discovered.
8. Run `cw internal set-state --task <task-id> --phase check --next-action <text>` when implementation items are complete enough to verify.

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

