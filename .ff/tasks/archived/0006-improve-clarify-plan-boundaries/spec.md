# Spec

## Goal

Improve the CW clarify and plan workflow so `cw-clarify` acts as a strict requirements reviewer by default, supports a low-friction light mode for small safe tasks, and hands `cw-plan` a confirmed task contract that is specific enough to plan and verify.

## Scope

This task covers the product behavior, generated agent guidance, templates, and tests needed to sharpen `cw-clarify` and `cw-plan`.

In scope:

- Define `cw-clarify` as the stage that turns a fuzzy user intent into a user-confirmed task contract.
- Add a grill-style clarify protocol: expand when needed, ask one important question at a time, provide a recommended answer, challenge unclear goals, and require checkable acceptance criteria.
- Keep `cw-clarify` capable of light handling for low-risk tasks with clear goals and obvious verification.
- Require `cw-clarify` to generate a short Proposed Spec in conversation before writing `spec.md`.
- Define `cw-plan` as the stage that turns a confirmed `spec.md` into `plan.md` and `task.md`.
- Add a `cw-plan` spec quality gate that returns to clarify with one concrete next question when the spec is insufficient.
- Update generated CW agent skills and relevant tests to reflect the clarified boundaries.

## Non-goals

- Do not add a new `cw-brainstorm` command or a separate brainstorm phase.
- Do not add a persisted `clarify.md` artifact.
- Do not add new task state fields for strict/light mode or spec quality status.
- Do not make `cw-plan` modify `spec.md` directly.
- Do not introduce `CONTEXT.md` or ADR creation as default clarify outputs.
- Do not redesign the entire CW lifecycle outside the clarify and plan boundary.

## Constraints

- Keep the existing `spec.md` sections: Goal, Scope, Non-goals, Constraints, Decisions, and Acceptance Criteria.
- Keep the implementation simple and direct; prefer generated skill guidance and targeted workflow checks over a large new state machine.
- Preserve existing lifecycle mechanisms: use the current blocked/clarify path when `cw-plan` finds an insufficient spec.
- Treat high-risk assumptions as blockers in strict clarify mode; low-risk assumptions may be stated in the Proposed Spec.
- Support fast combined execution through `cw-work` only for low-risk tasks with complete goals and clear verification.
- Use existing `baseline-delta.md` mechanics for stable reusable project facts; do not create a new documentation channel.

## Decisions

- `cw-clarify` defaults to strict requirements review.
- Light mode is allowed when the user explicitly asks for fast handling, or when the task is low risk, goal-complete, reversible, and has obvious verification.
- Strict mode automatically applies when the task affects product behavior, workflow semantics, CLI/API behavior, task lifecycle, state machines, cross-module behavior, irreversible work, or unclear acceptance criteria.
- Clarify remains one workflow stage. It may internally expand options before grilling, but this does not become a new command, state, or artifact.
- Expand should be result-oriented rather than implementation-oriented, with at most three candidate directions and one recommendation.
- Grill should ask one important question at a time, state the recommended answer, and call out the cost or trade-off when relevant.
- Clarify stops asking questions only when the goal, boundary, acceptance criteria, and key risks are clear enough to write a spec without high-risk assumptions.
- Both strict and light clarify modes should produce a Proposed Spec before `spec.md` is written. Light mode may use a compressed Proposed Spec.
- `spec.md` is the confirmed task contract. Unconfirmed ideas, brainstorm branches, and high-risk assumptions must not be silently written into it.
- `cw-plan` must not edit `spec.md`. If the spec is insufficient, it returns the task to clarify and provides one concrete next question.
- `cw-plan` should create implementation plans from the confirmed spec, including approach, implementation decisions, risks, validation strategy, and executable checklist items.
- `cw-plan` should break work into small, verifiable vertical slices rather than file-oriented chores.
- Lightweight terminology clarification belongs in `cw-clarify`. Task-local terms go in `spec.md`; stable reusable project concepts may become `baseline-delta.md` candidates.

## Acceptance Criteria
- [x] Generated `cw-clarify` guidance describes strict default behavior, light-mode triggers, automatic strict escalation, expand-then-grill behavior, and one-question-at-a-time interviewing.
- [x] Generated `cw-clarify` guidance requires a short Proposed Spec before writing `spec.md`, with high-risk assumptions handled by further questions.
- [x] Generated `cw-plan` guidance states that plan does not modify `spec.md` and must return to clarify with one concrete next question when the spec is insufficient.
- [x] The workflow preserves the existing `spec.md` section structure and does not introduce new persisted mode/status fields or a `clarify.md` artifact.
- [x] Planning guidance breaks work into small, verifiable vertical slices and keeps file-level changes as implementation details.
- [x] Tests or validation cover the updated generated skill text and the plan fallback behavior for insufficient specs.
