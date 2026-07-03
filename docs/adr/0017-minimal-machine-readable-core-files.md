# Minimal machine-readable core files

CW will use a small machine-readable core: `.cw/version.json`, `.cw/tasks/<task-id>/task.json`, and `.cw/tasks/<task-id>/trace.jsonl`. Human-readable task artifacts live beside the task state as Markdown files: `spec.md`, `plan.md`, `task.md`, optional `baseline-delta.md`, and optional `resume.md`, while Git remains the source of truth for code changes.
