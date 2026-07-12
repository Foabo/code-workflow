---
name: ff-run
description: Execute the next checklist items from task.md, modify repository code, update progress, and append trace events through helpers.
---

Use this skill for the `ff-run` Flowflow workflow action in this repository. Trigger it for `/ff-run`, `$ff-run`, `ff run`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-run

Execute the next checklist items from task.md, modify repository code, update progress, and append trace events through helpers.

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

- Use `ff-implementer` only for bounded, independent implementation slices with a clear file or checklist scope.
- Keep requirement drift, scope changes, and phase movement in the main session.

## Workflow Steps

1. Run `ff preflight --action run --task <task-id>`.
2. Read spec.md, plan.md, task.md, and relevant code.
3. Implement the next unchecked task.md items against the accepted spec.md and plan.md contract.
4. Stop for user confirmation when work reveals requirement drift, plan contradiction, or product behavior outside scope.
5. Add or update tests by default for behavior, workflow semantics, CLI/API behavior, state transitions, parsing, validation, and error handling.
6. For simple file creation or replacement tasks, the executable shim may be called with `ff-run --task <task-id> --write-file <path> --content <text>`.
7. Update task.md checklist progress.
8. Record material progress with `ff internal append-trace --task <task-id> --type run.updated --summary <summary>`.
9. Run `ff internal ensure-baseline-delta --task <task-id>` when stable reusable project facts are discovered.
10. Run `ff internal set-state --task <task-id> --phase check --next-action <text>` when implementation items are complete enough to verify.

## Phase Guidance

- Run executes the accepted task contract. Do not expand product behavior or implementation scope beyond spec.md and plan.md without user confirmation.
- Delegate only a bounded task instruction and the code context needed for that implementation slice.
- Behavior changes require test evidence by default. Use red-green TDD when a clear public seam exists; use commands, fixtures, snapshots, file checks, or manual review when those are the right evidence.
- Use `ff-implementer` for independent vertical slices only when the harness, tools, and user or environment permission allow delegation; otherwise implement the same checklist items inline.
- Delegated implementers may write code and update checklist progress, but they must not close tasks or decide requirement drift.
- Domain modeling is optional. Use it only when terms or stable reusable project concepts change; otherwise record task-local terms in spec.md or task.md.
- External TDD, domain modeling, implement, Superpowers, or subagent skills may help when installed, but this generated guidance is sufficient to proceed without them.
