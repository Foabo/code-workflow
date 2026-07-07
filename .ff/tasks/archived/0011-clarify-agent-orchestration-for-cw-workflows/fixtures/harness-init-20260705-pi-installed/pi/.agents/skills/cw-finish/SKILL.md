---
name: cw-finish
description: Run the closure gate, handle dirty worktree state, sync accepted baseline delta, consume resume notes, and close the task.
---

Use this skill when the user asks Pi to run `cw-finish` or the matching CW workflow action in this repository.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# cw-finish

Run the closure gate, handle dirty worktree state, sync accepted baseline delta, consume resume notes, and close the task.

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

1. Run `cw preflight --action finish --task <task-id>`.
2. Confirm dirty worktree handling when needed.
3. Review check evidence, unresolved drift flags, dirty worktree handling, baseline decision, and final summary as the closure packet.
4. If baseline-delta.md exists, prepare a current-state candidate diff for .cw/project files and ask whether to accept, select, edit, or skip it.
5. After confirmation, run `cw internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped --edited-content <confirmed-current-state-sections>` when applicable.
6. Run `cw internal finish-task --task <task-id> --summary <summary> --dirty-worktree <covered|unrelated|clean> --baseline <accepted|selected|edited|skipped|none>`.
7. Report the closed task id and any project baseline files updated.

## Phase Guidance

- Finish closes the CW task. It does not create commits, require one final commit, push branches, open PRs, deploy, clean up branches, or record a commit ledger.
- The closure packet covers check evidence, unresolved drift, dirty worktree handling, baseline decision, and final summary.
- Project Baseline files are current-state descriptions. If baseline-delta.md exists, the finish-stage agent prepares a candidate diff that integrates the delta into existing .cw/project files.
- A fast inexpensive model may help draft the candidate baseline diff when available, but the generated skill must support inline preparation. The CLI core must not call an LLM.
- Apply baseline changes only after user confirmation. Helpers apply accepted current-state markdown sections or record skipped/selected decisions.


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
