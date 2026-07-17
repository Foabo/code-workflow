# Architecture

## Stack

## Modules

- `src/index.ts`, `src/cli.ts`, and `src/agent-command.ts` are root thin entries. Product implementation lives under capability directories.
- Source modules are organized by product capability: `src/cli/`, `src/project/`, `src/workflow/`, `src/tasks/`, `src/baseline/`, `src/harness/`, `src/enhancements/`, `src/domain/`, and `src/shared/`.
- Each product capability exposes its cross-module surface through `src/<capability>/index.ts`.
- `src/domain/` contains shared Flowflow domain types, schema validators, orchestration constants, and pure shared rules.
- `src/shared/` contains business-neutral utilities such as filesystem, JSON, and Git helpers.
- `src/tasks/` owns task ids, task state files, traces, archive layout, resume notes, task selection, and task artifact templates.
- `src/harness/` owns generated skills, role agents, watchdog artifacts, and harness update behavior.
- `src/enhancements/` owns enhancement provider registry, setup planning, setup execution, and setup metadata.

## Data Flow

## Integration Points

## Constraints

- Cross-capability imports should use the target capability public entry by default. Required deep-import exceptions belong in `tests/architecture/module-boundaries.test.ts` with a narrow allowlist and reason.
- The stable package and command paths remain `./dist/src/index.js`, `./dist/src/index.d.ts`, `./dist/src/cli.js`, and `./dist/src/agent-command.js`.

## From task-codex-self-evolution

- Flowflow harness adapters generate repo-local skills as the default invocation surface. Codex, OpenCode, and Pi use `.agents/skills/`; Claude uses `.claude/skills/`.
- Generated skills reuse the same workflow action semantics and point back to `.ff` as Repo Truth.

- `ff-clarify` correctness belongs in deterministic Flowflow gates first. Generated skills and local hooks are invocation/enforcement surfaces, not the source of truth for whether `spec.md` may be written or a task may advance.
- Local watchdog artifacts should call a shared validator such as `ff internal validate-clarify --watchdog` rather than carrying independent per-harness gate logic.

- Codex role agents are generated from `.ff/orchestration.json` into `.codex/agents/ff-*.toml`; the local project uses role-specific Codex overrides: advisor `gpt-5.5` / `xhigh`, planner `gpt-5.5` / `high`, implementer `gpt-5.5` / `medium`, reviewer `gpt-5.5` / `high`, checker `gpt-5.4-mini` / `medium`, and baseline-writer `gpt-5.4-mini` / `low`.
- Generated workflow guidance uses phase-to-role routing when delegation is available: `ff-advisor` for clarify review, `ff-planner` for planning, `ff-implementer` for implementation slices, `ff-checker` for verification, `ff-reviewer` for broad review, and `ff-baseline-writer` for Project Baseline merge drafts.
- Codex subagents are spawned only after the main session explicitly asks the harness to spawn the named `ff-<role>` agent. Inline execution remains required for unavailable, unauthorized, or low-value delegation.

- Clarify gate identity (`attempt_id`/`proposal_id`/`proposal_hash`, `proposal_hash = sha256(spec content)`) is recorded via `ff internal propose-spec --task --spec-file` and `ff internal accept-spec --task --verdict ...`, which compute and thread the identity triple so agents do not hand-hash or hand-thread field names. `latestProposalIdentity(events)` is the exported read-side primitive (returns the latest proposal identity or null when absent/malformed).

- Flowflow stores Repo Truth under `.ff/`. Project baseline, templates, task state, archived tasks, enhancement config, orchestration config, trace events, and task artifacts live under this directory.
- Generated invocation surfaces use the `ff-*` prefix. Codex, OpenCode, and Pi repo-local skills are generated under `.agents/skills/`; Claude skills are generated under `.claude/skills/`; role agents are generated as `ff-<role>` files for each supported harness.
- Local clarify watchdog artifacts call `ff internal validate-clarify --watchdog`.

- `ff update` uses `.ff/orchestration.json` as the durable source for Flowflow role agent model configuration. Generated role agent files remain invocation surfaces.
- During update, Flowflow protects recognized user-edited role agent configuration fields before overwriting generated role agents: Codex TOML model fields and markdown/frontmatter model, temperature, tools, readonly, background, and capability-tier fields.

- `src/tasks/` 负责确定性任务上下文包及其 manifest。它们是 task-local generated view，输入来自 task artifacts、trace、Project Baseline、git status 和 diff 输入。
- `src/harness/` 只在渲染 workflow skills 和 role agents 时消费 context package guidance；context package 的事实生成不归 `src/harness/` 所有。

- OpenCode harness 会生成项目级 slash command 文件到 `.opencode/commands/<ff-command>.md`。这些 command 文件是 OpenCode 斜杠菜单和 command template 的调用表面，正文通过 `@.agents/skills/<ff-command>/SKILL.md` 引用对应 Flowflow skill，并包含 `$ARGUMENTS` 参数入口。
