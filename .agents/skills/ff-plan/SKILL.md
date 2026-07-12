---
name: ff-plan
description: Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.
---

Use this skill for the `ff-plan` Flowflow workflow action in this repository. Trigger it for `/ff-plan`, `$ff-plan`, `ff plan`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-plan

Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.

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
- Treat accepted spec.md as the only product contract. Existing plan.md and task.md are historical working artifacts; when they conflict with the accepted spec, replace the stale content instead of preserving or partially patching its constraints.
- Order prerequisites before the gates that validate them. A preflight, review, or verification step must run against the final implementation it claims to check, and later changes invalidate that evidence.
- Preserve user-owned configuration and unrelated dirty-worktree changes. Planning may classify them, but must not absorb or overwrite them unless the accepted spec explicitly includes them.
- Capture stable design, workflow, command, or rule candidates when they are reusable project facts; keep one-off implementation steps out of baseline candidates.
- Break task.md implementation items into small, verifiable vertical slices. Keep file-level edits as implementation details, not primary checklist items.
- Match the user's language in user-visible planning text. If the accepted spec or user request is Chinese, write plan summaries, task items, risks, and evidence notes in Chinese except commands, file paths, API names, code identifiers, and product names.
- Write plan.md and task.md as executable actions, concrete trade-offs, and verification evidence. Say what will change, why it stays inside the accepted spec, and how check can prove it.
- For each accepted acceptance criterion, plan.md or task.md must name the concrete action, target artifact or behavior, expected observable result, and verification evidence. Avoid checklist items that are only topic labels such as `update guidance`, `improve tests`, or `review behavior` unless they state the exact changed surface and proof.
- Key Decisions must record the chosen approach and the reason it stays within scope. Risks must name the failure mode and the check that would reveal it.
- Avoid abstract labels, jargon stacks, grand claims, unexplained internal terms, formulaic three-part lists, binary contrast formulas, empty positive endings, overused discourse markers, passive or actorless claims, and acceptance criteria without evidence.
- Post-plan artifact cross-review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work. Use `ff-reviewer` only when the harness, tools, and user or environment permission allow delegation; otherwise run the same check inline.
- For generated workflow guidance changes, task.md Check must include behavior probes in addition to string assertions: at least one `ff-clarify` sample request and one `ff-plan` accepted-spec scenario, each with expected failure mode, desired behavior, reviewer verdict, and remaining risk. Use `ff-reviewer` or `ff-advisor` when delegation is available; otherwise record degraded inline review.
- Keep deterministic tests separate from behavior review.
