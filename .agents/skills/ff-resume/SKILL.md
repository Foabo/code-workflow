---
name: ff-resume
description: Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.
---

Use this skill for the `ff-resume` Flowflow workflow action in this repository. Trigger it for `/ff-resume`, `$ff-resume`, `ff resume`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-resume

Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.

## Contract

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Read only the task and Baseline inputs required by this phase; use ff internal helpers for state and trace changes.
- Treat context-package.md as an explicit diagnostic artifact. Workflow actions and delegated roles do not refresh or load it automatically.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Workflow Steps

1. Run `ff preflight --action resume --task <task-id>`.
2. Read resume.md together with task.json, trace.jsonl, spec.md, plan.md, and task.md.
3. Continue from the task artifacts, using resume.md only as a pointer.
4. Let the workflow kernel consume resume.md automatically after a later workflow action records progress.

## Phase Guidance

- Resume is user-triggered continuation. Read resume.md after task.json, trace.jsonl, spec.md, plan.md, and task.md; task artifacts remain the task truth and resume.md is only a pointer.
- If the task is parked, resume may return it to open lifecycle for continuation while preserving the current phase and next action.
- Do not consume resume.md while loading resume context. The workflow kernel consumes it automatically after a later workflow action records material progress.
- If resume.md conflicts with task artifacts, trust the task artifacts and stop for user confirmation before changing spec.md, plan.md, or task.md.
- Report the loaded resume path, whether it was consumed, and the next action the agent should take.
