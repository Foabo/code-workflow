# Baseline Delta

## overview.md

## architecture.md

- CW supports a Codex harness adapter that generates a repository-local plugin marketplace entry and `cw-workflow` plugin skills under `plugins/cw-workflow/skills/`.
- The Codex adapter reuses the same workflow action semantics as generic `.cw/agent-commands/`; `.cw` remains Repo Truth.

## rules.md

- Codex-specific generated plugin skills are harness entries. They may be regenerated with `cw update --harness codex`.
- Do not edit generated Codex plugin skills as canonical workflow truth; update adapter rendering code and regenerate them.
- Do not claim repository-local `.codex/prompts/` files are Codex commands; Codex custom prompts are documented as local Codex home files and deprecated.

## commands.md

- Generate or refresh Codex harness entries with `cw update --harness codex`.
- Verify adapter behavior with `npm run typecheck`, `npm test`, and `npm run build`.
