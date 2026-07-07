# Spec

## Goal

Make `cw-work` a clear and useful default progress entry point, and repair the `cw-clarify` gap that lets vague or under-tested user intent pass through without challenge. A user should be able to call `/cw-work` repeatedly to create or select a task, route the current task through clarify, plan, run, and check behavior, and then stop before finish for explicit user confirmation. The clarify stage must actively frame, challenge, and grill the work before writing the accepted task contract.

## Scope

This task covers generated guidance, executable workflow behavior where needed, and tests for `cw-work` and `cw-clarify`.

In scope:

- Add dedicated `cw-work` Phase Guidance to the generated skill source.
- Explain how `cw-work` creates or selects a task, reads task truth, decides the next responsible phase, and applies the matching command behavior.
- Make the routine path clear: repeated `/cw-work` calls should be enough to keep ordinary task progress moving.
- Keep `cw-work` stopped before `cw-finish` after check passes.
- Improve executable `work` results if needed so existing-task selection returns actionable next-step information.
- Replace `cw-clarify` fast-path language with one unified clarify process whose intensity scales with task size, ambiguity, and risk.
- Require `cw-clarify` to perform a challenge pass before Proposed Spec: frame the original problem and motivation, check assumptions, scope, acceptance criteria, risk, and shortest path, then grill only where important uncertainty remains.
- Require high-risk or unclear work to expand possible user-visible directions before grilling, using at most three options and one recommendation.
- Make `cw-clarify` challenge user requests rather than merely transcribe them into `spec.md`.
- Clarify generated skill guidance around subagent use: subagents are optional execution strategies that require harness support, available tools, and user or environment permission.
- Require inline fallback guidance to carry the same responsibility when subagents are unavailable or unauthorized.
- Remove ambiguity from `cw-plan` post-plan review guidance so an independent reviewer subagent is preferred only when allowed, while inline review remains fully valid.
- Add behavior-oriented review expectations for generated `cw-clarify` and `cw-plan` guidance, so changes are checked for likely agent behavior rather than only for string presence.
- During this task's check phase, use an independent reviewer/subagent for generated-guidance review when authorization and tools allow it.
- If independent reviewer/subagent review is unavailable or unauthorized, record the inline reviewer checklist and the reason in `task.md`.
- Keep automated tests deterministic; do not make LLM or subagent execution a CI dependency.
- Regenerate the Codex repo-local `cw-work` and `cw-clarify` skills from adapter source.
- Add or update tests for generated `cw-work` and `cw-clarify` guidance and the executable `work` action behavior.

## Non-goals

- Do not redesign the CW lifecycle.
- Do not add task state fields or new task artifacts.
- Do not remove the precise commands `cw-clarify`, `cw-plan`, `cw-run`, `cw-check`, or `cw-finish`; they remain available for direct phase control.
- Do not make `cw-work` close tasks automatically.
- Do not make `cw-work` perform Project Baseline sync without the existing finish confirmation path.
- Do not add a separate brainstorm command, persisted brainstorm artifact, or new clarify state field.
- Do not keep `fast path` as a named clarify mode or guidance concept.
- Do not make subagents mandatory for workflow correctness.
- Do not imply generated CW skills can override harness, tool, or user permission rules for delegation.

## Constraints

- `.cw` remains Repo Truth for workflow state, task artifacts, and Project Baseline files.
- Generated skills are invocation surfaces; adapter rendering code is the canonical source for generated guidance.
- `cw-work` must preserve the ADR 0029 boundary: check can pass, then work stops before finish.
- `cw-finish` remains the explicit closure action because it can close the task, handle dirty worktree state, and sync baseline deltas.
- `cw-clarify` keeps the existing `spec.md` sections: Goal, Scope, Non-goals, Constraints, Decisions, and Acceptance Criteria.
- Subagent use is an execution strategy only. It cannot be required when the harness, available tools, or current user authorization do not allow delegation.
- Keep the solution simple and direct; prefer guidance plus narrow behavior/test changes over a new orchestration state machine.

## Decisions

- `cw-work` is the default task progress command for routine use.
- `cw-work` may create or select a task, then route the agent to the behavior of the current phase.
- The current task phase and task artifacts decide the next responsible action.
- If the task needs user judgment, `cw-work` stops and asks through the relevant phase behavior.
- After check passes, `cw-work` reports finish readiness and asks whether to run `cw-finish`.
- `cw-clarify` has one process for all tasks. Small tasks should complete quickly because the challenge pass finds few important uncertainties, not because clarify has a bypass mode.
- Every `cw-clarify` run performs a challenge pass before writing Proposed Spec.
- The challenge pass must identify the original problem, user motivation, obvious missing facts, unsafe assumptions, scope boundaries, acceptance criteria, and whether there is a shorter path.
- If the challenge pass finds unresolved important uncertainty, `cw-clarify` grills one question at a time and includes a recommended answer with the trade-off.
- If the request is broad, ambiguous, or high risk, `cw-clarify` first expands result-oriented options before grilling.
- "Prefer subagent" means use one when it is supported and authorized. When it is unavailable or unauthorized, inline execution must perform the same planning, review, checking, or implementation responsibility.
- `cw-plan` post-plan review should not require an independent reviewer subagent; it should prefer one only when allowed and use inline review as a complete fallback.
- String tests prove generated wording is present; they do not prove the workflow guidance will make an agent challenge intent, grill unresolved uncertainty, or avoid premature phase movement.
- Nontrivial generated guidance changes should be reviewed against behavior failure modes: skipped challenge, skipped grill, unclear subagent permission, premature plan/run movement, and acceptance criteria without evidence.
- CI should verify deterministic generated output. Human or agent review should verify behavior quality when the environment supports it.

## Acceptance Criteria
- [x] Generated `cw-work` guidance includes command-specific Phase Guidance.
- [x] Generated `cw-work` guidance explains create/select behavior, task-truth reading, phase routing, and stop conditions.
- [x] Generated `cw-work` guidance states that repeated `/cw-work` calls can advance ordinary work through clarify, plan, run, and check.
- [x] Generated `cw-work` guidance states that check-passed tasks stop before finish and require explicit confirmation before `cw-finish`.
- [x] Generated `cw-clarify` guidance removes `fast path` as a named behavior or mode.
- [x] Generated `cw-clarify` guidance requires one unified challenge pass before Proposed Spec for every task.
- [x] Generated `cw-clarify` guidance explains that small tasks are faster because fewer uncertainties survive the challenge pass.
- [x] Generated `cw-clarify` guidance requires active challenge of user intent, assumptions, scope, acceptance criteria, risk, and shortest path.
- [x] Generated `cw-clarify` guidance uses expand-then-grill for broad, ambiguous, high-risk, or workflow-affecting tasks.
- [x] Generated `cw-clarify` guidance requires one-question-at-a-time grilling with a recommended answer and trade-off when important uncertainty remains.
- [x] Generated common execution guidance explains that subagents require harness support, available tools, and user or environment permission.
- [x] Generated guidance states inline fallback must perform the same responsibility when subagents are unavailable or unauthorized.
- [x] Generated `cw-plan` post-plan review guidance no longer creates ambiguity about mandatory subagent use.
- [x] Generated guidance changes for `cw-clarify` and `cw-plan` include behavior-oriented review expectations, not only text presence checks.
- [x] This task's check phase uses an independent reviewer/subagent if authorized and available.
- [x] If subagent review is unavailable or unauthorized, `task.md` records the inline reviewer checklist and reason.
- [x] Tests continue to cover deterministic generated guidance output without requiring LLM/subagent execution in CI.
- [x] Executable `work` behavior for existing tasks returns actionable next-step information.
- [x] Tests cover generated `cw-work` guidance, generated `cw-clarify` guidance, generated subagent-boundary guidance, and executable `work` behavior.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
