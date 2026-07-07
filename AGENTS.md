# Flowflow Repository Instructions

This repository uses Flowflow to guide its own development.

## Workflow

- Treat `.ff/` as Repo Truth for workflow facts, task state, task artifacts, trace events, and Project Baseline.
- Before implementing non-trivial changes, inspect the relevant `.ff/tasks/<task-id>/` artifacts or create a task with `ff-work`.
- Use `ff-clarify`, `ff-plan`, `ff-run`, `ff-check`, and `ff-finish` as the normal path from request to closed task.
- Use kernel helpers for deterministic state changes, especially task creation, trace append, lifecycle changes, resume consumption, baseline delta sync, finish, and discard.
- Git remains the source of truth for code changes.

## Codex Integration

- Generated Codex repo-local skills live under `.agents/skills/`.
- Flowflow does not generate a repository-local Codex plugin marketplace or `plugins/ff-workflow` source by default.
- Refresh generated Codex harness entries with `ff update --harness codex`.
- Do not treat `.codex/prompts/` as a repository command surface; Codex custom prompts are local-home prompts and are deprecated in favor of skills.

## Verification

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .` after changing `.ff` files.
