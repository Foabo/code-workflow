---
name: ff-check
description: Run verification and review, reconcile drift, and update task.md before finish is allowed.
---

Use this skill for the `ff-check` Flowflow workflow action in this repository. Trigger it for `/ff-check`, `$ff-check`, `ff check`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-check

Run verification and review, reconcile drift, and update task.md before finish is allowed.

## Required Reading

- .ff/version.json
- .ff/project/overview.md
- .ff/project/architecture.md
- .ff/project/rules.md
- .ff/project/commands.md
- Current task files under .ff/tasks/<task-id>/ when a task exists

## Rules

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use ff internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Use `.ff/orchestration.json` and generated `ff-<role>` agent files as the role and model contract when delegation is available.
- Explicitly ask the harness to spawn the named `ff-<role>` agent for bounded delegated work; Codex only spawns subagents after the main session asks.
- Delegation is optional and permission-bound; continue inline when delegation is unavailable or unauthorized.
- Delegated work receives task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Delegated agents must not close tasks; closure decisions and unresolved drift return to the main session.

Role routing for this command:

- Use `ff-checker` for verification commands, evidence updates, and small in-scope repairs.
- Use `ff-reviewer` for artifact alignment, acceptance-criteria coverage, regressions, and missing tests.

## Workflow Steps

1. Run `ff preflight --action check --task <task-id>`.
2. Run the relevant commands from .ff/project/commands.md.
3. For deterministic verification commands, the executable shim may be called with repeated `ff-check --task <task-id> --command <cmd>` flags and `--baseline-outcome <text>`.
4. Run artifact alignment review against spec.md, plan.md, and task.md.
5. Run implementation evidence review against every acceptance criterion.
6. Fix small local defects when the task contract is unchanged.
7. If spec drift appears, stop for user confirmation and update spec.md only after confirmation.
8. Record one Baseline Outcome before finish: baseline-delta.md created or updated, no reusable project facts, or candidate not stable yet.
9. Update task.md verification and check items.
10. Append a check trace event with `ff internal append-trace --task <task-id> --type check.passed --summary <summary>` or `check.failed`.
11. When check passes, run `ff internal set-state --task <task-id> --phase finish --next-action <text>`.

## Phase Guidance

- Artifact alignment review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work.
- Implementation evidence review maps every acceptance criterion to evidence in task.md Verification or Check entries. Evidence can be tests, commands, file checks, CI/CD or test-environment notes, or manual verification.
- CI/CD or test-environment evidence states environment, action, and result without relying on commit identity.
- Small local defects may be fixed during check when the accepted spec.md contract is unchanged. Changes to spec.md or out-of-scope implementation behavior return to clarify for user confirmation.
- Check owns the final Baseline Outcome. Update baseline-delta.md for stable reusable facts, or record that there are no reusable project facts or that candidates are not stable yet.
- Use `ff-checker` to run verification, record evidence, and repair small in-scope defects when delegation is available.
- Use `ff-reviewer` for broad, behaviorally large, or workflow-semantics changes only when the harness, tools, and user or environment permission allow delegation; otherwise perform the same artifact and evidence review inline.
- Run a final broad review when the change is cross-cutting, behaviorally large, or touches workflow semantics shared by multiple commands.


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
- ff internal accept-spec --task <task-id> --verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | [--advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>]
- ff internal validate-clarify --task <task-id> --stage proposal|accept|advance
- ff internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- ff internal finish-task --task <task-id> --summary <summary> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none] [--edited-content <confirmed-current-state-sections>]
- ff internal discard-task --task <task-id> --confirm --worktree <handling>
- ff internal create-resume --task <task-id> --content <markdown>
- ff internal ensure-baseline-delta --task <task-id>
- ff internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped [--selected-files <overview.md,architecture.md,rules.md,commands.md>] [--edited-content <confirmed-current-state-sections>]
- ff internal consume-resume --task <task-id>
