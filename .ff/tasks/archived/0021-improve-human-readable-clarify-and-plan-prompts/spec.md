# Spec

## Goal
Improve the generated `ff-clarify` and `ff-plan` workflow prompts so agents produce clearer, more continuous, human-readable clarification and planning output. The prompts should reduce jargon, abstract filler, and jumpy reasoning, especially when the user writes in Chinese or reports that generated specs and plans are hard to understand.

## Scope
- Update the canonical generated workflow guidance source for `ff-clarify` and `ff-plan`, rather than hand-editing generated skill files as the source of truth.
- Add prompt guidance that tells agents to follow the user's language for user-visible clarify and plan output. When the user writes in Chinese, Brainstorm Pass, questions, Proposed Spec, plan summaries, task wording, and acceptance evidence should prefer Chinese except for commands, file paths, API names, code identifiers, and unavoidable product names.
- Add general plain-language rules for `ff-clarify` and `ff-plan`: explain what decisions mean for the user, state the next action plainly, connect motivation, scope, trade-offs, and evidence in order, and avoid vague workflow slogans.
- Add anti-pattern guidance inspired by the local plain-language skills, without depending on those local skills at runtime: avoid grand narratives, formulaic three-part lists, binary contrast formulas, empty positive endings, overused discourse markers, passive or actorless claims, and unexplained internal terminology.
- Keep necessary workflow terms allowed when they are required for correctness, but require user-visible output to explain their purpose in ordinary language the first time they matter.
- For `ff-plan`, require plan.md and task.md content to use executable actions and evidence-focused verification instead of abstract implementation labels.
- Update deterministic tests that verify the generated `ff-clarify` and `ff-plan` skills contain the new guidance.
- Regenerate affected harness artifacts for the repository-supported generated skill surfaces needed by the current tests.
- Add check-stage behavior review coverage so the task is not accepted on string presence alone.

## Non-goals
- Do not change the clarify gate sequence, proposal identity model, advisor review requirement, acceptance helper semantics, phase movement, or task lifecycle behavior.
- Do not broaden this task to all workflow commands.
- Do not update `ff-advisor`, `ff-planner`, `ff-reviewer`, or other role-agent prompts in this task.
- Do not add a separate humanizer skill, brainstorm skill, grill skill, or runtime dependency on the user's local `~/.agents/skills` directory.
- Do not require a single fixed writing style or force every repository to use Chinese regardless of the user's language.
- Do not redesign the `spec.md`, `plan.md`, or `task.md` templates beyond wording required by generated prompt guidance.

## Constraints
- Treat `.ff` as Repo Truth and generated skill files as invocation surfaces.
- Preserve the rule that generated workflow guidance is changed through adapter rendering code and then regenerated.
- Keep the existing `ff-clarify` fixed sequence and `ff-plan` spec quality gate intact.
- The guidance must remain portable across Codex, Claude, OpenCode, Pi, and Cursor generated skill surfaces.
- Tests may verify generated text, but final check must include behavior review for likely agent outcomes.

## Decisions
- Scope is limited to `ff-clarify` and `ff-plan` generated workflow prompts.
- The readability rule uses strong constraints without imposing one fixed voice: follow the user's language, explain necessary terms, prefer concrete decisions and evidence, and remove jargon that does not help the user decide.
- The screenshot is treated as an example symptom of a broader prompt problem, not as a list of special-case forbidden words.
- Local plain-language skills may inform the prompt rules, but Flowflow output must be self-contained and must not require those skills to exist.

## Acceptance Criteria
- [x] Generated `ff-clarify` guidance tells agents to use user-language-matched, plain, continuous clarification output and to explain required workflow terms in ordinary language.
- [x] Generated `ff-clarify` guidance discourages jargon, empty abstractions, formulaic AI writing, unexplained internal terminology, and jumpy movement from motivation to spec.
- [x] Generated `ff-plan` guidance tells agents to write plan.md and task.md as concrete actions, trade-offs, and verification evidence rather than abstract labels.
- [x] Generated `ff-plan` guidance preserves the existing spec quality gate and the rule that planning must not edit spec.md.
- [x] Tests fail if the new `ff-clarify` and `ff-plan` plain-language guidance disappears from generated skill output.
- [x] A check-stage behavior review records task-local notes for at least one `ff-clarify` scenario and one `ff-plan` scenario, evaluating whether the revised guidance would reduce vague specs/plans, skipped rationale, unexplained terms, and acceptance criteria without evidence.
- [x] Affected generated harness artifacts are refreshed from the canonical adapter source, not manually patched as durable truth.
- [x] Verification includes `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
