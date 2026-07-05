# Plan

## Approach
Update the adapter source of truth first, then regenerate repo-local Codex skills. Adjust `runResume` so the command reads resume context and opens a parked task when needed, while leaving `resume.md` in place until later progress is recorded. Add kernel-owned consumption after subsequent successful task progress. Update kernel tests to lock the generated guidance and the new resume action semantics.

## Key Decisions
- Keep the new guidance in `commandGuidance` so all harnesses render the same support-command behavior.
- Keep `cw-understand` and `cw-doctor` executable behavior unchanged unless tests expose drift from the documented contract.
- Change the `resume` workflow action and subsequent progress actions because the current executable shim deletes `resume.md` before any later workflow action records progress.

## Risks
- Tests may currently assert immediate resume consumption and need to be updated to match the ADR.
- Generated skill snapshots can drift if adapter changes are not followed by `cw update --harness codex`.
- Doctor warnings may make `cw doctor` fail while the active task is intentionally incomplete.

## Validation Strategy
- Run focused tests around generated skills, resume, doctor, and understand behavior.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .`.
