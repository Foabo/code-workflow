# Baseline Delta

## overview.md

## architecture.md

- `ff update` uses `.ff/orchestration.json` as the durable source for Flowflow role agent model configuration. Generated role agent files remain invocation surfaces.
- During update, Flowflow protects recognized user-edited role agent configuration fields before overwriting generated role agents: Codex TOML model fields and markdown/frontmatter model, temperature, tools, readonly, background, and capability-tier fields.

## rules.md

- Ordinary `ff update` must not silently overwrite recognized user-edited role agent configuration. Use `ff update --force` only when intentionally regenerating role agents from `.ff/orchestration.json`.
- Direct edits to generated role agent files are protected only for recognized configuration fields; arbitrary generated instruction-body edits remain generated-output drift.
- Generated `ff-clarify` guidance must show `accept-spec --advisor-unavailable` as mutually exclusive with `--verdict`.

## commands.md

- `ff update --harness <codex|claude|opencode|pi|cursor>` refreshes generated skills, role agents, and local watchdog artifacts, then reports a restart/reload notice when the update completes successfully.
- `ff update --force --harness <codex|claude|opencode|pi|cursor>` intentionally overwrites protected generated role agent configuration from `.ff/orchestration.json`.
