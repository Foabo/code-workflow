# Plan

## Approach

Implement this as conditional section generation in the adapter.

1. Make `Execution Strategy Guidance` optional.

   Change the generated-skill renderer so `Execution Strategy Guidance` is emitted only for commands that have real execution-strategy choices. Move the inline-completeness invariant into `Rules` so commands without the section are still safe and self-contained.

2. Define the initial strategy-aware command set.

   Add an explicit command list or helper in `src/adapters.ts` for commands that need execution-strategy guidance: `cw-work`, `cw-plan`, `cw-run`, and `cw-check`. These commands should retain command-specific delegation authorization and inline-fallback wording in Phase Guidance.

3. Remove unnecessary strategy sections from unrelated commands.

   Generated `cw-clarify`, `cw-finish`, `cw-resume`, `cw-discard`, `cw-doctor`, and `cw-understand` should not include `Execution Strategy Guidance` unless their own guidance later introduces a real strategy choice.

4. Update tests and regenerate.

   Update generated-skill assertions to prove conditional section generation, retained command-specific delegation rules, and absence of high-noise subagent detail in unrelated commands. Regenerate Codex repo-local skills and run verification.

## Key Decisions

- Treat `Execution Strategy Guidance` as a conditional section, not part of the fixed generated skill skeleton.
- Keep the shared `Rules` section responsible for the minimal invariant: inline execution must remain complete.
- Keep specific delegation rules close to command behavior in Phase Guidance.
- Do not change the generic Helper Commands list in this task.

## Risks

- Commands without `Execution Strategy Guidance` may appear less self-contained. Mitigate by keeping the inline-completeness invariant in `Rules`.
- The command list for strategy-aware skills can drift as commands evolve. Mitigate with tests that assert both presence and absence.
- Tests can overfit wording. Use stable section and behavior phrases rather than entire paragraph snapshots.

## Validation Strategy

- Inspect generated `cw-work`, `cw-plan`, `cw-run`, and `cw-check` skills for `Execution Strategy Guidance` and command-specific delegation rules.
- Inspect generated `cw-clarify`, `cw-finish`, `cw-resume`, `cw-discard`, `cw-doctor`, and `cw-understand` for absence of `Execution Strategy Guidance`.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .`.
