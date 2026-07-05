---
name: cw-resume
description: Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.
---

Use this skill for the `cw-resume` CW workflow action in this repository. Trigger it for `/cw-resume`, `$cw-resume`, `cw resume`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# cw-resume

Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.

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

## Workflow Steps

1. Run `cw preflight --action resume --task <task-id>`.
2. Read resume.md together with task.json, trace.jsonl, spec.md, plan.md, and task.md.
3. Continue from the task artifacts, using resume.md only as a pointer.
4. Let the workflow kernel consume resume.md automatically after a later workflow action records progress.

## Phase Guidance

- Resume is user-triggered continuation. Read resume.md after task.json, trace.jsonl, spec.md, plan.md, and task.md; task artifacts remain the task truth and resume.md is only a pointer.
- If the task is parked, resume may return it to open lifecycle for continuation while preserving the current phase and next action.
- Do not consume resume.md while loading resume context. The workflow kernel consumes it automatically after a later workflow action records material progress.
- If resume.md conflicts with task artifacts, trust the task artifacts and stop for user confirmation before changing spec.md, plan.md, or task.md.
- Report the loaded resume path, whether it was consumed, and the next action the agent should take.


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
