# Minimal machine-readable core files

Flowflow will use a small machine-readable core: `.ff/version.json`, `.ff/tasks/<task-id>/task.json`, and `.ff/tasks/<task-id>/trace.jsonl`. Human-readable task artifacts live beside the task state as Markdown files: `spec.md`, `plan.md`, `task.md`, optional `baseline-delta.md`, and optional `resume.md`, while Git remains the source of truth for code changes.
