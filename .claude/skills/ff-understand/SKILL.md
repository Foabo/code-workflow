---
name: ff-understand
description: Draft project baseline updates for an existing repository, then ask the user what to merge.
---

Use this skill for the `ff-understand` Flowflow workflow action in this repository. Trigger it for `/ff-understand`, `$ff-understand`, `ff understand`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-understand

Draft project baseline updates for an existing repository, then ask the user what to merge.

## Contract

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Read only the task and Baseline inputs required by this phase; use ff internal helpers for state and trace changes.
- Treat context-package.md as an explicit diagnostic artifact. Workflow actions and delegated roles do not refresh or load it automatically.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Workflow Steps

1. Run `ff preflight --action understand`.
2. Inspect repository structure, package files, commands, and existing docs.
3. Draft candidate updates for .ff/project/overview.md, architecture.md, rules.md, and commands.md.
4. Ask the user what to merge before editing project baseline files.
5. After accepted edits, run `ff internal append-trace --task <task-id> --type baseline.updated --summary <summary>` only if this is tied to a task.

## Phase Guidance

- Understand is draft-first repository observation. Write candidates to .ff/understand-draft/ and never overwrite .ff/project/* automatically.
- Separate observed facts from inferences. Observed facts include files, package scripts, config, docs, dependencies, and existing .ff/project content; uncertain inferences should say Review required.
- Read the current Project Baseline before proposing a merge, and preserve user-authored current-state content unless the user accepts a replacement.
- Ask which drafted sections to merge. Merge only accepted content, and record a baseline.updated trace event only when the understand work is tied to a task.
- Do not promote task-local plans, aspirations, or one-off implementation details into Project Baseline.
