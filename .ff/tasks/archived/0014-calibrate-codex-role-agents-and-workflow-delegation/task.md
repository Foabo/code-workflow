# Task

## Implementation
- [x] Update `.cw/orchestration.json` Codex role model overrides.
- [x] Update generated workflow guidance in `src/adapters.ts` with explicit role routing.
- [x] Update tests for role-specific Codex model rendering and delegation routing.
- [x] Regenerate Codex harness artifacts.

## Verification
- [x] Inspect generated `.codex/agents/cw-*.toml` for role-specific `model` and `model_reasoning_effort`.
  - Evidence: `rg -n "^(model|model_reasoning_effort) =|Model profile:" .codex/agents/cw-*.toml` shows advisor `gpt-5.5/xhigh`, planner `gpt-5.5/high`, implementer `gpt-5.5/medium`, reviewer `gpt-5.5/high`, checker `gpt-5.4-mini/medium`, and baseline-writer `gpt-5.4-mini/low`.
- [x] Inspect generated `.agents/skills` for phase-specific subagent routing.
  - Evidence: `rg -n "Role routing|cw-advisor|cw-planner|cw-implementer|cw-checker|cw-reviewer|cw-baseline-writer|Explicitly ask" .agents/skills/cw-{work,plan,run,check,finish}/SKILL.md` shows routing in each relevant workflow skill.
- [x] Run `npm run typecheck`.
  - Evidence: passed.
- [x] Run `npm test`.
  - Evidence: passed, 47/47 tests.
- [x] Run `npm run build`.
  - Evidence: passed.
- [x] Run `node dist/src/cli.js validate --root .`.
  - Evidence: passed with `{ "ok": true, "issues": [] }`.

## Check
- [x] Acceptance criteria in spec.md are covered.
  - Evidence: `cw-reviewer` reported no high-severity implementation defect and confirmed coverage for model mapping, generated routing, generated artifacts, and tests.
- [x] No unresolved drift between implementation and spec.
  - Evidence: implementation kept to Codex role model overrides, adapter guidance, generated artifacts, and tests.
- [x] Dirty worktree handling is clear.
  - Evidence: 0014 changes are task-related; pre-existing unrelated/0013 worktree changes remain outside this task and were not reverted.
- [x] Baseline Outcome is recorded.
  - Evidence: `baseline-delta.md` records reusable role model and workflow delegation facts.

## Notes
- Created because active task `0013` explicitly excludes generic role-agent/model-system work, while the user requested a repository-wide subagent configuration and workflow delegation fix.
- Read-only `cw-reviewer` subagent reviewed 0014 and found no implementation defect; its only blocker was missing task evidence before this update.
