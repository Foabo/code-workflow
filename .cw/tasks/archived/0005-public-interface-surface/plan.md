# Plan

## Approach

Start at the package interface and tests, because this is the seam that currently turns implementation helpers into public facts.

1. Inspect current package-root exports and test imports.
2. Replace `src/index.ts` wildcard exports with an explicit product-level export list.
3. Move current tests off package-root low-level helpers.
4. Prefer product behavior tests through `runWorkflowAction`, CLI, validation, doctor checks, generated files, and trace/baseline outcomes.
5. Where a test currently needs direct helper access, decide whether the behavior belongs behind an existing product-level seam or should be deferred to a later deep module task.
6. Run verification and adjust only within this task's scope.

## Key Decisions

- ADR-0039 is the controlling decision for this task.
- The package root is not a stable external TypeScript package surface for v1.
- `cw internal` remains a CLI adapter seam for generated skills.
- Low-level TypeScript helper exports are not preserved for compatibility or test convenience.
- This task should prepare the codebase for later deepening of Task Progress, Finish, Enhancement setup, and Harness Adapter rendering modules.

## Risks

- The current test suite imports many helpers from the package root, so narrowing exports may require meaningful test reshaping.
- Some tests may reveal missing deep module seams; those should become follow-up tasks unless they block the package-root narrowing.
- Generated skills mention `cw internal`; changing TypeScript exports must not break the CLI adapter seam.
- Current `dist/` may lag behind `src/`; use project scripts to rebuild during verification.

## Validation Strategy

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .` if `.cw` files are changed during implementation.
- Review `src/index.ts` and tests for accidental low-level helper exposure.
