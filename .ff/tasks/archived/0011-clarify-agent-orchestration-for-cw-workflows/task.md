# Task

## Implementation
- [x] Update `DESIGN.md` with the full CW agent-orchestration contract.
- [x] Define role contracts for advisor, planner, implementer, reviewer, checker, and baseline-writer.
- [x] Define orchestration modes, scheduling choices, ownership boundaries, handoff package shape, report contracts, result reconciliation, and failure fallback.
- [x] Define default-enabled advisor policy, including OMP-style always-on review where supported, gate/high-risk fallback, severity levels, bounded backlog, noise controls, and advisor-only guidance.
- [x] Define per-role model capability profiles, override precedence, inheritance behavior, and harness-specific mapping.
- [x] Decide and implement the project CW orchestration config surface, keeping it optional and backward-compatible.
- [x] Refactor adapter source to use canonical role definitions and shared orchestration guidance.
- [x] Add Cursor to the supported harness set.
- [x] Add harness-specific role-agent generation for Claude Code, Codex, OpenCode, Cursor, and truthful Pi-compatible guidance.
- [x] Update generated workflow skills so strategy-aware commands reference the orchestration contract without duplicating broad prose.
- [x] Keep support-command generated skills concise and free of unnecessary orchestration sections.
- [x] Update tests for role definitions, role-agent artifact generation, harness-specific paths, model profile guidance, advisor defaults, and support-command restraint.
- [x] Update tests for behavior-critical boundaries: no delegated closure, no delegated drift acceptance, no delegated baseline promotion, constructed context handoff, inline fallback, and main-session confirmation gates.
- [x] Regenerate repo-local harness artifacts from adapter source.

## Replan Implementation
- [x] Update `DESIGN.md` with accepted replan decisions for Pi setup, Pi `.pi/agents`, OpenCode Markdown agents, Codex multiline TOML, reasoning-effort schema, and advisor placement.
- [x] Expand `ModelReasoningEffort` and orchestration schema to accept `none`, `low`, `medium`, `high`, `xhigh`, `auto`, and `null`, while rejecting `minimal`.
- [x] Implement role model resolution from built-in defaults, `.cw/orchestration.json`, and per-harness overrides.
- [x] Configure this repo's Codex role overrides with `model: gpt-5.5` and `reasoning_effort: xhigh` after schema support is in place.
- [x] Render Codex role-agent TOML with readable multiline `developer_instructions`, safe escaping, and resolved model/reasoning fields.
- [x] Add Pi setup behavior that actually runs `pi install npm:pi-subagents` by default during Pi initialization unless explicitly skipped.
- [x] Change Pi role-agent generation to `.pi/agents/cw-*.md` for `pi-subagents` project-agent discovery and keep fallback guidance truthful.
- [x] Ensure `cw update --harness pi` refreshes artifacts without installing `pi-subagents`.
- [x] Render OpenCode `.opencode/agents/cw-*.md` with documented Markdown frontmatter, including role-appropriate model handling, optional temperature, and explicit `tools.write/edit/bash` permissions.
- [x] Remove advisor policy from shared execution-strategy boilerplate and mention advisor only where it changes concrete command behavior.
- [x] Update tests for reasoning-effort schema, Codex multiline TOML, resolved model overrides, OpenCode permissions, Pi default install, Pi `.pi/agents`, `cw update --harness pi` non-install behavior, and advisor boilerplate restraint.
- [x] Refresh task-local Claude Code, OpenCode, Pi, and Cursor fixture projects after implementation.

## Verification
- [x] Inspect `DESIGN.md` for complete coverage of the accepted spec.
- [x] Inspect generated role-agent artifacts for Claude Code, Codex, OpenCode, Cursor, and Pi-compatible guidance.
- [x] Inspect generated strategy-aware workflow skills for correct orchestration guidance.
- [x] Inspect generated support-command skills for absence of high-noise orchestration guidance.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Replan Verification
- [x] Inspect `DESIGN.md` for updated Pi, OpenCode, Codex TOML, reasoning-effort, and advisor-placement language.
- [x] Inspect regenerated Codex role agents for multiline TOML and `gpt-5.5`/`xhigh` fields.
- [x] Inspect regenerated OpenCode role agents for Markdown frontmatter and explicit tools permissions.
- [x] Inspect regenerated Pi role agents under `.pi/agents/` and setup output for actual `pi-subagents` install behavior.
- [x] Inspect regenerated `cw-work` and `cw-run` skills to confirm advisor boilerplate is absent.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Behavior review confirms generated guidance does not let agents skip clarify challenge, plan gate, review gates, user confirmation, or inline fallback.
- [x] Behavior review confirms advisor output remains advisory evidence and cannot directly accept spec drift, close tasks, or promote Project Baseline changes.
- [x] Behavior review confirms model guidance is capability-tier based and not hard-bound to one vendor model.
- [x] Post-plan artifact cross-review found no contradiction, missing coverage, overbuilding, unclear interfaces, or placeholder work.

## Replan Check
- [x] Updated plan and task cover every new acceptance criterion added after the first implementation pass.
- [x] No new work asks `cw update --harness pi` to install external packages.
- [x] Behavior review confirms advisor policy appears in role/config/contract surfaces and not as repeated command boilerplate.
- [x] Behavior review confirms model reasoning schema remains portable and does not include `minimal`.
- [x] Post-replan artifact cross-review found no contradiction, missing coverage, overbuilding, unclear interfaces, or placeholder work.

## Notes
- This task defines the multi-agent contract and generated artifacts. It does not implement a real scheduler, cloud API integration, automatic worktree manager, model router, or cost ledger.
- Existing dirty worktree entries from other tasks must remain untouched.
- Post-plan artifact cross-review found one missing explicit test item for behavior-critical boundaries and added it before moving to run.
- Verification passed: `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
- Regenerated Codex harness artifacts with `node dist/src/cli.js update --root . --harness codex`.
- Replan accepted after clarify drift: actual Pi `pi-subagents` install, Pi `.pi/agents`, OpenCode Markdown frontmatter, Codex multiline TOML, reasoning `xhigh`, fixture verification, and advisor de-duplication.
- Replan implementation refreshed Claude Code, OpenCode, Pi, Cursor, and Codex generated role artifacts. The initial Pi fixture recorded a failed `pi install npm:pi-subagents` attempt before Pi was installed locally; a later retest fixture records the successful default setup path.
- Replan verification passed: `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
- After local Pi installation, retest confirmed `pi --version` is `0.80.3`; `cw init --harness pi --yes` ran `pi install npm:pi-subagents` successfully with setup status `configured` and exit code `0`. The passing fixture lives under `fixtures/harness-init-20260705-pi-installed/`.
- OpenCode temperature was refined from OMO-slim behavior: schema now accepts only `0` to `2` or `null`, and built-in role defaults use `0.1` for planning/review/drafting roles and `0.2` for implementation/checking roles.
- Check evidence: `cw preflight --action check --task 0011`, `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, and `node dist/src/cli.js doctor --root .` passed. Artifact review found and repaired stale task-local wording around Codex `xhigh` and the Pi install retest.
