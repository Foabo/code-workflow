# Rules

## Coding

## Testing

## Review

## Agent Rules

## Do Not

## From task-codex-self-evolution

- Codex, OpenCode, and Pi repo-local CW skills are generated under `.agents/skills/`. They may be regenerated with `cw update --harness <codex|opencode|pi>`.
- Claude repo-local CW skills are generated under `.claude/skills/`. They may be regenerated with `cw update --harness claude`.
- Do not edit generated CW skills as canonical workflow truth; update adapter rendering code and regenerate them.
- Do not claim repository-local `.codex/prompts/` files are Codex commands; Codex custom prompts are documented as local Codex home files and deprecated.
