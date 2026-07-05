# Plan

## Approach

Implement this as two narrow guidance-and-behavior slices.

1. Tighten `cw-clarify` guidance in the adapter source.

   Replace the named fast-path concept with one proportional clarify process. Every task gets a challenge pass before Proposed Spec. The guidance should make small tasks quick by allowing a short challenge pass when risk and ambiguity are low, while still requiring the agent to test intent, assumptions, scope, acceptance criteria, risk, and shortest path. Broad, ambiguous, high-risk, or workflow-affecting tasks should expand result-oriented options before one-question-at-a-time grilling.

2. Make `cw-work` understandable as the default progress command.

   Add `cw-work` Phase Guidance that explains how the agent creates or selects a task, reads task truth, routes by current phase and artifact state, applies clarify/plan/run/check behavior, and stops before finish. Keep the executable `work` helper deterministic: it creates or selects a task and returns actionable status for the agent, while agent skill guidance performs the orchestration that requires judgment, code edits, verification, and review.

3. Regenerate and verify.

   Update adapter tests for generated `cw-clarify` and `cw-work` text. Add or refine workflow tests for `runWorkflowAction(root, "work", ...)` on existing tasks so the returned message/details are useful for the next responsible phase. Regenerate Codex repo-local skills through the existing update flow or adapter overwrite path, then run the project verification commands.

4. Review generated guidance for likely agent behavior.

   Add behavior-oriented review expectations to the generated guidance so `cw-clarify` and `cw-plan` changes are checked against failure modes such as skipped challenge, skipped grill, unclear delegation permission, premature plan/run movement, and acceptance criteria without evidence. Use an independent reviewer/subagent during this task's check phase if authorization and tools allow it. If not, record the inline reviewer checklist and reason in `task.md`.

## Key Decisions

- Keep `cw-work` orchestration at the agent skill layer. The executable `work` action remains a deterministic create/select/status helper because clarify, code implementation, and check review require agent judgment.
- Remove `fast path` from generated clarify guidance as a named mode. Clarify has one process with proportional intensity.
- Keep `cw-finish` outside automatic `cw-work` execution. `cw-work` reports finish readiness and asks before closure.
- Update `src/adapters.ts` as the canonical source for generated guidance, then regenerate `.agents/skills/*`.
- Use existing workflow state and artifacts. No new phase, field, or artifact is needed.
- Subagents are optional execution strategy, subject to harness support, available tools, and user or environment permission. Inline fallback must perform the same responsibility when delegation is unavailable or unauthorized.
- Deterministic tests should verify generated output. Behavior quality for nontrivial generated guidance should also be reviewed through an independent reviewer/subagent when allowed, or through a recorded inline reviewer checklist.

## Risks

- `cw-clarify` guidance can become long and vague. Keep it operational: challenge pass, expand trigger, grill trigger, Proposed Spec gate.
- If `cw-work` guidance promises full CLI automation, users may expect `cw-work` binary execution to write code. Keep the distinction clear: executable helper selects state; generated skill orchestrates the work.
- Existing tests may assert older wording such as `fast path`. Update them to assert durable behavior phrases.
- Plan and task artifacts can overfit to file edits. Keep checklist items user-visible and verifiable.
- Subagent review can become a hidden dependency if it is required in CI. Keep it as check-phase review evidence, not as a deterministic test requirement.
- Inline review can be too agreeable if the reviewer checklist is vague. Use explicit failure modes from the spec.

## Validation Strategy

- Inspect generated `cw-clarify` and `cw-work` skills after regeneration.
- Run focused tests that assert generated skill guidance for proportional clarify and `cw-work` phase routing.
- Verify generated subagent-boundary guidance explains permission requirements and complete inline fallback.
- During check, run independent reviewer/subagent review if authorization and tools allow it; otherwise record the inline reviewer checklist and reason in `task.md`.
- Keep automated tests deterministic and free of LLM/subagent runtime dependencies.
- Run or add workflow behavior tests for existing-task `work` status.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .`.
