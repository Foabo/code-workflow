---
name: ff-doctor
description: Inspect repository workflow health with ff doctor and report issues or warnings.
---

Use this skill for the `ff-doctor` Flowflow workflow action in this repository. Trigger it for `/ff-doctor`, `$ff-doctor`, `ff doctor`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-doctor

Inspect repository workflow health with ff doctor and report issues or warnings.

## Contract

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Read only the task and Baseline inputs required by this phase; use ff internal helpers for state and trace changes.
- Treat context-package.md as an explicit diagnostic artifact. Workflow actions and delegated roles do not refresh or load it automatically.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Workflow Steps

1. Run `ff doctor`.
2. Report issues first, then warnings.
3. For malformed or missing files, recommend the smallest repair.
4. Do not change project baseline or task artifacts unless the user asks for repair.

## Phase Guidance

- Doctor is repository-level diagnosis. It reports validation issues, hygiene warnings, generated adapter drift, and enhancement status.
- Report issues before warnings. For each item, include the file path or state field, the observed problem, and the smallest repair.
- Treat issues as invalid repository state and warnings as workflow hygiene risk; do not blur the two categories.
- Doctor is read-only by default. If the user asks for repair, make the smallest scoped change and use normal confirmation rules for task artifacts or Project Baseline files.
- Do not use doctor as the action-local gate; preflight owns action-local checks.
