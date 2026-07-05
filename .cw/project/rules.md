# Rules

## Coding

## Testing

## Review

- Every task must record a Baseline Outcome before finish. The outcome is either a task-local `baseline-delta.md`, a note that no reusable project facts were found, or a note that candidate facts are not stable enough yet.
- Clarify and plan may capture reusable project facts as task-local candidates, but check owns the final Baseline Outcome before finish.
- Generated workflow skill trigger text describes the CW workflow action and accepted invocation forms. It must not bind the trigger condition to a host name such as Codex, Claude, OpenCode, Pi, or Cursor.
- Finish actively consumes an ordinary `baseline-delta.md` by default. Accepted merges all delta sections into existing Project Baseline files, selected merges only named baseline files, edited applies replacement current-state sections, and skipped records no Project Baseline change.
- Baseline impact classification is based on parsed non-empty section content, not empty baseline-delta template headers.

## Agent Rules

## Do Not

## From task-codex-self-evolution

- Codex, OpenCode, and Pi repo-local CW skills are generated under `.agents/skills/`. They may be regenerated with `cw update --harness <codex|opencode|pi>`.
- Claude repo-local CW skills are generated under `.claude/skills/`. They may be regenerated with `cw update --harness claude`.
- Do not edit generated CW skills as canonical workflow truth; update adapter rendering code and regenerate them.
- Do not claim repository-local `.codex/prompts/` files are Codex commands; Codex custom prompts are documented as local Codex home files and deprecated.

- Clarify proposals must keep stable proposal identity in trace events so advisor review and explicit accept cannot be reused across different Proposed Specs.
