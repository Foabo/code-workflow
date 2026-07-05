---
name: cw-understand
description: Draft project baseline updates for an existing repository, then ask the user what to merge.
---

Use this skill for the `cw-understand` CW workflow action in this repository. Trigger it for `/cw-understand`, `$cw-understand`, `cw understand`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# cw-understand

Draft project baseline updates for an existing repository, then ask the user what to merge.

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

1. Run `cw preflight --action understand`.
2. Inspect repository structure, package files, commands, and existing docs.
3. Draft candidate updates for .cw/project/overview.md, architecture.md, rules.md, and commands.md.
4. Ask the user what to merge before editing project baseline files.
5. After accepted edits, run `cw internal append-trace --task <task-id> --type baseline.updated --summary <summary>` only if this is tied to a task.

## Phase Guidance

- Understand is draft-first repository observation. Write candidates to .cw/understand-draft/ and never overwrite .cw/project/* automatically.
- Separate observed facts from inferences. Observed facts include files, package scripts, config, docs, dependencies, and existing .cw/project content; uncertain inferences should say Review required.
- Read the current Project Baseline before proposing a merge, and preserve user-authored current-state content unless the user accepts a replacement.
- Ask which drafted sections to merge. Merge only accepted content, and record a baseline.updated trace event only when the understand work is tied to a task.
- Do not promote task-local plans, aspirations, or one-off implementation details into Project Baseline.


## Helper Commands

- cw validate
- cw doctor
- cw tasks
- cw preflight --action <action> [--task <task-id>]
- cw internal create-task --title <title> [--id <task-id>]
- cw internal select-task [--task <task-id>]
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary>
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary> --data-json <json-object>
- cw internal validate-clarify --task <task-id> --stage proposal|accept|advance
- cw internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- cw internal finish-task --task <task-id> --summary <summary> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none] [--edited-content <confirmed-current-state-sections>]
- cw internal discard-task --task <task-id> --confirm --worktree <handling>
- cw internal create-resume --task <task-id> --content <markdown>
- cw internal ensure-baseline-delta --task <task-id>
- cw internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped [--selected-files <overview.md,architecture.md,rules.md,commands.md>] [--edited-content <confirmed-current-state-sections>]
- cw internal consume-resume --task <task-id>
