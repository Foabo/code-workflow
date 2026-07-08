# Baseline Delta

## overview.md

## architecture.md

## Modules

- `src/index.ts`, `src/cli.ts`, and `src/agent-command.ts` are root thin entries. Product implementation lives under capability directories.
- Source modules are organized by product capability: `src/cli/`, `src/project/`, `src/workflow/`, `src/tasks/`, `src/baseline/`, `src/harness/`, `src/enhancements/`, `src/domain/`, and `src/shared/`.
- Each product capability exposes its cross-module surface through `src/<capability>/index.ts`.
- `src/domain/` contains shared Flowflow domain types, schema validators, orchestration constants, and pure shared rules.
- `src/shared/` contains business-neutral utilities such as filesystem, JSON, and Git helpers.
- `src/tasks/` owns task ids, task state files, traces, archive layout, resume notes, task selection, and task artifact templates.
- `src/harness/` owns generated skills, role agents, watchdog artifacts, and harness update behavior.
- `src/enhancements/` owns enhancement provider registry, setup planning, setup execution, and setup metadata.

## Constraints

- Cross-capability imports should use the target capability public entry by default. Required deep-import exceptions belong in `tests/architecture/module-boundaries.test.ts` with a narrow allowlist and reason.
- The stable package and command paths remain `./dist/src/index.js`, `./dist/src/index.d.ts`, `./dist/src/cli.js`, and `./dist/src/agent-command.js`.

## rules.md

## Coding

- Keep root source entries thin. Do not add product logic to `src/index.ts`, `src/cli.ts`, or `src/agent-command.ts`.
- Do not add business rules to `src/shared/`.
- Do not let `src/domain/` import product capability modules.

## Testing

- Tests are organized by product capability under `tests/<capability>/`.
- Shared test helpers live under `tests/support/` and should not import concrete test suites.
- Module boundary rules are enforced by `tests/architecture/module-boundaries.test.ts`.

## commands.md

## Test

- `npm test` clears `dist`, builds the project, then runs every compiled nested test file under `dist/tests`.
