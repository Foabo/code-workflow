# Rules

## Coding

- Keep root source entries thin. Do not add product logic to `src/index.ts`, `src/cli.ts`, or `src/agent-command.ts`.
- Do not add business rules to `src/shared/`.
- Do not let `src/domain/` import product capability modules.

## Testing

- Tests are organized by product capability under `tests/<capability>/`.
- Shared test helpers live under `tests/support/` and should not import concrete test suites.
- Module boundary rules are enforced by `tests/architecture/module-boundaries.test.ts`.

## Review

- Every task must record a Baseline Outcome before finish. The outcome is either a task-local `baseline-delta.md`, a note that no reusable project facts were found, or a note that candidate facts are not stable enough yet.
- Clarify and plan may capture reusable project facts as task-local candidates, but check owns the final Baseline Outcome before finish.
- Generated workflow skill trigger text describes the Flowflow workflow action and accepted invocation forms. It must not bind the trigger condition to a host name such as Codex, Claude, OpenCode, Pi, or Cursor.
- Finish actively consumes an ordinary `baseline-delta.md` by default. Accepted merges all delta sections into existing Project Baseline files, selected merges only named baseline files, edited applies replacement current-state sections, and skipped records no Project Baseline change.
- Baseline impact classification is based on parsed non-empty section content, not empty baseline-delta template headers.
- Generated workflow guidance should define internal workflow phases inside the owning workflow skill. Create a separate generated skill only for independently invokable workflow actions, not for internal protocol stages.

## Agent Rules

## Do Not

## From task-codex-self-evolution

- Codex, OpenCode, and Pi repo-local Flowflow skills are generated under `.agents/skills/`. They may be regenerated with `ff update --harness <codex|opencode|pi>`.
- Claude repo-local Flowflow skills are generated under `.claude/skills/`. They may be regenerated with `ff update --harness claude`.
- Do not edit generated Flowflow skills as canonical workflow truth; update adapter rendering code and regenerate them.
- Do not claim repository-local `.codex/prompts/` files are Codex commands; Codex custom prompts are documented as local Codex home files and deprecated.

- Clarify proposals must keep stable proposal identity in trace events so advisor review and explicit accept cannot be reused across different Proposed Specs.

- Role agents do not own task closure, baseline promotion decisions, requirement drift, or destructive worktree handling. Those decisions stay in the main session and use Flowflow helpers.

- Use `ff internal propose-spec --spec-file <path>` and `ff internal accept-spec` to record clarify gate proposal identity and advisor/accept outcomes. Do not hand-compute `proposal_hash`/`proposal_id` or hand-thread the identity triple (`attempt_id`/`proposal_id`/`proposal_hash`) in trace events — the helpers own hashing and identity binding.

- Current workflow commands and generated skills must use `ff` / `ff-*` and `.ff`. Old `cw` / `cw-*` / `.cw` names are historical migration context only.
- Use `ff internal ...` helpers for deterministic task state changes and trace events.

- Current workflow commands and generated skills must use `ff` / `ff-*` and `.ff`. Old `cw` / `cw-*` / `.cw` names are historical migration context only.
- Do not edit generated Flowflow skills as canonical workflow truth; update adapter rendering code and regenerate harness artifacts.
- Use `ff internal ...` helpers for deterministic task state changes and trace events.

- Ordinary `ff update` must not silently overwrite recognized user-edited role agent configuration. Use `ff update --force` only when intentionally regenerating role agents from `.ff/orchestration.json`.
- Direct edits to generated role agent files are protected only for recognized configuration fields; arbitrary generated instruction-body edits remain generated-output drift.
- Generated `ff-clarify` guidance must show `accept-spec --advisor-unavailable` as mutually exclusive with `--verdict`.

- Public CLI help requests must return before workflow execution, project checks, task selection, trace writes, resume-note consumption, or other repository state changes.
