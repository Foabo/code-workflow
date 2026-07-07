# Baseline Delta

## overview.md

## architecture.md

- Codex role agents are generated from `.cw/orchestration.json` into `.codex/agents/cw-*.toml`; the local project uses role-specific Codex overrides: advisor `gpt-5.5` / `xhigh`, planner `gpt-5.5` / `high`, implementer `gpt-5.5` / `medium`, reviewer `gpt-5.5` / `high`, checker `gpt-5.4-mini` / `medium`, and baseline-writer `gpt-5.4-mini` / `low`.
- Generated workflow guidance uses phase-to-role routing when delegation is available: `cw-advisor` for clarify review, `cw-planner` for planning, `cw-implementer` for implementation slices, `cw-checker` for verification, `cw-reviewer` for broad review, and `cw-baseline-writer` for Project Baseline merge drafts.
- Codex subagents are spawned only after the main session explicitly asks the harness to spawn the named `cw-<role>` agent. Inline execution remains required for unavailable, unauthorized, or low-value delegation.

## rules.md

- Role agents do not own task closure, baseline promotion decisions, requirement drift, or destructive worktree handling. Those decisions stay in the main session and use CW helpers.

## commands.md
