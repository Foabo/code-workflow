# CW Repository Instructions

This repository uses CW to guide its own development.

## Workflow

- Treat `.cw/` as Repo Truth for workflow facts, task state, task artifacts, trace events, and Project Baseline.
- Before implementing non-trivial changes, inspect the relevant `.cw/tasks/<task-id>/` artifacts or create a task with `cw-work`.
- Use `cw-clarify`, `cw-plan`, `cw-run`, `cw-check`, and `cw-finish` as the normal path from request to closed task.
- Use kernel helpers for deterministic state changes, especially task creation, trace append, lifecycle changes, resume consumption, baseline delta sync, finish, and discard.
- Git remains the source of truth for code changes.

## Codex Integration

- Generated Codex repo-local skills live under `.agents/skills/`.
- CW does not generate a repository-local Codex plugin marketplace or `plugins/cw-workflow` source by default.
- Refresh generated Codex harness entries with `cw update --harness codex`.
- Do not treat `.codex/prompts/` as a repository command surface; Codex custom prompts are local-home prompts and are deprecated in favor of skills.

## Verification

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .` after changing `.cw` files.
