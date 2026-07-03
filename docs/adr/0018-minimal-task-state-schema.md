# Minimal task state schema

CW task state records will keep only the fields needed to drive workflow progress: id, title, lifecycle, phase, next action, health flags, artifact paths, invalidated artifacts, blocking or parking metadata, timestamps, and schema version. The task state record will not include result fields, touched-file lists, model configuration, token budgets, provider usage, or external memory state. `lifecycle: "closed"` means the task is finished.
