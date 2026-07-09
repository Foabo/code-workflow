---
name: ff-work
description: Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.
---

Use this skill for the `ff-work` Flowflow workflow action in this repository. Trigger it for `/ff-work`, `$ff-work`, `ff work`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-work

Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.

## Required Reading

- .ff/version.json
- .ff/project/overview.md
- .ff/project/architecture.md
- .ff/project/rules.md
- .ff/project/commands.md
- Current task files under .ff/tasks/<task-id>/ when a task exists
- Current task context package under .ff/tasks/<task-id>/context-package.md when present and current

## Rules

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use ff internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
- Treat context-package.md as a generated cache; refresh it or fall back to original .ff files and git information when it is missing, stale, incomplete, or uncertain.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Use `.ff/orchestration.json` and generated `ff-<role>` agent files as the role and model contract when delegation is available.
- Explicitly ask the harness to spawn the named `ff-<role>` agent for bounded delegated work; Codex only spawns subagents after the main session asks.
- Delegation is optional and permission-bound; continue inline when delegation is unavailable or unauthorized.
- Before delegated work, run `ff internal refresh-context-package --task <task-id>` when a task id is known, then provide context-package.md plus any role-specific original files that remain necessary.
- Delegated work receives the current context package, task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- The context package is not Repo Truth; stale manifests, missing sections, uncertain diff entries, or verdict work require reading original .ff files and git information.
- Delegated agents must not close tasks; closure decisions and unresolved drift return to the main session.

Role routing for this command:

- Clarify phase: use `ff-advisor` for Proposed Spec review when advisor mode or risk calls for an independent challenge.
- Plan phase: use `ff-planner` for plan.md/task.md drafting and `ff-reviewer` for artifact cross-review.
- Run phase: use `ff-implementer` for independent task.md implementation slices.
- Check phase: use `ff-checker` for verification and small in-scope repair, then `ff-reviewer` for broad final review when risk warrants it.
- Finish phase: use `ff-baseline-writer` only for candidate Project Baseline merge drafts; the main session still owns closure.

## Workflow Steps

1. Run `ff preflight --action work`.
2. If no task exists, create one with `ff internal create-task --title <title>` after deriving a clear title from the user request.
3. Select the task with `ff internal select-task` or `ff internal select-task --task <task-id>`.
4. Read spec.md, plan.md, task.md, and relevant project baseline files.
5. Route by current task phase and artifact state: clarify, plan, run, check, or finish readiness.
6. Apply the matching command behavior in this same agent session when the next step is clear.
7. Stop for user judgment when the matching phase requires confirmation, new requirements, or product behavior decisions.
8. When check passes, report finish readiness and ask whether to run ff-finish.

## Phase Guidance

- `ff-work` is the routine progress command. Repeated `/ff-work` calls should be enough to advance ordinary work through clarify, plan, run, and check.
- The executable `work` helper creates or selects the task and returns actionable status. The generated skill performs the judgment-heavy orchestration: questioning, planning, code edits, verification, and review.
- Use task truth to choose the next responsibility: clarify means challenge and accept the task contract, plan means create or repair plan.md and task.md, run means execute unchecked implementation items, check means verify and review evidence, and finish means stop before closure.
- When delegation is available, route bounded phase work to the matching role agent: `ff-advisor` for clarify review, `ff-planner` for planning, `ff-implementer` for independent implementation slices, `ff-checker` for verification, `ff-reviewer` for broad review, and `ff-baseline-writer` for baseline merge drafts.
- Delegation may help only when the harness, tools, and user or environment permission allow it; otherwise route phases and perform the same responsibilities inline.
- Do not close tasks from `ff-work`. When the task is ready for finish, summarize the closure readiness and ask whether to run `ff-finish`.
- If the phase, artifacts, or user request conflict, stop and resolve the conflict through the matching phase guidance before making code changes.


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
- ff internal refresh-context-package --task <task-id>
