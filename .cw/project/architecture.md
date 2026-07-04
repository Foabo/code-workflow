# Architecture

## Stack

## Modules

## Data Flow

## Integration Points

## Constraints

## From task-codex-self-evolution

- CW harness adapters generate repo-local skills as the default invocation surface. Codex, OpenCode, and Pi use `.agents/skills/`; Claude uses `.claude/skills/`.
- Generated skills reuse the same workflow action semantics and point back to `.cw` as Repo Truth.
