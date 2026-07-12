---
name: ff-check
description: Run verification and review, reconcile drift, and update task.md before finish is allowed.
---

Use this skill for the `ff-check` Flowflow workflow action in this repository. Trigger it for `/ff-check`, `$ff-check`, `ff check`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-check

Run verification and review, reconcile drift, and update task.md before finish is allowed.

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
- Supply the checker with the relevant contract, diff, verification evidence, and bounded code context needed for a verdict.
- Do not issue a spec verdict from a diff summary alone. Review/check verdicts must compare the diff, task brief, accepted spec, acceptance criteria, and verification evidence.
- CI/CD or test-environment evidence states environment, action, and result without relying on commit identity.
- Small local defects may be fixed during check when the accepted spec.md contract is unchanged. Changes to spec.md or out-of-scope implementation behavior return to clarify for user confirmation.
- Check owns the final Baseline Outcome. Update baseline-delta.md for stable reusable facts, or record that there are no reusable project facts or that candidates are not stable yet.
- Use `ff-checker` to run verification, record evidence, and repair small in-scope defects when delegation is available.
- Use `ff-reviewer` for broad, behaviorally large, or workflow-semantics changes only when the harness, tools, and user or environment permission allow delegation; otherwise perform the same artifact and evidence review inline.
- Run a final broad review when the change is cross-cutting, behaviorally large, or touches workflow semantics shared by multiple commands.
