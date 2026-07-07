---
name: ff-resume
description: Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.
---

Use this skill for the `ff-resume` Flowflow workflow action in this repository. Trigger it for `/ff-resume`, `$ff-resume`, `ff resume`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-resume

Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.

## Required Reading

- .ff/version.json
- .ff/project/overview.md
- .ff/project/architecture.md
- .ff/project/rules.md
- .ff/project/commands.md
- Current task files under .ff/tasks/<task-id>/ when a task exists

## Rules

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use ff internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
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


## Helper Commands

- ff validate
- ff doctor
- ff tasks
- ff preflight --action <action> [--task <task-id>]
- ff internal create-task --title <title> [--id <task-id>]
- ff internal select-task [--task <task-id>]
- ff internal append-trace --task <task-id> --type <event-type> --summary <summary>
- ff internal append-trace --task <task-id> --type <event-type> --summary <summary> --data-json <json-object>
- ff internal propose-spec --task <task-id> --spec-file <path>
- ff internal accept-spec --task <task-id> (--verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>)
- ff internal validate-clarify --task <task-id> --stage proposal|accept|advance
- ff internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- ff internal finish-task --task <task-id> --summary <summary> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none] [--edited-content <confirmed-current-state-sections>]
- ff internal discard-task --task <task-id> --confirm --worktree <handling>
- ff internal create-resume --task <task-id> --content <markdown>
- ff internal ensure-baseline-delta --task <task-id>
- ff internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped [--selected-files <overview.md,architecture.md,rules.md,commands.md>] [--edited-content <confirmed-current-state-sections>]
- ff internal consume-resume --task <task-id>
