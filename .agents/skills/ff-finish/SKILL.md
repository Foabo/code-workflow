---
name: ff-finish
description: Run the closure gate, handle dirty worktree state, sync accepted baseline delta, consume resume notes, and close the task.
---

Use this skill for the `ff-finish` Flowflow workflow action in this repository. Trigger it for `/ff-finish`, `$ff-finish`, `ff finish`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-finish

Run the closure gate, handle dirty worktree state, sync accepted baseline delta, consume resume notes, and close the task.

## Contract

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Read only the task and Baseline inputs required by this phase; use ff internal helpers for state and trace changes.
- Treat context-package.md as an explicit diagnostic artifact. Workflow actions and delegated roles do not refresh or load it automatically.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Delegation is optional and permission-bound; continue inline when unavailable. Use `.ff/orchestration.json` and `ff-<role>` agents for role/model routing.
- The main session owns code discovery. When an index is configured and its tool is visible, query it first. Record `call-failed`, provider `failed`/`skipped`/`unconfigured`, or `tool-missing` before falling back to `rg`, file lists, and direct reads.
- Save the bounded discovery result as validated code-context JSON, then run `ff internal build-work-packet --task <task-id> --role <role> [--code-context-file <path>]`.
- Spawn the named role with only a bounded task instruction and the command's stdout packet. The packet already contains validated code context. Do not pass the full task set, context package, manifest, evidence directory, or chat history.
- Missing required context must produce degraded or insufficient-context. Delegated roles do not close tasks or decide drift, scope, worktree handling, or Baseline promotion.

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
