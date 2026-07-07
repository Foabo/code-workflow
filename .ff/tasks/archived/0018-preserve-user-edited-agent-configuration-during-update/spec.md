# Spec

## Goal

Make `ff update` preserve user-edited role agent configuration instead of silently overwriting model-related settings when Flowflow refreshes generated skills and agents after a project has already been initialized.

## Scope

- Define `.ff/orchestration.json` as the durable source for Flowflow role model configuration.
- Detect existing role agent files whose configurable header/frontmatter values differ from the expected generated output before overwriting them during `ff update`.
- For user-edited role agent configuration, make `ff update` stop by default with a clear message that explains the affected files, the protected fields, and the migration path into `.ff/orchestration.json`.
- Add an explicit force path that lets a user knowingly overwrite protected agent-file changes.
- Preserve the existing ability for `ff update` to refresh generated workflow skills, role agent instructions, watchdog artifacts, and role agents generated from `.ff/orchestration.json`.
- Cover Codex role agent TOML and markdown/frontmatter role agents for Claude, OpenCode, Pi, and Cursor.
- After a successful `ff update`, print a final restart notice telling the user to restart or reload their agent so updated skills and agents are picked up by the host.

## Non-goals

- Do not make direct edits to generated role agent files the canonical long-term configuration mechanism.
- Do not build a full three-way merge system for arbitrary user edits inside generated role agent bodies.
- Do not change `ff init` provider setup behavior beyond whatever is required for this update contract.
- Do not change advisor, planner, implementer, reviewer, checker, or baseline-writer role semantics.

## Constraints

- Generated skills and role agents remain invocation surfaces; `.ff` remains Repo Truth.
- The default `ff update` path must not silently lose user-edited model, reasoning, temperature, tool, readonly, or permission-style role agent settings.
- Project-owned defaults from `.ff/orchestration.json` must still regenerate role agents deterministically.
- The solution must be deterministic and local; the CLI core must not call an LLM to reconcile files.
- Existing stale generated-output validation should continue to identify out-of-date generated files.
- The restart notice must be informational and must not imply that Flowflow can reload the host agent process itself.

## Decisions

- `.ff/orchestration.json` is the durable configuration source for Flowflow role model configuration.
- A direct edit to a generated role agent file is treated as protected user configuration only for recognized configuration fields, such as model, reasoning effort, temperature, tool permissions, readonly/background flags, and equivalent harness-specific header/frontmatter fields.
- `ff update` defaults to protect mode: when protected user configuration is detected, it stops before overwriting those role agent files and reports how to move the configuration into `.ff/orchestration.json`.
- A user may explicitly override protection with a force option, which overwrites generated role agents from `.ff/orchestration.json`.
- Generated body/instruction drift remains updateable; protection is about user-facing role agent configuration fields, not every textual difference in generated instructions.
- The confirmed user decision for this task is: default protection is required, with explicit force for intentional overwrite.
- Successful `ff update` output ends with a restart notice for the selected harness. If update stops before overwriting protected user configuration, the output should instead tell the user how to resolve the conflict and rerun update; it should not present that aborted run as a successful refresh.

## Acceptance Criteria
- [x] `ff update --harness codex` refuses to overwrite a generated Codex role agent when the existing `.codex/agents/ff-*.toml` has a user-edited model or reasoning setting that differs from the expected `.ff/orchestration.json` output.
- [x] `ff update --harness <claude|opencode|pi|cursor>` refuses to overwrite a generated markdown/frontmatter role agent when recognized model, temperature, tool, readonly, background, or equivalent configuration fields differ from expected output.
- [x] The refusal message names the affected file(s), names the protected field(s), explains that `.ff/orchestration.json` is the durable source, and shows the explicit force option for intentional overwrite.
- [x] An explicit force option for `ff update` overwrites the protected role agent file with content generated from `.ff/orchestration.json`.
- [x] Changes made in `.ff/orchestration.json` still regenerate role agents successfully with ordinary `ff update`.
- [x] Generated workflow skills and watchdog artifacts still update normally when no protected role agent configuration conflict exists.
- [x] A successful `ff update` prints a final message telling the user to restart or reload the selected agent host so refreshed skills and role agents become available.
- [x] A protected-configuration refusal does not claim that the update completed; it tells the user to migrate configuration or use force, then rerun update before restarting/reloading the agent.
- [x] Tests cover protected Codex TOML configuration, protected markdown/frontmatter configuration, force overwrite, and `.ff/orchestration.json`-driven regeneration.
- [x] Project validation, typecheck, tests, build, and Flowflow validate/doctor pass after implementation.
