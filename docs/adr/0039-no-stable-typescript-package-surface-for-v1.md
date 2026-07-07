# No stable TypeScript package surface for v1

Flowflow v1 is a CLI and agent-skills driven workflow tool. It does not promise a stable external TypeScript package surface.

The stable invocation surfaces are the `ff` CLI, the `ff-*` agent commands, and generated harness skills. TypeScript exports may exist only when they serve those product surfaces or a deliberately deep internal module interface. Callers should not treat low-level Kernel Helper functions as public product interface.

`ff internal` remains an internal CLI adapter seam used by generated agent skills for deterministic state changes. It should expose high-level helper commands needed by the skills, not mirror low-level TypeScript helper functions one-for-one.

This keeps the v1 module design simple: internal helpers can be renamed, collapsed, or removed while the CLI and agent skills keep the product behavior stable.

Consequences:

- `src/index.ts` should stop re-exporting every implementation module by default.
- The package root should export only product-level orchestration: initialization, adapter refresh, Workflow Action execution, validation, and doctor checks.
- The package root may export result and option types needed by those product-level functions.
- Tests should prefer product-level module seams over low-level helper imports.
- Tests should not use the package root or internal module paths as shortcuts to low-level Kernel Helper functions.
- Tests should assert product behavior and deep module behavior rather than low-level state-writing steps.
- Tests should observe outcomes such as closed tasks, trace events, validation results, generated files, and baseline changes.
- Low-level helper exports should not be kept for compatibility or test convenience.
- Internal Kernel Helpers such as task state mutation, baseline sync, enhancement setup, and closure gate mechanics should move behind deeper modules directly.
- Because this is a new repository, refactors should optimize for the target architecture rather than staged compatibility.
- `ff internal` should stay as a CLI adapter seam for generated skills, but its command set should be shaped around deep workflow operations.
- The first implementation slice should narrow the package root interface and move tests away from low-level helper imports toward product-level behavior tests.
- If a stable programmatic package surface becomes a real requirement later, it should get a separate design decision.
