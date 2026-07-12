---
name: ff-work
description: Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.
---

Use this skill for the `ff-work` Flowflow workflow action in this repository. Trigger it for `/ff-work`, `$ff-work`, `ff work`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-work

Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.

## Contract

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Read only the task and Baseline inputs required by this phase; use ff internal helpers for state and trace changes.
- Treat context-package.md as an explicit diagnostic artifact. Workflow actions and delegated roles do not refresh or load it automatically.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Delegation is optional and permission-bound; continue inline when unavailable. Use `.ff/orchestration.json` and `ff-<role>` agents for role/model routing.
- The main session owns code discovery. When an index is configured and its tool is visible, query it first. Record `call-failed`, provider `failed`/`skipped`/`unconfigured`, or `tool-missing` before falling back to `rg`, file lists, and direct reads.
- Save the bounded discovery result as validated code-context JSON, then run `ff internal build-work-packet --task <task-id> --role <role> [--code-context-file <path>]`.
- Spawn the named role with only a bounded task instruction and the command's stdout packet. The packet already contains validated code context. Do not pass the full task set, context package, manifest, evidence directory, or chat history.
- Missing required context must produce degraded or insufficient-context. Delegated roles do not close tasks or decide drift, scope, worktree handling, or Baseline promotion.

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
