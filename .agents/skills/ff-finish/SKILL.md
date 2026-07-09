---
name: ff-finish
description: Run the closure gate, handle dirty worktree state, sync accepted baseline delta, consume resume notes, and close the task.
---

Use this skill for the `ff-finish` Flowflow workflow action in this repository. Trigger it for `/ff-finish`, `$ff-finish`, `ff finish`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-finish

Run the closure gate, handle dirty worktree state, sync accepted baseline delta, consume resume notes, and close the task.

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

- Use `ff-baseline-writer` to draft current-state Project Baseline updates from accepted baseline-delta.md.
- Keep dirty worktree decisions, baseline promotion choices, and task closure in the main session.

## Workflow Steps

1. Run `ff preflight --action finish --task <task-id>`.
2. Confirm dirty worktree handling when needed.
3. Review check evidence, unresolved drift flags, dirty worktree handling, baseline decision, and final summary as the closure packet.
4. If baseline-delta.md exists, prepare a current-state candidate diff for .ff/project files and merge it by default; stop only when the user chooses selected, edited, or skipped, or when the merge is high-impact or ambiguous.
5. Run `ff internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped` when applicable; pass `--selected-files` or `--edited-content` only for selected or edited handling.
6. Run `ff internal finish-task --task <task-id> --summary <summary> --dirty-worktree <covered|unrelated|clean> --baseline <accepted|selected|edited|skipped|none>`.
7. Report the closed task id and any project baseline files updated.

## Phase Guidance

- Finish closes the Flowflow task. It does not create commits, require one final commit, push branches, open PRs, deploy, clean up branches, or record a commit ledger.
- The closure packet covers check evidence, unresolved drift, dirty worktree handling, baseline decision, and final summary.
- Project Baseline files are current-state descriptions. If baseline-delta.md exists, the finish-stage agent prepares a candidate diff that integrates the delta into existing .ff/project files.
- Use `ff-baseline-writer` to draft the candidate baseline merge when delegation is available and baseline-delta.md is ordinary enough to merge. The main session must review the draft before running sync helpers.
- A fast inexpensive model may help draft the candidate baseline diff when available. The generated skill must support inline preparation, and the CLI core must not call an LLM.
- The default baseline decision is accepted: finish applies all merged baseline sections. If the user chooses selected, apply only named baseline files. If the user chooses edited, apply the user's replacement current-state sections. If the user chooses skipped, record no Project Baseline change.
- Apply the default merge without asking for a baseline decision again when the delta is ordinary and unambiguous; ask before high-impact, ambiguous, selected, edited, or skipped handling.


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
