# Plan

## Approach

1. Establish the naming contract in code constants.
   - Rename workflow path helpers from the old CW-centered names to Flowflow-centered names.
   - Change the canonical Repo Truth directory from `.cw` to `.ff`.
   - Change generated command lists from `cw-*` to `ff-*`.
   - Change the package/bin surface from `code-workflow` / `cw` / `cw-*` to `flowflow` / `ff` / `ff-*`.

2. Update runtime command behavior.
   - Make the public CLI usage and helper examples use `ff`.
   - Make agent command dispatch parse `ff-*`.
   - Update init, update, preflight, validate, doctor, task storage, workflow warnings, clarify gate messages, and enhancement setup paths that display or depend on `.cw`.
   - Keep the implementation direct; do not add compatibility layers for `cw` unless a short-lived bootstrap step is needed to complete the repository migration.

3. Update generator outputs at the source.
   - Change adapter rendering for skill names, trigger text, helper command text, role agent names, role routing text, and watchdog command text.
   - Change generated role agent filenames from `cw-<role>` to `ff-<role>`.
   - Change watchdog artifact filenames from `cw-clarify-watchdog.ts` to `ff-clarify-watchdog.ts` where the host stores a named script.

4. Migrate repository truth and generated artifacts.
   - Move `.cw/` to `.ff/` after source code and tests understand the new path.
   - Regenerate Codex, Claude, OpenCode, Pi, and Cursor artifacts from adapter source.
   - Remove stale generated `cw-*` skill, role agent, and watchdog files from current generated-surface directories.

5. Update current documentation and historical boundaries.
   - Rewrite current product docs, root instruction/context files, project baseline files, and current ADR/PRD/issue files to describe Flowflow, `ff`, `ff-*`, and `.ff`.
   - Leave old naming only where it is historical evidence in archived task records or explicit migration notes.

6. Verify, then handle external rename.
   - Run typecheck, tests, build, validate, and doctor.
   - Confirm GitHub CLI authentication and repository availability.
   - Rename `Foabo/code-workflow` to `Foabo/flowflow` when authorized, then update `origin`.
   - If GitHub rename cannot be performed, record the exact manual steps and verification commands in task notes.

## Key Decisions

- `Flowflow` is the product name.
- `flowflow` is the npm package name.
- `ff` is the public CLI command.
- `ff-*` is the generated skill, agent command, and role agent prefix.
- `.ff/` is the Repo Truth directory.
- No high-frequency short aliases are introduced in this task.
- No long-term `cw` / `cw-*` compatibility surface is kept.

## Risks

- The rename touches many string surfaces. Mitigation: change canonical constants and generator code first, regenerate artifacts, then search current surfaces for stale names.
- Moving `.cw/` to `.ff/` can make the current task temporarily invisible to the old CLI. Mitigation: perform the source/build change before moving the directory, then use the new built CLI for validation after migration.
- Historical archived tasks contain old names by design. Mitigation: stale-name checks must distinguish current files from historical task records.
- Generated artifacts can drift from adapter source. Mitigation: validate generated skill, role agent, and watchdog output through tests and `doctor`.
- GitHub repository rename is external state and may fail because of permissions, existing repo name, or network state. Mitigation: verify with `gh` and record manual fallback if needed.
- Existing dirty generated skill files must not be reverted. Mitigation: regenerate from adapter source and treat previous generated edits as part of the migration surface.

## Validation Strategy

- `npm run typecheck`
- `npm test`
- `npm run build`
- `node dist/src/cli.js validate --root .`
- `node dist/src/cli.js doctor --root .`
- Product-surface checks:
  - `package.json` bin exposes `ff` and `ff-*`.
  - Init fixtures create `.ff/` and no `.cw/`.
  - Generated Codex/Claude/OpenCode/Pi/Cursor surfaces use `ff-*`.
  - Watchdog artifacts call `ff internal validate-clarify --watchdog`.
  - Current docs and root instructions do not describe `cw` / `.cw` as the current surface.
  - `git remote -v` points to `git@github.com:Foabo/flowflow.git` after the external rename or task notes record the manual fallback.
