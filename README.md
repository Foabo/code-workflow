# Flowflow

[中文说明](README.zh-CN.md)

Flowflow is a repository-scoped workflow kernel for coding agents. It turns development requests into recoverable task progress across clarify, plan, run, check, finish, resume, discard, doctor, and understand actions.

The npm package name is `flowflow`. After installation, the public command surface is:

```text
ff
ff-work
ff-clarify
ff-plan
ff-run
ff-check
ff-finish
ff-resume
ff-discard
ff-doctor
ff-understand
```

Use `ff --help`, `ff <command> --help`, `ff internal <helper> --help`, or `ff-<workflow> --help` to inspect the command you need.

## Repository Truth

Flowflow stores workflow state in `.ff/`. These files are the shared source of workflow facts for agents:

```text
.ff/version.json
.ff/enhancements.json
.ff/project/*.md
.ff/templates/*.md
.ff/tasks/<task-id>/
```

Task directories contain small artifacts such as `spec.md`, `plan.md`, `task.md`, optional `baseline-delta.md`, optional `resume.md`, `task.json`, and `trace.jsonl`.

Git remains the source of truth for code changes.

## Install And Develop Locally

Install dependencies:

```bash
npm install
```

Run the normal verification stack:

```bash
npm run typecheck
npm test
npm run build
node dist/src/cli.js validate --root .
node dist/src/cli.js doctor --root .
```

During local package testing, link the package:

```bash
npm run build
npm link
ff doctor --root .
ff update --root . --harness codex
```

Remove the global link after testing:

```bash
npm unlink -g flowflow
```

## Initialize A Repository

Run `ff init` once in the target repository:

```bash
ff init --harness codex
```

When `--root` is omitted, Flowflow uses the current directory. When key setup choices are omitted, Flowflow prompts for them unless `--yes` is passed.

`ff init` creates the `.ff/` Repo Truth files and generates harness-facing surfaces for the selected harness.

## Refresh Generated Harness Output

After changing Flowflow adapter rendering or generated workflow guidance, refresh generated files with:

```bash
ff update --harness codex
```

Codex, OpenCode, and Pi use repo-local skills under:

```text
.agents/skills/ff-*/SKILL.md
```

Claude uses:

```text
.claude/skills/ff-*/SKILL.md
```

Flowflow does not use repository-local `.codex/prompts/` as its command surface.

If a running agent thread cannot see newly generated skills, reload the workspace or start a new thread.

## Daily Workflow

Minimal flow:

```text
work -> clarify -> plan -> run -> check -> finish
          ^                         |
          |_________________________|
```

`clarify -> plan -> run -> check` can repeat as needed. A later step may return to an earlier step when the task goal, plan, or implementation needs adjustment. Move to `finish` after `check` confirms the task is ready to close.

Use the workflow commands through the generated skills or directly from the shell:

```bash
ff-work --root .
ff-clarify --root . --task <task-id>
ff-plan --root . --task <task-id>
ff-run --root . --task <task-id>
ff-check --root . --task <task-id>
ff-finish --root . --task <task-id> --summary "Finished the task"
```

Support commands:

```bash
ff-resume --root . --task <task-id>
ff-discard --root . --task <task-id> --confirm --worktree keep
ff-doctor --root .
ff-understand --root .
```

## Project Baseline

Project-level context lives in:

```text
.ff/project/overview.md
.ff/project/architecture.md
.ff/project/rules.md
.ff/project/commands.md
```

These files should change only when stable project facts change. `ff-understand` can draft updates under `.ff/understand-draft/`; review the draft before merging it into `.ff/project/*.md`.

## Troubleshooting

If a coding agent cannot find `ff-work`, check the generated skill and package binary:

```bash
ls .agents/skills/ff-work/SKILL.md
which ff-work
ff doctor --root .
```

If generated files look stale:

```bash
npm run build
node dist/src/cli.js update --root . --harness codex
node dist/src/cli.js doctor --root .
```

If a command's purpose or flags are unclear:

```bash
ff --help
ff doctor --help
ff-resume --help
ff internal accept-spec --help
```
