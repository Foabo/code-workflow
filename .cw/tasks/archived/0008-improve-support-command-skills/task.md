# Task

## Implementation
- [x] Add Phase Guidance for `cw-understand`, `cw-doctor`, and `cw-resume` in `src/adapters.ts`.
- [x] Update `runResume` so resume loads context without immediate consumption and opens parked tasks for continuation.
- [x] Add kernel-owned resume consumption after subsequent task progress.
- [x] Update kernel tests for generated guidance and resume behavior.
- [x] Regenerate repo-local Codex skills.

## Verification
- [x] Run focused test coverage for adapter guidance and resume behavior.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.

## Notes
- `npm test` ran all 38 kernel tests and covered the new generated guidance and resume behavior assertions.
- User confirmed automatic kernel-owned resume consumption after later progress.
