---
name: ff-discard
description: Abandon a task after user-confirmed worktree handling, then remove the task record.
---

Use this skill for the `ff-discard` Flowflow workflow action in this repository. Trigger it for `/ff-discard`, `$ff-discard`, `ff discard`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-discard

Abandon a task after user-confirmed worktree handling, then remove the task record.

## Contract

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Read only the task and Baseline inputs required by this phase; use ff internal helpers for state and trace changes.
- Treat context-package.md as an explicit diagnostic artifact. Workflow actions and delegated roles do not refresh or load it automatically.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Workflow Steps

1. Run `ff preflight --action discard --task <task-id>`.
2. Inspect Git status and explain whether changes will be kept, stashed, reverted, or an isolated worktree will be deleted.
3. Ask for explicit confirmation.
4. Run `ff internal discard-task --task <task-id> --confirm --worktree <keep|stash|revert|delete-worktree|none>`.
