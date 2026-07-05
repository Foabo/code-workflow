---
name: cw-clarify
description: Review fuzzy intent, produce a user-confirmed Proposed Spec, then update spec.md with the accepted task contract.
---

Use this skill when the user asks Codex to run `cw-clarify` or the matching CW workflow action in this repository.

Before acting, read the repository's `.cw` files relevant to the current task. Treat `.cw` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

<!-- generated-by-cw:v1 -->

# cw-clarify

Review fuzzy intent, produce a user-confirmed Proposed Spec, then update spec.md with the accepted task contract.

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

1. Run `cw preflight --action clarify --task <task-id>` when a task id is known.
2. Read the current spec.md and relevant project baseline files.
3. Choose strict or light clarify behavior using the Phase Guidance below.
4. Ask only the questions needed to settle goal, scope, non-goals, constraints, decisions, and acceptance criteria.
5. Present a short Proposed Spec and wait for user confirmation before editing spec.md.
6. Edit spec.md only with the accepted task contract.
7. Run `cw internal set-state --task <task-id> --phase plan --next-action <text>` when the spec is accepted.
8. If required information is missing, run `cw internal set-state --task <task-id> --lifecycle blocked --phase clarify --blocked-reason <reason> --next-action <text>`.

## Phase Guidance

- Default to strict requirements review. Use light mode only when the user explicitly asks for fast handling, or when the task is low risk, goal-complete, reversible, and has obvious verification.
- Escalate to strict mode when the request affects product behavior, workflow semantics, CLI/API behavior, task lifecycle, state machines, cross-module behavior, irreversible work, or unclear acceptance criteria.
- Expand only when the user gives background or a loose desire instead of a clear target. Expand around user results, offer at most three candidate directions, and recommend one.
- Grill after a candidate direction exists. Ask one important question at a time, include your recommended answer, and name the trade-off when it matters.
- Clarification is complete only when the goal, boundary, acceptance criteria, and key risks are clear enough to write spec.md without high-risk assumptions.
- Before writing spec.md, present a Proposed Spec using the existing sections: Goal, Scope, Non-goals, Constraints, Decisions, and Acceptance Criteria. Continue asking if any high-risk assumption remains.
- Clarify terminology lightly. Task-local terms belong in spec.md; stable reusable project concepts may become baseline-delta.md candidates.


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

