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
- If a subagent, skill, hook, MCP tool, or code intelligence tool is unavailable, continue inline when responsible.

## Workflow Steps

1. Run `cw preflight --action understand`.
2. Inspect repository structure, package files, commands, and existing docs.
3. Draft candidate updates for .cw/project/overview.md, architecture.md, rules.md, and commands.md.
4. Ask the user what to merge before editing project baseline files.
5. After accepted edits, run `cw internal append-trace --task <task-id> --type baseline.updated --summary <summary>` only if this is tied to a task.

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
