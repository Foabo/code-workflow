# Spec

## Goal

Improve the generated CW guidance for `cw-run`, `cw-check`, and `cw-finish` so agents execute confirmed plans predictably, catch artifact and implementation drift before finish, and close tasks through a clear closure packet.

## Scope

This task focuses on agent behavior guidance first, with only small workflow gate changes when needed to make the guidance testable.

In scope:

- Update generated `cw-clarify` guidance so strict/light mode labels are replaced by a single clarify quality gate with a fast path only when observable conditions are satisfied.
- Keep expand-then-grill behavior as the fallback when the clarify quality gate fails or high-risk triggers are present.
- Add `cw-run` phase guidance that defines run as execution against the confirmed `spec.md`, `plan.md`, and `task.md`.
- Tell `cw-run` to stop for user confirmation when implementation work reveals requirement drift, plan contradictions, or product behavior outside the accepted task contract.
- Add `cw-run` guidance for using TDD, subagents, and domain modeling only when their trigger conditions fit the task.
- Add `cw-run` testing guidance: product behavior, workflow semantics, CLI/API behavior, state transitions, parsing, validation, and error handling require test evidence by default; red-green TDD is preferred when it fits the slice but not mandatory for every task.
- Keep generated CW skills self-contained when referencing practices such as grill, TDD, domain modeling, or subagent-driven development: include the trigger boundary and minimum behavior, and treat external skills as optional enhancements.
- Add a `cw-plan` post-plan cross-review step that checks `spec.md`, `plan.md`, and `task.md` for internal contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work before moving to run.
- Prefer an independent reviewer subagent for nontrivial post-plan artifact cross-review when the harness supports it, with an inline fallback that performs the same checks when subagents are unavailable.
- Add `cw-check` guidance for artifact alignment review and implementation evidence review.
- Require `cw-check` to connect every acceptance criterion to evidence such as tests, commands, file checks, or manual verification notes.
- Keep evidence in `task.md` Verification or Check sections and trace summaries; do not add a separate evidence artifact or require a rigid table format.
- When verification depends on CI/CD or a test environment, require the evidence to state the environment, action, and result.
- Define artifact alignment handling: `plan.md` and `task.md` defects may be fixed during check when the accepted spec is unchanged; changes to `spec.md` require returning to clarify for user confirmation; implementation outside spec cannot be accepted by silently expanding the spec during check.
- Add `cw-check` guidance for small local defect fixes, spec drift escalation, and final whole-change review when the change is broad.
- Add `cw-finish` guidance for producing a closure packet covering check evidence, dirty worktree handling, baseline decision, drift state, and final summary.
- Clarify that CW task closure is separate from Git commit, push, PR, deployment, and CI/CD validation workflows. A task may have zero, one, or many commits before finish.
- Avoid requiring check or finish to record a verified commit, HEAD, or Git ledger, because commits may include unrelated changes.
- Change baseline sync semantics so Project Baseline files remain current-state descriptions rather than append-only task logs.
- Make `cw-finish` default to preparing a candidate baseline diff for user review when `baseline-delta.md` exists.
- Let the finish-stage agent decide how to merge `baseline-delta.md` into baseline files, prepare the candidate diff, and ask the user to confirm before helpers apply it.
- Remove generated marker comments from generated skill bodies and preserve generated skill stale detection through a less distracting mechanism.
- Update generated agent skill text and tests for the new guidance.

## Non-goals

- Do not introduce `.superpowers/`, a separate review report artifact, or a progress ledger.
- Do not add a separate check report or evidence artifact.
- Do not add new task state fields.
- Do not require every task to use subagents.
- Do not require TDD for non-behavioral work, generated files, configuration-only changes, or tasks where the user explicitly approves another verification strategy.
- Do not require red-green evidence for every acceptance criterion when a command, fixture, snapshot, file check, or manual review is the right verification method.
- Do not copy Superpowers worktree, merge, pull request, or branch cleanup behavior into CW finish.
- Do not make `cw-finish` create commits, require a single final commit, push branches, create PRs, deploy, or clean up branches.
- Do not require `cw-check` or `cw-finish` to record a verified commit SHA, HEAD baseline, or commit ledger.
- Do not silently append stale or contradictory baseline text to `.cw/project/*`.
- Do not require a specific external model provider or model name for baseline diff preparation.
- Do not make the CW CLI core call an LLM to generate baseline merges.
- Do not make user-invoked skills such as `implement` automatic CW dependencies.
- Do not require users to install external grill, TDD, domain modeling, implement, or Superpowers skills for generated CW skills to work.
- Do not add persisted strict/light mode fields or a separate clarify artifact.
- Do not redesign the full CW lifecycle outside the plan, run, check, and finish boundaries touched by this task.

## Constraints

- `.cw` remains the workflow repo truth for task state, task artifacts, project baseline, and closure.
- Generated skills remain invocation surfaces; update adapter source and regenerate them rather than hand-editing generated skill files as canonical truth.
- Keep the existing lifecycle: clarify -> plan -> run -> check -> finish.
- Keep `baseline-delta.md` for stable reusable project facts only.
- Preserve existing closure gate mechanics unless a narrow testable check is needed.
- Keep skill text concise and predictable using the `writing-great-skills` quality bar: single source of truth, checkable completion criteria, relevant wording, and no unnecessary duplication.
- Do not place machine-oriented generated metadata inside the instructional body of generated skills.
- Keep the clarify update narrow: revise generated guidance and tests without changing task state schema or adding a new command.

## Decisions

- Optimize for clearer generated skill behavior before adding heavier CLI automation.
- Replace `cw-clarify` strict/light mode labels with observable rules: goal concrete, scope bounded, acceptance criteria checkable, and risk low enough for a short Proposed Spec.
- Use expand-then-grill when any clarify gate fact is missing or when the request affects workflow semantics, CLI/API behavior, lifecycle, state machines, cross-module behavior, irreversible work, or baseline promotion.
- Treat Superpowers 6.1.1 as reference material, especially its plan pre-flight review, task reviewer dual verdict, final broad review, file handoff discipline, and TDD evidence expectations.
- Translate external workflow lessons into CW terms; do not import external artifact directories or state models.
- Place the cross-review for `spec.md`, `plan.md`, and `task.md` after `cw-plan` writes the plan artifacts and before the task enters run.
- Nontrivial post-plan artifact cross-review should use an independent reviewer subagent when supported; unsupported harnesses and small tasks must still run the same alignment check inline rather than skipping it.
- `cw-run` may reference TDD, subagent execution, and domain modeling as conditional techniques, but CW baseline and task artifacts remain authoritative.
- Behavior changes require test evidence by default. Red-green TDD is the preferred implementation loop when a clear test seam exists, while generated text, config, documentation, and one-off migration work may use other explicit evidence.
- External skills and plugins are optional enhancement paths. Generated CW skills must include enough guidance to execute their core behavior without those skills installed.
- `cw-check` should verify both artifact alignment and implementation evidence before allowing finish.
- Evidence should be readable from `task.md` Verification or Check entries. Large tasks may map evidence by acceptance criterion; small tasks may use concise checklist entries when coverage is still clear.
- CI/CD and test-environment evidence should describe the environment, verification action, and observed result without relying on commit identity.
- During check, execution-artifact defects in `plan.md` or `task.md` may be corrected if the accepted `spec.md` contract remains unchanged. Spec changes and out-of-scope implementation behavior require user confirmation through clarify before check can pass.
- `cw-finish` should be a closure gate and reporting step, not a late product-design review.
- Git history is independent of CW task lifecycle. Commits may happen during run or check when needed for CI/CD, test environment deployment, or review checkpoints; finish only verifies and records the resulting task closure state.
- Check evidence should describe the task behavior or artifact verified, not rely on commit boundaries as the source of truth.
- Project Baseline files should describe the current project state. When `baseline-delta.md` exists, finish should prepare a candidate diff that integrates the delta into the existing baseline, replacing or revising outdated text when appropriate.
- A fast inexpensive model may help draft the candidate baseline diff when available, but the generated skill must also support inline/manual diff preparation. The candidate diff is never applied without user confirmation.
- Baseline merge intelligence belongs to the finish-stage agent, not the deterministic CLI core. Helpers should apply an accepted candidate or record skip/selection decisions.
- Generated skill freshness should be checked without forcing agents to read `generated-by-cw` comments as part of the skill instructions.

## Acceptance Criteria
- [x] Generated `cw-clarify` guidance no longer relies on strict/light mode labels as the primary behavior switch.
- [x] Generated `cw-clarify` guidance defines a single clarify quality gate and a fast path only when the goal, scope, acceptance criteria, and risk are clear enough for a Proposed Spec.
- [x] Generated `cw-clarify` guidance keeps expand-then-grill behavior for missing facts and high-risk workflow changes.
- [x] Generated CW guidance does not require external grill, TDD, domain modeling, implement, or Superpowers skills to be installed; any references include trigger boundaries and minimum inline behavior.
- [x] Generated `cw-run` guidance defines run as execution against the confirmed task contract and tells agents when to stop for requirement drift, plan contradiction, or product behavior outside scope.
- [x] Generated `cw-run` guidance requires test evidence by default for behavior changes and treats red-green TDD as preferred when a clear test seam exists, not mandatory for every task.
- [x] Generated `cw-run` guidance covers the trigger boundaries for TDD, subagents, and domain modeling without making those techniques mandatory for every task.
- [x] Generated `cw-plan` guidance includes a post-plan cross-review of `spec.md`, `plan.md`, and `task.md` before moving to run, preferring an independent reviewer subagent for nontrivial tasks with inline fallback when unavailable.
- [x] Generated `cw-check` guidance defines artifact alignment review and implementation evidence review.
- [x] Generated `cw-check` guidance requires each acceptance criterion to have evidence from a test, command, file check, or manual verification note.
- [x] Generated `cw-check` guidance keeps evidence in `task.md` Verification or Check entries and does not require a new check report artifact or rigid table.
- [x] Generated `cw-check` guidance says CI/CD or test-environment evidence should state environment, action, and result without relying on commit identity.
- [x] Generated `cw-check` guidance allows fixing `plan.md` or `task.md` alignment defects during check when `spec.md` is unchanged, and requires returning to clarify for spec changes or out-of-scope implementation behavior.
- [x] Generated `cw-finish` guidance defines a closure packet covering check evidence, dirty worktree handling, baseline decision, drift state, and final summary.
- [x] Generated `cw-finish` guidance states that finish does not create commits, require a single final commit, push, open PRs, deploy, or clean up branches; Git commit cadence remains independent from CW task closure.
- [x] Generated `cw-check` and `cw-finish` guidance do not require recording a verified commit SHA, HEAD baseline, or commit ledger.
- [x] Generated `cw-finish` guidance treats `.cw/project/*` baseline files as current-state descriptions and defaults to a user-reviewed candidate baseline diff instead of append-only sync.
- [x] Baseline sync behavior or guidance prevents silent accumulation of stale or contradictory baseline entries.
- [x] Generated `cw-finish` guidance assigns baseline merge preparation to the finish-stage agent and keeps the CLI core deterministic.
- [x] Generated skill bodies no longer include `generated-by-cw` marker comments, and doctor or validate still detects stale generated skills.
- [x] Tests or validation cover the updated generated skill guidance and any narrow workflow gate changes introduced by the implementation.
