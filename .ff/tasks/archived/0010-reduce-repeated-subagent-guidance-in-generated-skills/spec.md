# Spec

## Goal

Reduce repeated, low-signal execution strategy guidance in generated CW skills by generating `Execution Strategy Guidance` only for commands that have a real execution-strategy choice. Commands that use delegation should explain authorization boundaries and complete inline fallback in command-specific guidance. Commands without delegation behavior should not carry a generic execution-strategy section.

## Scope

This task covers generated skill guidance, adapter source, regenerated Codex skills, and tests.

In scope:

- Generate `Execution Strategy Guidance` conditionally instead of unconditionally for every skill.
- Remove `Execution Strategy Guidance` from generated commands that do not have a real execution-strategy choice.
- Keep concrete delegation rules in commands that use delegation or review strategy: `cw-work`, `cw-plan`, `cw-run`, and `cw-check`.
- Preserve the product rule that delegation requires harness support, available tools, and user or environment permission.
- Preserve the product rule that inline fallback must perform the same responsibility when delegation is unavailable or unauthorized.
- Keep a minimal global inline-completeness rule in `Rules` so every skill remains safe without an execution-strategy section.
- Regenerate Codex repo-local skills from adapter source.
- Update tests to verify execution-strategy sections are present only where useful and absent from unrelated commands.

## Non-goals

- Do not change the workflow lifecycle.
- Do not change actual subagent availability, authorization, or tool behavior.
- Do not make CI depend on subagent or LLM execution.
- Do not change task state schema or add task artifacts.
- Do not address the generic Helper Commands list in this task.

## Constraints

- Generated skills are invocation surfaces; adapter rendering code is the canonical source for generated guidance.
- `.cw` remains Repo Truth for task state, task artifacts, and Project Baseline files.
- Inline execution must remain complete for all commands, even when a command has no `Execution Strategy Guidance` section.
- Keep command guidance self-contained enough for agents that only read the invoked skill.

## Decisions

- `Execution Strategy Guidance` is not a mandatory section. It should appear only when a command has strategy choices such as inline, hybrid, delegation, independent review, or implementation splitting.
- `cw-work`, `cw-plan`, `cw-run`, and `cw-check` are the initial commands that need execution-strategy guidance.
- `cw-clarify`, `cw-finish`, `cw-resume`, `cw-discard`, `cw-doctor`, and `cw-understand` should not include `Execution Strategy Guidance` unless their own command guidance later introduces a real strategy choice.
- Detailed delegation guidance belongs in command-specific Phase Guidance where the command actually uses delegation, review, implementation splitting, or orchestration.
- The shared `Rules` section should carry the minimal inline-completeness invariant for all commands.

## Acceptance Criteria
- [x] `Execution Strategy Guidance` is generated only for commands with real execution-strategy choices.
- [x] Generated commands without delegation behavior do not include an `Execution Strategy Guidance` section.
- [x] The shared `Rules` section still states that inline execution must remain complete.
- [x] `cw-work`, `cw-plan`, `cw-run`, and `cw-check` retain command-specific delegation authorization and inline fallback guidance.
- [x] Generated support-command skills do not contain high-noise subagent detail or an unnecessary execution-strategy section.
- [x] Tests cover conditional section generation and retained command-specific delegation guidance.
- [x] Regenerated `.agents/skills/*` match adapter source.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
