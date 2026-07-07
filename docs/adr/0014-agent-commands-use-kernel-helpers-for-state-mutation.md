# Agent commands use kernel helpers for state mutation

Flowflow workflow actions are invoked through coding-harness-native agent commands or skills, while deterministic repository state changes are performed by kernel helpers. This keeps the user experience agent-native and lets the kernel consistently update task state, trace events, resume notes, schema markers, and validation results without relying on the coding agent to hand-edit structured files.
