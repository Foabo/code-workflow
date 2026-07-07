# Task

## Implementation
- [x] Rename package metadata and bin entries from `code-workflow` / `cw` / `cw-*` to `flowflow` / `ff` / `ff-*`.
- [x] Rename path helpers and canonical Repo Truth paths from `.cw` to `.ff`, including project baseline, templates, task storage, archive paths, enhancement config, orchestration config, and display paths.
- [x] Update CLI, agent-command dispatch, usage text, workflow/preflight/validate/doctor messages, and internal helper examples to use `ff` and `.ff`.
- [x] Update adapter source so generated Codex, Claude, OpenCode, Pi, and Cursor skills, role agents, role-routing text, and watchdog artifacts use `ff-*` and `.ff`.
- [x] Update tests and fixtures for `.ff`, `ff`, `ff-*`, generated role agents, watchdog commands, and stale-artifact validation.
- [x] Migrate current repository state from `.cw/` to `.ff/`, preserving active and archived task records.
- [x] Regenerate all current harness artifacts and remove stale generated `cw-*` files from active generated-surface directories.
- [x] Update README, DESIGN, CONTEXT, AGENTS, current ADR/PRD/issue docs, root instruction/context files, and `.ff/project/*` to describe Flowflow as the current product.
- [x] Rename GitHub repository to `Foabo/flowflow` when authorized and update local `origin`; otherwise record the manual fallback.

## Verification
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
- [x] Run `node dist/src/cli.js doctor --root .`.
- [x] Verify init/update output creates `.ff/`, `.agents/skills/ff-*`, `.claude/skills/ff-*`, and `ff-*` role agents.
- [x] Verify watchdog artifacts call `ff internal validate-clarify --watchdog`.
- [x] Verify current non-historical files no longer present `cw` / `.cw` / `code-workflow` as the current product surface.
- [x] Verify `git remote -v` points to `git@github.com:Foabo/flowflow.git` or task notes contain the exact manual fallback.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded.
- [x] Behavior review confirms generated workflow guidance still forces challenge, advisor review, explicit accept, phase gates, and helper-based state changes after the rename.
- [x] Artifact review distinguishes historical archived task text from current Flowflow product facts.

## Notes

- Planning was performed inline. Subagent planning was not used because this turn did not explicitly authorize delegation, and the plan was not blocked on external analysis.
- The repository already had modified generated `cw-*` skill files before this task; implementation should regenerate through adapter source and avoid reverting unrelated work.
- Bootstrap risk was handled by building the updated CLI before continuing task mutation from `.ff/`.
- GitHub repository rename succeeded through `gh repo rename flowflow --repo Foabo/code-workflow --yes`; local `origin` now points to `git@github.com:Foabo/flowflow.git`.
- Baseline delta was created because the Flowflow rename changed stable reusable project facts.
- ff-check reran `npm run typecheck`, `npm test` (50 tests), `npm run build`, `node dist/src/cli.js validate --root .`, and `node dist/src/cli.js doctor --root .`; all passed.
- ff-check removed stale `dist/`, rebuilt it, and reran current-surface old-name scans. No current non-historical file path or source/build/package/test surface still declares `code-workflow`, `cw-*`, `.cw`, `CW_SCHEMA_VERSION`, `cw_version`, `getCwPaths`, or `CwPaths`; remaining old names are migration task context or archived task history.
- `node dist/src/cli.js tasks --root .`, `node dist/src/cli.js preflight --action check --task 0017`, and `node dist/src/cli.js update --root . --harness codex` work from `.ff/`.
- Fresh init smoke created `.ff/`, `.agents/skills/ff-work`, `.agents/skills/ff-clarify`, and `.codex/agents/ff-planner.toml`; it did not create `.cw/` or `cw-*` generated skills.
- Generated workflow guidance still contains Brainstorm Pass, Grill Loop, `ff-advisor` review, explicit `accept-spec`, `validate-clarify --stage advance`, and `ff internal set-state` phase movement.
- Dirty worktree is the expected rename package: old `cw-*` generated artifacts and `.cw/` paths deleted, new `ff-*` generated artifacts and `.ff/` paths added, plus source, tests, package metadata, docs, hooks, and current task artifacts updated.
