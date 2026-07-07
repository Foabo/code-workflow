# Spec

## Goal

Make CW task storage easier to scan and easier to address in conversation:

- Closed tasks should leave the active task directory and move into an archive area.
- New tasks should have short numeric IDs plus readable names, so users can refer to `0001` or `0002` without copying a long task id.

## Scope

- Add an archive directory at `.cw/tasks/archived/`.
- Move a task directory from `.cw/tasks/<task-id>/` to `.cw/tasks/archived/<task-id>/` when `cw internal finish-task` closes it.
- Keep all task artifacts intact when archiving: `task.json`, `spec.md`, `plan.md`, `task.md`, `trace.jsonl`, and optional artifacts.
- Treat `.cw/tasks/archived/` as a reserved directory, not as an active task.
- Keep archived tasks visible as history through an explicit listing mode, while default task selection and execution use active tasks.
- Generate new task ids in the form `0001-readable-slug`, `0002-readable-slug`, and so on.
- Allocate task numbers by scanning both active and archived task directories and choosing the next unused number.
- Accept a numeric task reference such as `0001` anywhere a CW command accepts `--task`, resolving it to the matching full task id.
- Rename existing legacy task directories such as `task-codex-self-evolution` into numeric `0001-readable-slug` style ids.
- Move existing closed task directories under `.cw/tasks/` into `.cw/tasks/archived/` as part of this change after renaming them.

## Non-goals

- Delete closed task history.
- Add a database or index file for task lookup unless the implementation proves filesystem scanning is insufficient.
- Change task artifact schemas except for fields strictly required by the archive behavior.

## Constraints

- `.cw/` remains Repo Truth for workflow facts and task state.
- Git remains the source of truth for code changes.
- Active task commands must not accidentally operate on archived tasks.
- Numeric references must fail with a clear error when no task matches or more than one task matches.
- Legacy `task-*` ids are migrated rather than supported indefinitely.
- The archive behavior must be implemented through CW helpers so generated skills and harnesses get the same semantics.

## Decisions

- The archive path is `.cw/tasks/archived/`.
- The canonical new task id format is four zero-padded digits, a hyphen, then a filesystem-safe slug derived from the task title.
- The short task reference is the numeric prefix before the first hyphen.
- Explicit full numeric task ids continue to work.
- Existing legacy task ids will be renamed to numeric ids in creation order using each task title for the slug.
- Default task listing should focus on active tasks; archived tasks require an explicit flag or mode.

## Acceptance Criteria
- [x] Finishing a task updates its closed metadata and trace, then moves the full task directory to `.cw/tasks/archived/<task-id>/`.
- [x] `.cw/tasks/archived/` is ignored by active task scanning, validation, selection, and preflight unless archived history is explicitly requested.
- [x] Existing legacy task directories currently under `.cw/tasks/` are renamed to numeric ids and moved to `.cw/tasks/archived/` when already closed, without losing files.
- [x] Creating a task without an explicit id generates the next `0001-readable-slug` style id from the title.
- [x] The generated number never reuses a number already present in active or archived tasks.
- [x] Commands that accept `--task` resolve `0001` style references to the matching full task id.
- [x] Numeric reference resolution returns a clear error for missing or ambiguous references.
- [x] `task-*` ids are no longer generated or required after migration.
- [x] `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .` pass.
