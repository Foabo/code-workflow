# Task

## Implementation
- [x] Replace wildcard exports in `src/index.ts` with an explicit product-level export list.
- [x] Update tests that import low-level Kernel Helpers from the package root.
- [x] Rewrite helper-level assertions as product behavior assertions where possible.
- [x] Identify any behavior that still lacks a deep module seam and record follow-up scope instead of preserving helper exports.
- [x] Keep `cw internal` CLI behavior intact.

## Verification
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .` if `.cw` task or baseline files changed during implementation.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.

## Notes

- Design source: `docs/adr/0039-no-stable-typescript-package-surface-for-v1.md`.
- Architecture report top recommendation: shrink Public Surface and test through product modules.
- No blocking missing deep module seam was found in this slice; existing coverage can move through `cw internal`, public CLI commands, and `runWorkflowAction`.
- Check passed with `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
- Dirty worktree is expected for this task's code/test/task/ADR files; `AGENTS.md` was already modified outside this task and was left untouched.
