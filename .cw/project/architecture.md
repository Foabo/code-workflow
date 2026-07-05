# Architecture

## Stack

## Modules

## Data Flow

## Integration Points

## Constraints

## From task-codex-self-evolution

- CW harness adapters generate repo-local skills as the default invocation surface. Codex, OpenCode, and Pi use `.agents/skills/`; Claude uses `.claude/skills/`.
- Generated skills reuse the same workflow action semantics and point back to `.cw` as Repo Truth.

- `cw-clarify` correctness belongs in deterministic CW gates first. Generated skills and local hooks are invocation/enforcement surfaces, not the source of truth for whether `spec.md` may be written or a task may advance.
- Local watchdog artifacts should call a shared validator such as `cw internal validate-clarify --watchdog` rather than carrying independent per-harness gate logic.
