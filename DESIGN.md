# CW Design

CW is a workflow tool for coding harnesses. It gives a repository a shared task truth, agent-native workflow actions, concise project baseline files, and deterministic helper operations so Claude Code, Codex, Cursor, OpenCode, Pi, and similar tools can follow the same coding workflow without becoming a single unified harness manager.

## Mission

CW helps coding agents move development work from fuzzy request to finished task without losing the task contract, implementation plan, verification state, or reusable project knowledge.

Its product center is task progress quality and context efficiency:

- Keep task facts recoverable across sessions and coding harnesses.
- Let users work mainly through agent commands, not a heavy CLI.
- Keep files small enough to read and maintain.
- Let task specs evolve during real work.
- Promote stable task learnings into project baseline files only at finish.
- Rely on Git for actual code changes.

## Non-goals

CW does not:

- Replace coding harnesses.
- Manage model routing as a core feature.
- Track token usage, costs, or provider accounting.
- Maintain a second code-change ledger beside Git.
- Store raw chat history or full terminal logs.
- Require external memory, code intelligence, or spec frameworks.
- Force every task through many large documents.

Reference frameworks such as Trellis, OpenSpec, Superpowers, GSD, Gentle-AI, and Oh My OpenCode Slim may inspire adapters or heuristics, but they do not define CW's runtime or canonical `.cw` format.

## Invocation Model

Daily usage happens through coding-harness-native agent commands. Generated agent commands use a `cw-` prefix to avoid collisions:

```text
cw-work
cw-clarify
cw-plan
cw-run
cw-check
cw-finish
cw-resume
cw-discard
cw-doctor
cw-understand
```

The public CLI is small and focused on setup and maintenance:

```text
cw init
cw doctor
cw update
cw validate
```

Deterministic state mutations live behind internal helpers:

```text
cw internal ...
```

Agent commands decide intent and perform semantic edits. Kernel helpers validate structure, append trace events, update task state, consume resume notes, and provide transactional safeguards where practical.

## Repository Layout

```text
.cw/
  version.json

  project/
    overview.md
    architecture.md
    rules.md
    commands.md

  tasks/
    <task-id>/
      task.json
      trace.jsonl
      spec.md
      plan.md
      task.md
      baseline-delta.md  # optional
      resume.md          # optional, user-triggered, consumed after use

  templates/
    spec.md
    plan.md
    task.md
    baseline-delta.md
    resume.md
```

Git remains the source of truth for actual code changes. CW stores workflow state, task intent, plan, checklist progress, and project baseline knowledge.

## Project Baseline

Project baseline files are stable repository-level knowledge reused across tasks:

- `overview.md`: project purpose, current shape, major capabilities, important non-goals.
- `architecture.md`: tech stack, modules, data flow, integration points, architectural constraints.
- `rules.md`: coding rules, testing rules, review rules, agent rules, do-not rules.
- `commands.md`: setup, run, test, lint, typecheck, build, troubleshooting commands.

`cw init` creates short templates for these files. It does not try to fully understand a new project upfront.

New projects use:

```text
cw init -> cw-work
```

Existing projects may use:

```text
cw init -> cw-understand -> cw-work
```

`cw-understand` writes drafts first, then the user confirms what should be merged into `.cw/project/*`. It must not directly overwrite project baseline files from an automatic scan.

## Task State

Each task has a machine-readable `task.json` and an append-only `trace.jsonl`.

Minimal `task.json` shape:

```json
{
  "id": "task-auth-rate-limit",
  "title": "Add auth rate limiting",
  "lifecycle": "open",
  "phase": "clarify",
  "next_action": "Clarify rate-limit identity and acceptance criteria",
  "health_flags": [],
  "artifacts": {
    "spec": "spec.md",
    "plan": "plan.md",
    "task": "task.md",
    "baseline_delta": null,
    "resume": null
  },
  "invalidated_artifacts": [],
  "blocked_reason": null,
  "parked_reason": null,
  "resume_condition": null,
  "created_at": "2026-07-03T10:00:00+08:00",
  "updated_at": "2026-07-03T10:00:00+08:00",
  "schema_version": 1
}
```

There is no `ready` state and no result field.

Lifecycle values:

- `open`: the task can start or continue attempting progress.
- `blocked`: a necessary condition is missing, so the task cannot continue responsibly.
- `parked`: the user intentionally paused the task; it should not be treated as an active problem.
- `closed`: the task is finished.

`discard` is not a lifecycle state. It is a maintenance action that removes an abandoned task record after worktree handling.

`trace.jsonl` is append-only chronological event history:

```jsonl
{"ts":"2026-07-03T10:15:00+08:00","type":"spec.accepted","summary":"Task spec accepted by user."}
{"ts":"2026-07-03T10:32:00+08:00","type":"plan.updated","summary":"Plan and checklist created from accepted spec."}
{"ts":"2026-07-03T11:10:00+08:00","type":"check.passed","summary":"Tests passed and checklist review completed."}
```

Helpers append trace events. If a trace event is wrong, append a correction event instead of rewriting history.

## Task Artifacts

First-version task artifacts are intentionally small.

### `spec.md`

The task contract. It evolves during the task when clarification, implementation, check, or drift changes the contract.

Suggested structure:

```md
# Spec

## Goal

## Scope

## Non-goals

## Constraints

## Decisions

## Acceptance Criteria
- [ ] ...
```

### `plan.md`

The implementation approach, not a checklist.

Suggested structure:

```md
# Plan

## Approach

## Key Decisions

## Risks

## Validation Strategy
```

### `task.md`

The executable checklist. Finish depends on this being accurate.

Suggested structure:

```md
# Task

## Implementation
- [ ] ...

## Verification
- [ ] ...

## Check
- [ ] Acceptance criteria in spec.md are covered.
- [ ] No unresolved drift between implementation and spec.
- [ ] Dirty worktree handling is clear.

## Notes
```

### `baseline-delta.md`

Optional task-local candidate updates for Project Baseline. It is not project truth until finish-time sync.

Suggested structure:

```md
# Baseline Delta

## overview.md

## architecture.md

## rules.md

## commands.md
```

### `resume.md`

Optional user-triggered continuation note. Each task has at most one current `resume.md`. It is read only when the user invokes `cw-resume` or explicitly asks to continue from it. After the first subsequent workflow action records progress, CW deletes it.

## Workflow Actions

### `cw-work`

Default task progress action.

It may:

- Create or select a task.
- Run preflight.
- Clarify and update `spec.md`.
- Update `plan.md` and `task.md`.
- Run the next executable checklist items.
- Run `cw-check`.

It stops after check passes and asks whether to run `cw-finish`.

### `cw-clarify`

Clarifies the task and updates `spec.md`. It does not write code, update project baseline files, or create implementation checklist items. It completes when the user accepts the current task spec. If required information is missing, the task becomes `blocked` with a clear `blocked_reason` and `next_action`.

### `cw-plan`

Reads `spec.md` and relevant project baseline files, then updates:

- `plan.md`
- `task.md`

It does not write implementation code. If the spec is unclear, it returns to `cw-clarify` or blocks the task.

### `cw-run`

Executes the next appropriate checklist items from `task.md`. It reads `spec.md`, `plan.md`, and `task.md`, modifies code, updates checklist status, and appends trace events.

### `cw-check`

Combines verification and review. It may run tests, lint, typecheck, or manual checks. It also verifies:

- The implementation satisfies `spec.md`.
- The work follows `plan.md` where still valid.
- `task.md` accurately reflects completed implementation, verification, and review work.
- There is no unresolved drift.

If check finds drift, it updates or requests updates to `spec.md`, `plan.md`, or `task.md` before finish can proceed.

### `cw-finish`

Completes a task. It runs the Closure Gate, handles dirty worktree state, syncs accepted baseline deltas, deletes consumed `resume.md`, and sets `lifecycle` to `closed`.

There is no separate close or archive action.

### `cw-resume`

Uses a task-local `resume.md` when the user explicitly asks to resume from it. Resume notes are not the main recovery mechanism; normal recovery uses `task.json`, `trace.jsonl`, and task artifacts.

### `cw-discard`

Abandons a task by removing its task record and handling code changes:

- If the task uses an isolated Git worktree, CW can delete that worktree after confirmation.
- If the task shares the current worktree, CW asks whether to keep, revert, or stash uncommitted changes.

Discard does not produce a closed task.

### `cw-doctor`

Manual repository-level workflow health check.

It checks issues such as:

- malformed `.cw` files
- stale or blocked tasks
- missing `next_action`
- closed tasks with leftover `resume.md`
- schema version mismatch
- missing project baseline files
- dirty worktree concerns
- stale generated platform entry files

Action-local automatic checks are handled by preflight. `cw-doctor` is the broader manual diagnostic.

### `cw-understand`

Optional existing-repo understanding action. It writes drafts, then the user confirms what should be merged into Project Baseline. It is not required for new projects.

## Agent Orchestration

Agent orchestration is an execution strategy layer, not a different workflow. The same `cw-*` commands and `.cw` files must work across all strategies.

CW supports three execution strategies:

- `inline`: the main session performs every workflow action.
- `subagent`: role-specific agents perform selected workflow actions.
- `hybrid`: the main session coordinates the task while subagents perform implementation and checking where supported.

Hybrid is the recommended default. Inline remains mandatory because some coding harnesses do not support subagents or hooks.

Workflow roles:

- `clarifier`: asks questions, investigates enough to update `spec.md`.
- `planner`: updates `plan.md` and `task.md`.
- `implementer`: executes checklist items from `task.md`.
- `checker`: runs verification and review, then updates `task.md`.
- `baseline-writer`: helps sync accepted `baseline-delta.md` into Project Baseline during finish.

Rules:

- Agent orchestration is selected per harness and per command, not baked into task state.
- Subagents receive constructed context, not full chat history.
- Subagents should read only the task artifacts, relevant Project Baseline files, and necessary code.
- Subagents must not treat external memory as repo truth.
- Implementer subagents write code but do not close tasks.
- Checker subagents may fix small issues, but spec drift or product behavior changes return to the main session for user confirmation.
- Baseline sync requires user confirmation before Project Baseline changes are applied.
- If a subagent fails or is unavailable, the command can fall back to inline execution.

## Preflight

Preflight is an action-local quick check, not a full doctor run.

It runs before key actions such as `cw-work`, `cw-run`, `cw-check`, `cw-finish`, `cw-resume`, and `cw-discard`.

It may inspect:

- task state
- missing or invalid artifacts
- stale `resume.md`
- lifecycle and phase consistency
- dirty Git worktree state
- obvious drift concerns

Optional hooks can improve freshness on harnesses that support them, but preflight is the reliable cross-harness mechanism.

## Finish And Closure Gate

`cw-finish` is the only normal path to `lifecycle: closed`.

Closure Gate checks:

- task is in a finishable lifecycle and phase
- `spec.md` acceptance criteria are covered
- `task.md` implementation, verification, and check items are complete enough
- unresolved drift is absent
- dirty worktree state is handled
- baseline delta sync has been accepted, edited, or skipped

Dirty worktree handling:

- If the dirty worktree is the current task implementation, finish may continue only when check covers the current diff.
- If dirty worktree changes are unrelated, finish may continue only after the finish flow acknowledges they are outside this task.
- If the relationship is ambiguous, finish is blocked until the user or agent cleans up, commits, stashes, or clarifies the worktree state.

## Baseline Sync

Project Baseline updates happen only through:

- `cw-understand`
- `cw-finish`

During a task, candidate project facts go into `baseline-delta.md`. During finish:

1. CW previews the baseline delta.
2. The user confirms, selects, edits, or skips.
3. The agent semantically edits `.cw/project/*`.
4. Helpers validate and append trace events.
5. The task can close.

First version does not auto-apply baseline deltas without user confirmation. High-impact updates such as architecture changes, product capability changes, conflicts, deletions, or low-confidence edits require explicit confirmation.

## Init

`cw init` creates:

- `.cw/version.json`
- short Project Baseline templates
- `.cw/tasks/`
- `.cw/templates/`
- selected coding harness entry files and agent commands

It asks:

1. Which coding harness entries to generate.
2. Whether to configure code intelligence enhancements.
3. Whether to detect external memory or context tools.

Enhancements are skippable. CW remains fully usable without them.

`cw init` does not:

- generate a complete Project Baseline
- run `cw-understand` automatically
- ask about model routing
- ask about token accounting
- ask users to choose a subagent pack
- create a required bootstrap task

## Platform Adapters

CW generates native files for each selected coding harness. It does not force a single shared frontmatter format across harnesses.

Adapters must express:

- `.cw` is the repo truth
- `cw-*` commands are the workflow entry points
- agent commands should use kernel helpers for deterministic state mutation
- project baseline and task artifacts should be read before implementation
- external memory is never repo truth

Generated platform files are entry points, not canonical truth.

## Optional Enhancements

Optional code intelligence tools can support project understanding and task planning. Examples include codebase-memory-mcp, CodeGraph, LSP, or harness-native search.

Optional memory/context tools can be detected and warned about. They may inform a session, but they cannot overwrite Project Baseline, task state, or task artifacts.

## Implementation Stack

CW version 1 is implemented in TypeScript on Node.js.

Recommended stack:

- TypeScript for workflow kernel, CLI, adapter generation, schemas, and helpers.
- Node.js runtime and npm package distribution.
- A public `cw` CLI with `cw internal ...` helper commands for deterministic state mutation.
- Vitest or an equivalent TypeScript test runner.
- Zod or JSON Schema for validating `.cw/version.json` and task state records.
- Conservative Markdown editing helpers for templates, task artifacts, and project baseline files.
- Git integration through shelling out to `git`, because Git remains the source of truth for code changes.

## Completion Criteria For Version 1

Version 1 is complete when a user can:

1. Run `cw init` and generate at least one harness entry.
2. Start a new task with `cw-work`.
3. Use `cw-clarify` to produce an accepted `spec.md`.
4. Use `cw-plan` to create `plan.md` and `task.md`.
5. Use `cw-run` to implement checklist items.
6. Use `cw-check` to verify and review work against the task.
7. Use `cw-finish` to close a task with Closure Gate checks.
8. Use `cw-resume` for a user-triggered continuation note.
9. Use `cw-discard` to abandon a task safely.
10. Use `cw-understand` to draft Project Baseline updates for an existing repo.
11. Use `cw-doctor` to inspect repository workflow health.
12. Promote stable task learnings through `baseline-delta.md` at finish.

The workflow should remain useful without external code intelligence, external memory, hooks, isolated worktrees, or subagent support.
