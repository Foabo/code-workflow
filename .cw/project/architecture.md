# Architecture

## Stack

## Modules

## Data Flow

## Integration Points

## Constraints

## From task-codex-self-evolution

- CW harness adapters generate repo-local skills as the default invocation surface. Codex, OpenCode, and Pi use `.agents/skills/`; Claude uses `.claude/skills/`.
- Generated skills reuse the same workflow action semantics and point back to `.cw` as Repo Truth.

- `cw-clarify` correctness belongs in deterministic CW gates first. Generated skills and local hooks are invocation/enforcement surfaces, not the source of truth for whether `spec.md` may be written or a task may advance.
- Local watchdog artifacts should call a shared validator such as `cw internal validate-clarify --watchdog` rather than carrying independent per-harness gate logic.

- Codex role agents are generated from `.cw/orchestration.json` into `.codex/agents/cw-*.toml`; the local project uses role-specific Codex overrides: advisor `gpt-5.5` / `xhigh`, planner `gpt-5.5` / `high`, implementer `gpt-5.5` / `medium`, reviewer `gpt-5.5` / `high`, checker `gpt-5.4-mini` / `medium`, and baseline-writer `gpt-5.4-mini` / `low`.
- Generated workflow guidance uses phase-to-role routing when delegation is available: `cw-advisor` for clarify review, `cw-planner` for planning, `cw-implementer` for implementation slices, `cw-checker` for verification, `cw-reviewer` for broad review, and `cw-baseline-writer` for Project Baseline merge drafts.
- Codex subagents are spawned only after the main session explicitly asks the harness to spawn the named `cw-<role>` agent. Inline execution remains required for unavailable, unauthorized, or low-value delegation.

- Clarify gate identity (`attempt_id`/`proposal_id`/`proposal_hash`, `proposal_hash = sha256(spec content)`) is recorded via `cw internal propose-spec --task --spec-file` and `cw internal accept-spec --task --verdict ...`, which compute and thread the identity triple so agents do not hand-hash or hand-thread field names. `latestProposalIdentity(events)` is the exported read-side primitive (returns the latest proposal identity or null when absent/malformed).
