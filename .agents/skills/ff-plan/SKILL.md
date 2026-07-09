---
name: ff-plan
description: Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.
---

Use this skill for the `ff-plan` Flowflow workflow action in this repository. Trigger it for `/ff-plan`, `$ff-plan`, `ff plan`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-plan

Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.

## Required Reading

- .ff/version.json
- .ff/project/overview.md
- .ff/project/architecture.md
- .ff/project/rules.md
- .ff/project/commands.md
- Current task files under .ff/tasks/<task-id>/ when a task exists
- Current task context package under .ff/tasks/<task-id>/context-package.md when present and current

## Rules

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use ff internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
- Treat context-package.md as a generated cache; refresh it or fall back to original .ff files and git information when it is missing, stale, incomplete, or uncertain.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Use `.ff/orchestration.json` and generated `ff-<role>` agent files as the role and model contract when delegation is available.
- Explicitly ask the harness to spawn the named `ff-<role>` agent for bounded delegated work; Codex only spawns subagents after the main session asks.
- Delegation is optional and permission-bound; continue inline when delegation is unavailable or unauthorized.
- Before delegated work, run `ff internal refresh-context-package --task <task-id>` when a task id is known, then provide context-package.md plus any role-specific original files that remain necessary.
- Delegated work receives the current context package, task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- The context package is not Repo Truth; stale manifests, missing sections, uncertain diff entries, or verdict work require reading original .ff files and git information.
- Delegated agents must not close tasks; closure decisions and unresolved drift return to the main session.

Role routing for this command:

- Use `ff-planner` to draft plan.md and task.md from the accepted spec when delegation is available.
- Use `ff-reviewer` for post-plan cross-review before moving to run.

## Workflow Steps

1. Run `ff preflight --action plan --task <task-id>`.
2. Read spec.md and relevant project baseline files.
3. Apply the spec quality gate described below.
4. If the spec quality gate fails, return to ff-clarify behavior with one concrete next question.
5. Edit plan.md with the implementation approach, key decisions, risks, and validation strategy.
6. Edit task.md with executable implementation, verification, and check items.
7. Capture stable design, workflow, command, or rule candidates in task-local artifacts when planning discovers reusable project facts.
8. Run a post-plan artifact cross-review of spec.md, plan.md, and task.md before moving to run.
9. Run `ff internal set-state --task <task-id> --phase run --next-action <text>`.

## Phase Guidance

- The spec quality gate checks that Goal is concrete, Scope bounds the work, Acceptance Criteria are checkable, and Decisions cover product trade-offs that affect implementation.
- Do not modify spec.md during planning. If the gate fails, block the task in clarify phase and provide one concrete next question in the blocked reason or next action.
- Plan from the accepted contract. Implementation choices may be recorded in plan.md only when they stay inside the confirmed spec.
- When a current context-package.md exists, use it to navigate task facts quickly, but the spec quality gate must still read accepted spec.md directly.
- Capture stable design, workflow, command, or rule candidates when they are reusable project facts; keep one-off implementation steps out of baseline candidates.
- Break task.md implementation items into small, verifiable vertical slices. Keep file-level edits as implementation details, not primary checklist items.
- Match the user's language in user-visible planning text. If the accepted spec or user request is Chinese, write plan summaries, task items, risks, and evidence notes in Chinese except commands, file paths, API names, code identifiers, and product names.
- Write plan.md and task.md as executable actions, concrete trade-offs, and verification evidence. Say what will change, why it stays inside the accepted spec, and how check can prove it.
- For each accepted acceptance criterion, plan.md or task.md must name the concrete action, target artifact or behavior, expected observable result, and verification evidence. Avoid checklist items that are only topic labels such as `update guidance`, `improve tests`, or `review behavior` unless they state the exact changed surface and proof.
- Key Decisions must record the chosen approach and the reason it stays within scope. Risks must name the failure mode and the check that would reveal it.
- Avoid abstract labels, jargon stacks, grand claims, unexplained internal terms, formulaic three-part lists, binary contrast formulas, empty positive endings, overused discourse markers, passive or actorless claims, and acceptance criteria without evidence.
- When delegation is available, ask `ff-planner` to draft plan.md and task.md from the accepted spec, then ask `ff-reviewer` to run the post-plan artifact cross-review. The main session resolves drift and moves phase.
- Post-plan artifact cross-review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work. Use `ff-reviewer` only when the harness, tools, and user or environment permission allow delegation; otherwise run the same check inline.
- For generated workflow guidance changes, task.md Check must include behavior probes in addition to string assertions: at least one `ff-clarify` sample request and one `ff-plan` accepted-spec scenario, each with expected failure mode, desired behavior, reviewer verdict, and remaining risk. Use `ff-reviewer` or `ff-advisor` when delegation is available; otherwise record degraded inline review.
- Keep deterministic tests separate from behavior review. Tests should verify generated output, while check-stage review evaluates likely agent behavior.


## Helper Commands

- ff validate
- ff doctor
- ff tasks
- ff preflight --action <action> [--task <task-id>]
- ff internal create-task --title <title> [--id <task-id>]
- ff internal select-task [--task <task-id>]
- ff internal append-trace --task <task-id> --type <event-type> --summary <summary>
- ff internal append-trace --task <task-id> --type <event-type> --summary <summary> --data-json <json-object>
- ff internal propose-spec --task <task-id> --spec-file <path>
- ff internal accept-spec --task <task-id> (--verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>)
- ff internal validate-clarify --task <task-id> --stage proposal|accept|advance
- ff internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- ff internal finish-task --task <task-id> --summary <summary> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none] [--edited-content <confirmed-current-state-sections>]
- ff internal discard-task --task <task-id> --confirm --worktree <handling>
- ff internal create-resume --task <task-id> --content <markdown>
- ff internal ensure-baseline-delta --task <task-id>
- ff internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped [--selected-files <overview.md,architecture.md,rules.md,commands.md>] [--edited-content <confirmed-current-state-sections>]
- ff internal consume-resume --task <task-id>
- ff internal refresh-context-package --task <task-id>
