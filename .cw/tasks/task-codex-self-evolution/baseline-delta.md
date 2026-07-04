# Baseline Delta

## overview.md

## architecture.md

- CW supports a Codex harness adapter that generates project-local prompt files under `.codex/prompts/`.
- The Codex adapter reuses the same workflow action semantics as generic `.cw/agent-commands/`; `.cw` remains Repo Truth.

## rules.md

- Codex-specific generated prompt files are harness entries. They may be regenerated with `cw update --harness codex`.
- Do not edit generated Codex prompt files as canonical workflow truth; update adapter rendering code and regenerate them.

## commands.md

- Generate or refresh Codex harness entries with `cw update --harness codex`.
- Verify adapter behavior with `npm run typecheck`, `npm test`, and `npm run build`.
