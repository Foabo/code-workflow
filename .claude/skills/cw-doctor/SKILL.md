---
name: cw-doctor
description: Inspect repository workflow health with cw doctor and report issues or warnings.
---

Use this skill for the `cw-doctor` CW workflow action in this repository. Trigger it for `/cw-doctor`, `$cw-doctor`, `cw doctor`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# cw-doctor

Inspect repository workflow health with cw doctor and report issues or warnings.

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

1. Run `cw doctor`.
2. Report issues first, then warnings.
3. For malformed or missing files, recommend the smallest repair.
4. Do not change project baseline or task artifacts unless the user asks for repair.

## Phase Guidance

- Doctor is repository-level diagnosis. It reports validation issues, hygiene warnings, generated adapter drift, and enhancement status.
- Report issues before warnings. For each item, include the file path or state field, the observed problem, and the smallest repair.
- Treat issues as invalid repository state and warnings as workflow hygiene risk; do not blur the two categories.
- Doctor is read-only by default. If the user asks for repair, make the smallest scoped change and use normal confirmation rules for task artifacts or Project Baseline files.
- Do not use doctor as the action-local gate; preflight owns action-local checks.


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
