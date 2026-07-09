---
name: ff-understand
description: Draft project baseline updates for an existing repository, then ask the user what to merge.
---

Use this skill for the `ff-understand` Flowflow workflow action in this repository. Trigger it for `/ff-understand`, `$ff-understand`, `ff understand`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-understand

Draft project baseline updates for an existing repository, then ask the user what to merge.

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

## Workflow Steps

1. Run `ff preflight --action understand`.
2. Inspect repository structure, package files, commands, and existing docs.
3. Draft candidate updates for .ff/project/overview.md, architecture.md, rules.md, and commands.md.
4. Ask the user what to merge before editing project baseline files.
5. After accepted edits, run `ff internal append-trace --task <task-id> --type baseline.updated --summary <summary>` only if this is tied to a task.

## Phase Guidance

- Understand is draft-first repository observation. Write candidates to .ff/understand-draft/ and never overwrite .ff/project/* automatically.
- Separate observed facts from inferences. Observed facts include files, package scripts, config, docs, dependencies, and existing .ff/project content; uncertain inferences should say Review required.
- Read the current Project Baseline before proposing a merge, and preserve user-authored current-state content unless the user accepts a replacement.
- Ask which drafted sections to merge. Merge only accepted content, and record a baseline.updated trace event only when the understand work is tied to a task.
- Do not promote task-local plans, aspirations, or one-off implementation details into Project Baseline.


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
