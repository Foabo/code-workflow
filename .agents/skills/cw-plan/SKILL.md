---
name: cw-plan
description: Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.
---

Use this skill when the user asks Codex to run `cw-plan` or the matching CW workflow action in this repository.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# cw-plan

Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.

## Required Reading

- .cw/version.json
- .cw/project/overview.md
- .cw/project/architecture.md
- .cw/project/rules.md
- .cw/project/commands.md
- Current task files under .cw/tasks/<task-id>/ when a task exists

## Rules

- Treat .cw task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use cw internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- If a subagent, skill, hook, MCP tool, or code intelligence tool is unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Hybrid execution is recommended when the harness supports delegation: keep coordination in the main session while delegating implementation or checking.
- Subagents receive task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Implementer subagents may write code and update checklist progress, but must not close tasks.
- Checker subagents must return spec drift or product behavior changes to the main session for user confirmation.

## Workflow Steps

1. Run `cw preflight --action plan --task <task-id>`.
2. Read spec.md and relevant project baseline files.
3. Apply the spec quality gate described below.
4. If the spec quality gate fails, return to cw-clarify behavior with one concrete next question.
5. Edit plan.md with the implementation approach, key decisions, risks, and validation strategy.
6. Edit task.md with executable implementation, verification, and check items.
7. Run a post-plan artifact cross-review of spec.md, plan.md, and task.md before moving to run.
8. Run `cw internal set-state --task <task-id> --phase run --next-action <text>`.

## Phase Guidance

- The spec quality gate checks that Goal is concrete, Scope bounds the work, Acceptance Criteria are checkable, and Decisions cover product trade-offs that affect implementation.
- Do not modify spec.md during planning. If the gate fails, block the task in clarify phase and provide one concrete next question in the blocked reason or next action.
- Plan from the accepted contract. Implementation choices may be recorded in plan.md only when they stay inside the confirmed spec.
- Break task.md implementation items into small, verifiable vertical slices. Keep file-level edits as implementation details, not primary checklist items.
- Post-plan artifact cross-review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work. Prefer an independent reviewer subagent for nontrivial tasks when supported; otherwise run the same check inline.


## Helper Commands

- cw validate
- cw doctor
- cw tasks
- cw preflight --action <action> [--task <task-id>]
- cw internal create-task --title <title> [--id <task-id>]
- cw internal select-task [--task <task-id>]
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary>
- cw internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- cw internal finish-task --task <task-id> --summary <summary>
- cw internal discard-task --task <task-id> --confirm --worktree <handling>
- cw internal create-resume --task <task-id> --content <markdown>
- cw internal ensure-baseline-delta --task <task-id>
- cw internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped
- cw internal consume-resume --task <task-id>

