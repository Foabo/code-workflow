# Spec

## Goal

Narrow CW v1's public TypeScript package interface so the product is clearly driven by CLI and agent skills, then move tests away from low-level Kernel Helper imports toward product-level behavior checks.

## Scope

- Update the package root exports in `src/index.ts` to expose only product-level orchestration functions and their necessary option/result types.
- Remove package-root exposure of low-level Kernel Helper functions such as task mutation, baseline sync, enhancement setup, closure gate mechanics, generated adapter internals, schema assert helpers, and low-level fs/path/json/git helpers.
- Update tests so they do not import low-level Kernel Helpers from the package root or internal module paths as a shortcut.
- Preserve behavior covered by the current kernel tests by asserting observable product outcomes through CLI, agent command, `runWorkflowAction`, or deliberately deep module seams.
- Keep `cw internal` as the CLI adapter seam for generated skills, while avoiding one-for-one preservation of low-level TypeScript helper functions as public interface.

## Non-goals

- Do not implement the full Task Progress, Finish, Enhancement setup, or Harness Adapter rendering deepening in this task.
- Do not create a stable external TypeScript package surface for v1.
- Do not preserve old TypeScript exports for compatibility.
- Do not change generated skill semantics unless required by the narrowed interface.

## Constraints

- Follow ADR-0039: CW v1 is CLI and agent-skills driven.
- Optimize for the target architecture because this is a new repository.
- Keep product behavior stable for the CLI, `cw-*` agent commands, generated skills, validation, doctor checks, and workflow action execution.
- Tests should observe outcomes such as closed tasks, trace events, validation results, generated files, and baseline changes.
- Do not use low-level helper exports merely to make tests convenient.

## Decisions

- `src/index.ts` is a product-level interface, not a convenience barrel for implementation modules.
- Public exports may include initialization, adapter refresh, Workflow Action execution, validation, doctor checks, and the option/result types needed by those functions.
- Low-level Kernel Helper functions should move behind deeper modules directly rather than remaining public for staged compatibility.
- `cw internal` remains as an internal CLI adapter seam for generated skills.
- See `docs/adr/0039-no-stable-typescript-package-surface-for-v1.md`.

## Acceptance Criteria
- [x] `src/index.ts` no longer re-exports every implementation module.
- [x] Package-root exports are limited to product-level orchestration functions and necessary option/result types.
- [x] Tests no longer import low-level Kernel Helper functions from the package root.
- [x] Tests avoid internal low-level helper imports as shortcuts; any internal import that remains targets a deliberately deep module seam.
- [x] Existing product behavior remains covered through observable outcomes.
- [x] Verification passes with `npm run typecheck`, `npm test`, and `npm run build`.
