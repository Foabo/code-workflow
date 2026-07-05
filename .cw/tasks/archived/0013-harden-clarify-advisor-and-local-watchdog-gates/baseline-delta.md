# Baseline Delta

## overview.md

## architecture.md

- `cw-clarify` correctness belongs in deterministic CW gates first. Generated skills and local hooks are invocation/enforcement surfaces, not the source of truth for whether `spec.md` may be written or a task may advance.
- Local watchdog artifacts should call a shared validator such as `cw internal validate-clarify --watchdog` rather than carrying independent per-harness gate logic.

## rules.md

- Clarify proposals must keep stable proposal identity in trace events so advisor review and explicit accept cannot be reused across different Proposed Specs.

## commands.md

- `cw internal validate-clarify --stage proposal|accept|advance` validates clarify event order, proposal identity, advisor review or degraded execution evidence, and explicit accept.
