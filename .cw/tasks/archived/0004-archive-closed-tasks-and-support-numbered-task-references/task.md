# Task

## Implementation
- [x] Add shared task storage helpers for active tasks, archived tasks, task listing scopes, and reserved directory filtering.
- [x] Add numeric task id helpers for title slugging, next id allocation, short-prefix detection, and task reference resolution.
- [x] Update `createTask` and `runWork` so omitted ids generate `0001-readable-slug` style ids.
- [x] Update `cw internal create-task` usage so `--id` is optional and generated adapter helper text no longer requires `task-*` ids.
- [x] Route preflight, workflow task selection, and internal `--task` commands through the numeric reference resolver.
- [x] Update task listing so default output shows active tasks and an explicit flag shows archived history.
- [x] Update `finishTask` to close the task, append trace, and move the full task directory to `.cw/tasks/archived/<task-id>/`.
- [x] Add an internal migration helper for legacy `task-*` directories and run it on this repository.
- [x] Update tests and generated skills affected by task id format or helper command text.

## Verification
- [x] Test numeric id generation scans active and archived tasks and never reuses a prefix.
- [x] Test `0001` style references resolve for workflow and internal commands.
- [x] Test missing or ambiguous numeric references return clear errors.
- [x] Test default listing, archived listing, preflight, and validation do not treat `.cw/tasks/archived/` as an active task.
- [x] Test finishing a task archives the complete task directory after metadata and trace updates.
- [x] Test migration renames legacy directories, updates `task.json.id`, preserves artifacts, and archives closed tasks.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.

## Notes

- Current task migrated from `task-archive-and-numbered-task-refs` to `0004-archive-closed-tasks-and-support-numbered-task-references`.
- Existing closed tasks migrated to `.cw/tasks/archived/` as numeric task ids.
- Dirty worktree entries are the implementation changes, regenerated CW skills, migrated `.cw/tasks` directories, and one unrelated untracked ADR draft at `docs/adr/0039-no-stable-typescript-package-surface-for-v1.md`.
