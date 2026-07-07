# Plan

## Approach

Implement this as a contract-first adapter expansion. The first deliverable is a precise orchestration contract in `DESIGN.md`; source and generated artifacts then encode that contract in a harness-specific way.

1. Define the orchestration contract in `DESIGN.md`.

   Replace the current short agent-orchestration section with a complete contract covering roles, authority boundaries, orchestration modes, advisor policy, handoff packages, report contracts, result reconciliation, failure fallback, model profiles, and harness capability mapping. Keep it explicit that orchestration is an execution strategy layer and does not change CW lifecycle state.

2. Add a project-level orchestration configuration model.

   Define a small CW orchestration config surface for advisor policy and per-role model profile overrides. The config should express capability tiers and harness-specific selectors without making any specific vendor model part of the role semantics. If implementation adds a file, prefer a structured `.cw/orchestration.json` with schema validation and defaults; keep it optional so existing projects remain valid.

3. Refactor adapter source around reusable role definitions.

   Add canonical role definitions for `advisor`, `planner`, `implementer`, `reviewer`, `checker`, and `baseline-writer`. Each role definition should include purpose, phase usage, permissions, model profile, handoff inputs, report contract, escalation triggers, and generated prompt text. Update workflow-skill rendering so strategy-aware commands reference the same role and advisor contracts instead of duplicating loose prose.

4. Add harness-specific role-agent generation.

   Extend adapter generation for supported harnesses:

   - Claude Code: generate `.claude/agents/cw-*.md` role agents with frontmatter fields such as `description`, `tools`, and `model` where appropriate.
   - Codex: generate `.codex/agents/cw-*.toml` custom agents with `name`, `description`, `developer_instructions`, and optional model or reasoning fields.
   - OpenCode: generate `.opencode/agents/cw-*.md` role agents or config-compatible prompt files, using model and permission guidance that matches OpenCode's agent model.
   - Cursor: generate `.cursor/agents/cw-*.md` role agents with `description`, `model`, and readonly/background choices where appropriate.
   - Pi: generate only truthful role guidance or package-compatible role prompts unless the adapter has a stable native role-agent surface to target.

   For every harness, avoid generating a role artifact that claims runtime behavior the harness cannot actually provide.

5. Encode the default-enabled advisor policy.

   The generated guidance should default to advisor-enabled behavior. Capable runtimes use OMP-style always-on turn review; less capable runtimes use gate-triggered and high-risk advisor checks. All paths must keep bounded backlog, dedupe/noise controls, advisor-only guidance, severity levels, and main-session adjudication in the contract.

6. Update tests and regenerate artifacts.

   Add tests for role-agent generation, role permissions, model-profile text, advisor policy, harness capability differences, support-command restraint, and stale generated artifact detection. Regenerate all selected repo-local harness artifacts from adapter source.

## Key Decisions

- Agent orchestration is an execution strategy layer. It must not change CW's lifecycle, task state truth, or closure authority.
- The default role set is `advisor`, `planner`, `implementer`, `reviewer`, `checker`, and `baseline-writer`. There is no default `clarifier` role agent; clarify remains a main-session responsibility, with advisor as a skeptical review role.
- Advisor behavior is default-enabled. Always-on turn review is preferred when the harness/runtime supports it; gate-triggered and high-risk checks are the fallback.
- Role-agent artifacts are generated only for harnesses with a truthful role-agent file surface.
- Model configuration is capability-tier first and harness-selector second. Role semantics are not tied to a specific vendor model.
- Override precedence is explicit: user/session override, task or handoff override, role artifact setting, project CW orchestration config, harness native config, CW built-in tier default.
- Generated support-command skills remain concise unless the command has a real strategy choice.

## Risks

- The task can become too broad by trying to implement an actual scheduler. Mitigate by defining runtime contracts and generated artifacts only; leave worker pools, cloud APIs, automatic worktree management, and model routing execution to later tasks.
- Harness capabilities can drift. Mitigate by keeping the capability matrix in `DESIGN.md`, by generating only stable surfaces, and by writing tests around generated paths and key frontmatter/config fields.
- Role prompts can become too long or generic. Mitigate by keeping role agents narrow and moving shared contracts into source-rendered common sections.
- Default-enabled advisor could add cost or noise in capable runtimes. Mitigate with explicit policy controls, severity levels, dedupe/rate limits, bounded backlog, and fallback to non-blocking gate checks.
- Model config can become obsolete quickly. Mitigate by defining capability tiers and override precedence, while letting concrete model selectors live in project or harness config.
- Generated Codex and Cursor role agents may overlap conceptually. Mitigate by sharing canonical role definitions while rendering different native file formats.

## Validation Strategy

- Inspect `DESIGN.md` for the full orchestration contract and ensure it covers every accepted spec decision.
- Inspect generated workflow skills for strategy-aware command guidance and support-command restraint.
- Inspect generated role-agent artifacts for each supported harness and verify that unsupported runtime claims are absent.
- Verify tests cover role definitions, advisor defaults, model profiles, override precedence, harness-specific paths, and absence of high-noise orchestration guidance in support commands.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .`.

## Replan Delta

Accepted clarify changes after the first implementation pass require a focused second run. Keep the earlier contract work, but revise the implementation around five concrete areas:

1. Expand model reasoning schema and resolution.

   Update the CW reasoning-effort type and schema to accept `none`, `low`, `medium`, `high`, `xhigh`, `auto`, and `null`. Do not add `minimal`. Make model resolution merge built-in role profiles, `.cw/orchestration.json`, and per-harness role overrides before rendering role agents. Preserve `null` as inheritance.

2. Apply the current Codex project override.

   Use the current local Codex subscription model `gpt-5.5` for this repo's Codex role overrides. After schema support lands, set Codex role reasoning overrides to `xhigh`. Render Codex custom agents with real multiline TOML `developer_instructions`, plus `model` and `model_reasoning_effort` only when resolved.

3. Make Pi use `pi-subagents` as the default real setup path.

   Add Pi setup behavior that actually runs `pi install npm:pi-subagents` by default during Pi initialization unless explicitly skipped. Change Pi role-agent generation to `.pi/agents/cw-*.md` for `pi-subagents` project-agent discovery, while keeping fallback guidance truthful when the extension is skipped or unavailable. `cw update --harness pi` must not silently install anything.

4. Render OpenCode agents in the documented Markdown format.

   Keep `.opencode/agents/cw-*.md`, but update frontmatter to match OpenCode Markdown agents: file name defines the agent name, `description`, `mode: subagent`, model configuration when resolved, optional temperature when configured, and explicit `tools` permissions such as `write`, `edit`, and `bash`. Read-only roles should deny write/edit/bash.

5. Reduce advisor boilerplate in generated command skills.

   Remove advisor policy from shared execution-strategy boilerplate. Keep advisor semantics in `DESIGN.md`, `.cw/orchestration.json`, and `cw-advisor`. Mention advisor in command skills only where it changes concrete behavior: clarify Proposed Spec review, plan/check high-risk gates, or another explicit trigger.

## Replan Validation

- Add schema tests for accepted and rejected reasoning-effort values, including rejecting `minimal`.
- Add generation tests for Codex multiline TOML, resolved Codex model and `xhigh` reasoning, OpenCode tools permissions, Pi `.pi/agents` output, and absence of repeated advisor boilerplate in `cw-work` and `cw-run`.
- Add CLI/setup tests that Pi init executes `pi install npm:pi-subagents` by default and that `cw update --harness pi` only refreshes generated files.
- Refresh task-local fixture projects for Claude Code, OpenCode, Pi, and Cursor after implementation so the user can inspect generated skills and model configuration.
