# Agent-native workflow actions with a thin CLI wrapper

The workflow kernel will treat actions such as work, clarify, spec, plan, context, run, verify, review, finish, and resume as agent-native workflow actions first, not as CLI commands first. The CLI remains a thin wrapper for initialization, diagnostics, schema validation, adapter generation, and automation, because the daily product experience should happen inside the coding harness while all surfaces still write to the same `.cw` task facts.
