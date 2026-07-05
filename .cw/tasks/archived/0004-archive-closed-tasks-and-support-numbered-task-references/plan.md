# Plan

## Approach

1. Centralize task identity and storage rules.
   - Add shared task path helpers for active task directories and `.cw/tasks/archived/`.
   - Add shared helpers for numeric task ids: title slugging, next-number allocation, numeric-prefix parsing, and task reference resolution.
   - Replace duplicate task directory scans in `src/task-store.ts` and `src/validate.ts` with the shared helpers so `archived/` is never treated as an active task id.

2. Switch task creation to numeric ids.
   - Let `createTask` generate `0001-readable-slug` ids when no explicit id is supplied.
   - Keep explicit ids only for controlled internal use and tests, validated against the new numeric format.
   - Update `runWork`, `cw internal create-task`, CLI usage text, and generated adapter helper text so new tasks do not require a caller-provided `task-*` id.

3. Resolve short numeric task references everywhere.
   - Resolve `0001` to the matching full numeric id before task operations.
   - Apply the resolver to preflight, selection, workflow actions, and all `cw internal ... --task` subcommands that read or mutate a task.
   - Produce clear errors for missing, archived-when-active-required, or ambiguous numeric references.

4. Archive tasks on finish.
   - Update `finishTask` so it writes the closed state, appends the finish trace, then moves the complete task directory from `.cw/tasks/<task-id>/` to `.cw/tasks/archived/<task-id>/`.
   - Ensure default task listing, selection, preflight, and validation scan active tasks only.
   - Add an explicit task listing mode for archived history.

5. Migrate existing repository tasks.
   - Add a deterministic internal migration helper that scans active and archived task dirs, orders legacy `task-*` tasks by `created_at`, assigns numeric ids from their titles, rewrites `task.json.id`, appends a migration trace event, and moves closed tasks into archive.
   - Run that helper for the current repository so existing closed tasks become archived numeric tasks and the current open task receives a numeric id.

6. Update tests and generated surfaces.
   - Update kernel tests that assert `task-*` paths and ids.
   - Add focused coverage for generated ids, short numeric resolution, archive-on-finish, archived listing, validation ignoring archive by default, and migration of legacy directories.
   - Update adapter rendering and regenerate repo-local CW skills if helper command text changes.

## Key Decisions

- Use `.cw/tasks/archived/` as the only archive directory.
- Use four zero-padded digits as the numeric prefix.
- Allocate new numbers by scanning both active and archived tasks, taking the highest existing numeric prefix, and adding one.
- Resolve short references only from numeric prefixes; legacy `task-*` references are removed through migration.
- Treat active and archived task roots as separate storage scopes. Normal workflow actions require active tasks.
- Keep archived history accessible through an explicit listing flag rather than mixing it into default `cw tasks` output.

## Risks

- Renaming the current open task changes the id that future workflow commands should use.
- Existing tests heavily assert `task-*` ids and direct `.cw/tasks/<id>/` paths; the test update is part of the implementation work, not incidental cleanup.
- `finishTask` moving directories can break callers that assume the returned task still has an active directory.
- If task scanning remains duplicated in any module, `.cw/tasks/archived/` may be mistaken for a task directory.
- Migration must avoid collisions between existing numeric tasks and newly assigned ids.

## Validation Strategy

- Add unit/kernel tests for id generation and numeric reference resolution.
- Add tests for default active listing, explicit archived listing, and validation with `.cw/tasks/archived/` present.
- Add tests that finishing a task moves all artifacts into archive and removes the active directory.
- Add a migration test that converts legacy `task-*` directories, updates `task.json.id`, appends trace, and archives closed tasks.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .`.
