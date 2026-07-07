# Spec

## Goal

Define CW's first complete agent-orchestration contract so generated harness guidance and role-agent artifacts can combine the CW workflow with proven multi-agent patterns while preserving CW's core invariants: `.cw` is workflow truth, Git is code-change truth, the main session owns user-facing judgment, and inline execution remains complete.

The contract should make agent behavior more reliable for clarify, plan, run, and check work, and it should settle the multi-agent design enough that later implementation can add runtime scheduling, worktree lanes, cloud agents, or model routing without redefining roles or authority.

## Scope

This task covers the design, generated guidance, and generated role-agent surfaces for CW agent orchestration.

In scope:

- Update the agent-orchestration section in `DESIGN.md` so it is specific enough to guide implementation.
- Define the default orchestration roles: advisor, planner, implementer, reviewer, checker, and baseline-writer.
- Define a canonical role model for CW agents, including role purpose, allowed phases, allowed writes, required inputs, required outputs, escalation triggers, and model/cost guidance.
- Define model selection as part of the canonical role model, including required capability tier, reasoning depth, context needs, multimodal needs, cost sensitivity, and default fallback behavior for each role.
- Define per-role model profiles and override precedence so projects can tune advisor, planner, implementer, reviewer, checker, and baseline-writer models without rewriting role prompts.
- Define how each supported harness maps CW role model profiles into its own configuration surface.
- Define which role agents should be generated for each supported harness when the harness has a native or compatible agent surface.
- Generate role-agent artifacts where the repository's supported harness adapters can do so without pretending unsupported runtime features exist.
- Define a stable handoff package shape for role agents, including task brief, Project Baseline context, code context, ownership boundary, commands to run, report path, and expected status values.
- Define report contracts for delegated implementers, reviewers, advisors, and baseline writers.
- Define delegation gates: harness capability, available tools, user or environment permission, task independence, write-boundary safety, and evidence needs.
- Define context handoff rules: delegated agents receive task artifacts, relevant Project Baseline files, relevant code context, and explicit output contracts rather than full chat history.
- Define authority boundaries: delegated agents may report, implement scoped work, or fix small in-scope defects, but may not close tasks, accept requirement drift, confirm destructive worktree handling, or promote Project Baseline updates.
- Define failure and fallback behavior: unavailable, failed, looping, noisy, or contradictory subagents return responsibility to the main session with inline completion still required.
- Define orchestration modes: inline, foreground subagent, background subagent, advisor, parallel review, isolated worktree lane, cloud lane, and hybrid.
- Define when CW should prefer sequential delegation, parallel read-only review, parallel implementation in isolated lanes, or main-session inline execution.
- Define advisor trigger policy and runtime semantics, including manual invocation, automatic phase-gate invocation, high-risk invocation, OMP-style always-on turn review, and non-blocking fallback behavior.
- Define how CW should reconcile delegated results into `task.md`, trace events, check evidence, and finish readiness.
- Define a harness capability matrix for Claude Code, Codex, OpenCode, Pi, and Cursor at the level needed by generated artifacts.
- Treat Cursor and Codex as sharing common orchestration concepts where possible, while still emitting harness-specific files only where each harness has a supported file surface.
- Update Pi integration to use `pi-subagents` as the default subagent capability layer, installed with `pi install npm:pi-subagents` through the normal Pi harness setup flow unless the user explicitly skips it.
- Pi default setup must actually execute `pi install npm:pi-subagents` when the Pi harness is initialized and setup is not explicitly skipped. Recording pending metadata alone is not sufficient for the default path.
- Generate Pi role-agent artifacts for the `pi-subagents` project-agent surface, preferring `.pi/agents/cw-*.md` when the Pi harness is selected, while retaining truthful fallback guidance for environments where `pi-subagents` is unavailable.
- Ensure Codex `.codex/agents/*.toml` role agents render `developer_instructions` with valid readable multiline TOML instead of a single escaped newline blob.
- Verify harness initialization output with concrete fixture projects for Claude Code, OpenCode, Pi, and Cursor so generated skills, role-agent paths, and model configuration can be inspected directly.
- Render OpenCode role agents as Markdown files under `.opencode/agents/`, where the Markdown file name is the agent name. The frontmatter must use OpenCode's Markdown agent shape, including `description`, `mode: subagent`, `model`, optional `temperature`, and `tools` permission fields such as `write`, `edit`, and `bash`.
- Reduce advisor-policy repetition in generated command skills. Advisor runtime semantics belong in the orchestration contract, `.cw/orchestration.json`, and the `cw-advisor` role agent. Individual command skills mention advisor only when it changes that command's concrete gate, trigger, or review behavior.
- Incorporate useful patterns from OMP advisor, shadcn/improve, Gentle-AI SDD routing, OMO-Slim scheduler/worktree guidance, Cursor subagents/cloud agents/worktrees, and Superpowers subagent-driven development.
- Update adapter-rendered CW skills so orchestration guidance is present where it affects behavior and absent where it would add noise.
- Update adapter generation to emit harness-native or harness-compatible role-agent files where appropriate.
- Update tests to verify generated guidance, section placement, support-command restraint, and behavior-critical wording.
- Regenerate relevant harness skills from adapter source.

## Non-goals

- Do not implement a real background scheduler, worker pool, cloud-agent API, model router, cost ledger, or automatic worktree manager in this task, but do define the contract those later systems must follow.
- Do not require any harness to support subagents.
- Do not add agent-orchestration fields to task state unless the design proves a minimal field is necessary and the user accepts that schema change before implementation.
- Do not make task closure, baseline sync, dirty-worktree decisions, or requirement-drift decisions delegable.
- Do not make external memory, external docs, or subagent reports repo truth.
- Do not replace CW's clarify, plan, run, check, finish lifecycle with a separate agent framework.
- Do not generate role agents for a harness when the harness has no stable file surface or when generated files would misrepresent the runtime's actual capabilities.
- Do not make `cw update --harness pi` silently install external Pi extensions; update refreshes generated artifacts and setup metadata, while installation belongs to the setup flow.

## Constraints

- `.cw` task files and Project Baseline files remain repo truth for workflow facts.
- Generated harness skills are invocation surfaces; adapter/source guidance is the canonical generated guidance.
- Git remains the source of truth for code changes.
- Inline execution must remain complete for every command.
- Delegation must be optional, permission-bound, and scoped to the current workflow action.
- Subagents must receive constructed context, not the full main-session conversation.
- Parallel implementation must avoid overlapping write ownership unless isolated worktrees or equivalent safety boundaries exist.
- Check and review evidence must map back to `spec.md`, `plan.md`, and `task.md`.
- Human confirmation is required for product behavior changes, requirement drift, destructive worktree handling, closure, and Project Baseline promotion.
- Generated role-agent files must be treated as invocation surfaces, with canonical behavior still derived from CW source and `.cw` workflow artifacts.
- Harness-specific generation must not weaken the common CW contract.
- CW must not hard-code a specific vendor model as the semantic truth of a role. Role defaults should be expressed as capability tiers and translated to harness-specific selectors through configuration.
- Model configuration must be explicit about inheritance. If a role omits a model, the generated artifact must state whether it inherits the parent/session model or falls back to a CW-recommended tier.

## Decisions

- Treat agent orchestration as an execution strategy layer. It changes how work is performed, not the CW lifecycle or task state model.
- Keep hybrid as the recommended mental model for capable harnesses: the main session coordinates, while delegated agents can perform bounded research, implementation, review, or verification.
- Preserve inline as the required fallback and the minimum complete execution path.
- Keep `cw-work`, `cw-plan`, `cw-run`, and `cw-check` as the initial strategy-aware commands.
- Keep support commands such as `cw-clarify`, `cw-finish`, `cw-resume`, `cw-discard`, `cw-doctor`, and `cw-understand` concise unless they gain a concrete strategy choice.
- Use an advisor/checker pattern for independent judgment: it may inject concerns, blockers, verdicts, and evidence, but the main session decides what to do with them.
- Do not create a default clarifier role agent in the first role set. Clarify remains a main-session responsibility because it depends on user judgment, challenge, and accepted task-contract wording.
- Allow the advisor to participate in clarify as a skeptical review role. It may review fuzzy intent, challenge assumptions, identify missing acceptance criteria, flag shorter paths, and propose questions for the main session to ask. It must not ask the user directly, accept spec.md, edit spec.md, or move the task to plan.
- Fully absorb the OMP advisor pattern as a configurable CW orchestration mode. CW should support an advisor as a second model or agent that watches primary-session progress through bounded transcript deltas, keeps its own context, uses advisor-only guidance, and injects structured advice back to the main session.
- Enable advisor behavior by default. Where the harness/runtime supports OMP-style always-on turn review, that is the default advisor mode. Where it does not, CW defaults to gate-triggered and high-risk advisor checks.
- Configure advisor behavior through explicit policy so users or environments can change the default. The policy should cover `off`, manual-only, gate-triggered, high-risk-triggered, and always-on per-turn review where the harness/runtime supports it.
- Manual invocation is always allowed when the user or main session wants an independent challenge.
- Run gate-triggered advisor checks before accepting a broad, ambiguous, or workflow-semantics spec; before moving a high-risk or cross-cutting plan to run; during check for broad behavior or workflow-semantics changes; and before finish only when closure evidence, baseline promotion, or dirty-worktree handling is risky.
- Always-on advisor review is the preferred default for capable runtimes, but it is not required for CW correctness. Inline workflow progress must continue when the advisor is disabled, unavailable, delayed, or failed.
- Advisor advice should use structured severity such as `nit`, `concern`, and `blocker`. `concern` or `blocker` can pause phase progression for main-session review, while `nit` remains non-blocking.
- Advisor implementations should include noise controls: no self-review loops over prior advice, no duplicate advice, at most one actionable note per update, suppression of content-free messages, and evidence requirements for causal claims.
- Advisor backlog handling should be bounded. If always-on review falls behind, the primary session may wait only according to configuration and must continue after a bounded cap or repeated advisor failure.
- Advisor-only guidance should be separate from primary-agent instructions. CW may define a `WATCHDOG`-style project guidance surface for advisor priorities, project traps, dangerous APIs, architectural boundaries, and quality bars.
- Advisor output is advisory evidence. A `concern` or `blocker` can pause phase progression for main-session review, but it cannot change task state or artifacts on its own.
- Generated workflow skills must avoid repeating advisor policy as generic boilerplate. `cw-plan` and `cw-check` may mention advisor/reviewer gates for high-risk planning or review. `cw-clarify` may mention advisor review of Proposed Spec. `cw-work` and `cw-run` should not repeat advisor policy unless a concrete behavior depends on it.
- Use the planner role for accepted specs only. If the planner detects missing product decisions, it returns the task to clarify instead of inventing requirements.
- Use implementer delegation only for independent vertical slices with clear task briefs, scoped file or module ownership, test expectations, and a report contract.
- Use reviewer/checker delegation for artifact alignment, acceptance-criteria evidence, broad behavior review, and final review when the change is broad or touches workflow semantics.
- Prefer file-based or artifact-based handoffs for large context, reports, diffs, and review packages when available.
- Treat worktree or cloud execution as optional harness capabilities. CW guidance can name when they are useful, but this task will not build them.
- Keep external reference systems as design evidence, not as runtime dependencies.
- Generate role agents as first-class adapter outputs for harnesses with a supported role-agent file surface.
- Generate the initial default role-agent set as advisor, planner, implementer, reviewer, checker, and baseline-writer.
- Add Cursor as a supported harness alongside Claude Code, Codex, OpenCode, and Pi.
- Add a CW role model profile table to the orchestration contract:
  - advisor: high judgment, broad context, evidence-sensitive, read-mostly, default enabled; use a strong reasoning model by default, with a cheaper always-on model allowed when paired with gate-triggered stronger review.
  - planner: strongest available planning and architecture model; high reasoning; no code writes.
  - implementer: standard coding model by default; fast model allowed for mechanical single-slice work; high reasoning model required for cross-module, risky, or ambiguous implementation.
  - reviewer: high judgment model for broad, security, concurrency, workflow-semantics, or public API changes; standard model acceptable for small local diffs.
  - checker: standard-to-high model with reliable tool use; prioritizes verification discipline, command evidence, and artifact alignment.
  - baseline-writer: standard model with strong summarization and precision; high reasoning only when baseline changes encode architecture or workflow semantics.
- Define model override precedence from highest to lowest: explicit user/session override, task or handoff override, role-agent artifact setting, project CW orchestration config, harness native config, and CW built-in capability-tier default.
- For Claude Code, map role models to subagent `model` frontmatter or invocation model parameters; document that environment or session settings such as global subagent model overrides may take precedence.
- For Codex, map role models to `.codex/agents/*.toml` fields such as `model` and `model_reasoning_effort`, while respecting Codex config precedence and inherited sandbox/approval settings.
- Codex project configuration for this repository should use the current available Codex subscription model as an explicit project override. The current local Codex config resolves to `gpt-5.5`; after the accepted schema expansion, this repository uses `xhigh` as the Codex role reasoning override.
- CW model reasoning config should support `none`, `low`, `medium`, `high`, `xhigh`, and `auto`, plus `null` for inheritance. Do not add `minimal` to the CW canonical schema for now. Harness adapters should map only values supported by the target harness and preserve inheritance when a value is null.
- For OpenCode, generate project-level Markdown agents under `.opencode/agents/cw-*.md`. Each file name defines the agent name. Frontmatter should include `description`, `mode: subagent`, a model selector derived from CW role model profile or explicit override, role-appropriate `temperature` when configured, and explicit `tools` permissions. Read-only roles such as advisor and reviewer should set write/edit/bash false unless the role contract says otherwise.
- OpenCode temperature follows the OMO-slim-compatible range `0` to `2`, with `null` preserving inheritance. Built-in CW role defaults use conservative values: advisor, planner, reviewer, and baseline-writer at `0.1`; implementer and checker at `0.2`.
- For Pi, make `pi-subagents` the default install for subagent support. Map role models through `subagents.defaultModel`, `subagents.agentOverrides.<agent>`, and per-run model overrides where available. When `pi-subagents` is unavailable or explicitly skipped, emit fallback guidance without pretending Pi has active subagents.
- For Cursor, map role models to `.cursor/agents/*.md` frontmatter `model` where available, and document that Cursor may fall back when plan, team, or Max Mode restrictions prevent the selected model.
- Generate Pi role agents into `.pi/agents/cw-*.md` for `pi-subagents` discovery. Legacy `.agents/**/*.md` discovery may remain a compatibility path, but `.pi/agents` is the canonical generated surface for Pi.
- Render Codex custom-agent `developer_instructions` as a multiline TOML value with real line breaks and safe escaping so generated agents remain readable and valid.
- Create or refresh task-local fixture projects for `claude`, `opencode`, `pi`, and `cursor` during implementation verification. These fixtures are inspection artifacts for this task and should not replace product tests.
- Keep generated role agents small and role-specific. The main workflow skills carry phase orchestration; role agents carry narrow execution contracts.
- Use capability detection or explicit harness selection to decide what gets generated, avoiding a single pretend-universal agent format.
- Make role-agent output structured enough for main-session reconciliation: status, summary, files touched or reviewed, commands run, evidence, concerns, and escalation reason.

## Acceptance Criteria
- [x] `DESIGN.md` contains a concrete agent-orchestration contract that is consistent with CW workflow phases and closure rules.
- [x] The contract defines roles, delegation gates, context handoff, authority boundaries, failure fallback, and review evidence.
- [x] The contract defines orchestration modes, scheduling choices, work ownership rules, handoff package shape, report contracts, and harness capability expectations.
- [x] The contract defines per-role model capability profiles, default tiers, reasoning expectations, cost trade-offs, inheritance behavior, and override precedence.
- [x] The contract maps role model profiles to Claude Code, Codex, OpenCode, Pi, and Cursor configuration surfaces.
- [x] The contract defines `pi-subagents` as the default Pi subagent install path and distinguishes setup-time installation from artifact refresh.
- [x] Pi default setup actually runs `pi install npm:pi-subagents` unless the user explicitly skips Pi subagent setup.
- [x] Pi adapter generation emits `pi-subagents` project-agent files under `.pi/agents/cw-*.md` and preserves an honest fallback when `pi-subagents` is skipped or unavailable.
- [x] Codex role-agent TOML uses valid readable multiline `developer_instructions` rather than escaped newline blobs.
- [x] The repository has a `.cw/orchestration.json` Codex override that uses the current available Codex subscription model (`gpt-5.5`) while preserving native reasoning inheritance.
- [x] `.cw/orchestration.json` accepts and uses `xhigh` for current Codex role reasoning overrides.
- [x] Schema validation accepts `none`, `low`, `medium`, `high`, `xhigh`, `auto`, and null for role reasoning effort, and rejects unsupported values.
- [x] OpenCode role-agent files are generated as `.opencode/agents/cw-*.md` Markdown agents whose file names define the agent names and whose frontmatter includes role-appropriate `model`, `temperature` when configured, and `tools` permissions.
- [x] The contract defines advisor policy and runtime semantics, including manual invocation, gate invocation, high-risk invocation, configurable OMP-style always-on review, severity levels, bounded backlog handling, noise controls, advisor-only guidance, and main-session adjudication.
- [x] The contract defines which role-agent artifacts are generated per supported harness and what remains guidance-only.
- [x] Adapter-rendered strategy-aware skills express the orchestration contract without encouraging premature planning, skipped clarification, skipped review, or delegated closure.
- [x] Generated command skills do not repeat advisor policy in shared boilerplate; advisor appears only where it changes concrete command behavior, gate conditions, or review triggers.
- [x] Adapter generation emits role-agent artifacts for supported harness surfaces where appropriate.
- [x] Generated support-command skills remain concise and do not include high-noise orchestration detail unless the command has a real strategy choice.
- [x] Tests cover generated guidance for strategy-aware commands.
- [x] Tests cover generated role-agent files, including role descriptions, permissions, report contracts, and escalation rules.
- [x] Tests cover absence or restraint of orchestration guidance in support commands.
- [x] Tests cover behavior-critical boundaries, including inline fallback, no delegated closure, no delegated drift acceptance, constructed context handoff, and main-session confirmation gates.
- [x] Regenerated harness skills match adapter source.
- [x] Task-local fixture projects for Claude Code, OpenCode, Pi, and Cursor can be initialized and inspected for skills, role-agent paths, and model configuration.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
