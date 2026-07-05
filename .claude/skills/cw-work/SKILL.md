---
name: cw-work
description: Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.
---

Use this skill for the `cw-work` CW workflow action in this repository. Trigger it for `/cw-work`, `$cw-work`, `cw work`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# cw-work

Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.

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

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Use `.cw/orchestration.json` and generated `cw-<role>` agent files as the role and model contract when delegation is available.
- Explicitly ask the harness to spawn the named `cw-<role>` agent for bounded delegated work; Codex only spawns subagents after the main session asks.
- Delegation is optional and permission-bound; continue inline when delegation is unavailable or unauthorized.
- Delegated work receives task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Delegated agents must not close tasks; closure decisions and unresolved drift return to the main session.

Role routing for this command:

- Clarify phase: use `cw-advisor` for Proposed Spec review when advisor mode or risk calls for an independent challenge.
- Plan phase: use `cw-planner` for plan.md/task.md drafting and `cw-reviewer` for artifact cross-review.
- Run phase: use `cw-implementer` for independent task.md implementation slices.
- Check phase: use `cw-checker` for verification and small in-scope repair, then `cw-reviewer` for broad final review when risk warrants it.
- Finish phase: use `cw-baseline-writer` only for candidate Project Baseline merge drafts; the main session still owns closure.

## Workflow Steps

1. Run `cw preflight --action work`.
2. If no task exists, create one with `cw internal create-task --title <title>` after deriving a clear title from the user request.
3. Select the task with `cw internal select-task` or `cw internal select-task --task <task-id>`.
4. Read spec.md, plan.md, task.md, and relevant project baseline files.
5. Route by current task phase and artifact state: clarify, plan, run, check, or finish readiness.
6. Apply the matching command behavior in this same agent session when the next step is clear.
7. Stop for user judgment when the matching phase requires confirmation, new requirements, or product behavior decisions.
8. When check passes, report finish readiness and ask whether to run cw-finish.

## Phase Guidance

- `cw-work` is the routine progress command. Repeated `/cw-work` calls should be enough to advance ordinary work through clarify, plan, run, and check.
- The executable `work` helper creates or selects the task and returns actionable status. The generated skill performs the judgment-heavy orchestration: questioning, planning, code edits, verification, and review.
- Use task truth to choose the next responsibility: clarify means challenge and accept the task contract, plan means create or repair plan.md and task.md, run means execute unchecked implementation items, check means verify and review evidence, and finish means stop before closure.
- When delegation is available, route bounded phase work to the matching role agent: `cw-advisor` for clarify review, `cw-planner` for planning, `cw-implementer` for independent implementation slices, `cw-checker` for verification, `cw-reviewer` for broad review, and `cw-baseline-writer` for baseline merge drafts.
- Delegation may help only when the harness, tools, and user or environment permission allow it; otherwise route phases and perform the same responsibilities inline.
- Do not close tasks from `cw-work`. When the task is ready for finish, summarize the closure readiness and ask whether to run `cw-finish`.
- If the phase, artifacts, or user request conflict, stop and resolve the conflict through the matching phase guidance before making code changes.


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
