---
name: ff-clarify
description: Review fuzzy intent, produce a user-confirmed Proposed Spec, then update spec.md with the accepted task contract.
---

Use this skill for the `ff-clarify` Flowflow workflow action in this repository. Trigger it for `/ff-clarify`, `$ff-clarify`, `ff clarify`, or natural-language requests for the same workflow action.

Before acting, read the repository's `.ff` files relevant to the current task. Treat `.ff` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

# ff-clarify

Review fuzzy intent, produce a user-confirmed Proposed Spec, then update spec.md with the accepted task contract.

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

## Workflow Steps

1. Run `ff preflight --action clarify --task <task-id>` when a task id is known.
2. Read the current spec.md and relevant project baseline files.
3. Run the Brainstorm Pass described below before drafting Proposed Spec.
4. Run the Grill Loop described below until Open Decisions and high-risk assumptions are resolved or explicitly accepted.
5. Present a Proposed Spec, write its content to spec.md, then record it with `ff internal propose-spec --task <task-id> --spec-file <path>` (hashes the file, appends `brainstorm.done` + `spec.proposed` with identity, returns the identity). The `proposal_hash` binds the spec.md content.
6. Call the `ff-advisor` role when available to review the current Proposed Spec before asking the user to accept it.
7. If advisor is unavailable, record `advisor.unavailable` with attempted invocation, harness, failure reason, timestamp, and fallback checklist result, then perform the same checklist inline as degraded execution.
8. Resolve, defer with rationale, or get explicit user risk acceptance for each concern. Fix blockers and re-review, or record explicit user override.
9. Wait for explicit user accept before recording `spec.accepted`.
10. After accept, run `ff internal accept-spec --task <task-id> --verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override]`. If advisor was unavailable, omit `--verdict` and run `ff internal accept-spec --task <task-id> --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>`. It auto-binds the latest proposal identity and appends `advisor.reviewed`|`advisor.unavailable` + `spec.accepted(explicit:true)`. Then run `ff internal validate-clarify --task <task-id> --stage advance` before moving to plan.
11. spec.md is written at propose time and bound by `proposal_hash`; do not edit it between propose and accept. The clarify gate validates trace events, not the spec.md file directly.
12. Capture confirmed long-term project facts as task-local baseline candidates; do not update Project Baseline files during clarify.
13. Run `ff internal set-state --task <task-id> --phase plan --next-action <text>` when the spec is accepted.
14. If required information is missing, run `ff internal set-state --task <task-id> --lifecycle blocked --phase clarify --blocked-reason <reason> --next-action <text>`.

## Phase Guidance

- Clarify uses one fixed sequence for all tasks: Brainstorm Pass -> Grill Loop -> Proposed Spec (write spec.md + `propose-spec`) -> advisor review of the current Proposed Spec -> concern/blocker handling -> explicit accept (`accept-spec`) -> `validate-clarify --stage advance` -> move to plan. The required trace events (`brainstorm.done`, `spec.proposed`, `advisor.reviewed`|`advisor.unavailable`, `spec.accepted`) share one identity triple (`attempt_id`, `proposal_id`, `proposal_hash` where `proposal_hash = sha256(spec content)`); `propose-spec` and `accept-spec` compute and thread this identity so the agent never hand-hashes or hand-threads field names.
- Brainstorm Pass must restate the goal and motivation, offer at most three directions, recommend the smallest path, list assumptions, risks, acceptance evidence, and produce Open Decisions.
- Grill Loop asks one concrete question at a time for Open Decisions and high-risk assumptions. Include your recommended answer and the trade-off so the user can make a concrete decision.
- Use the full Grill Loop when the request is broad, ambiguous, high risk, or affects workflow semantics, CLI/API behavior, task lifecycle, state machines, cross-module behavior, irreversible work, or baseline promotion.
- Clarification is complete only when the goal, boundary, acceptance criteria, key risks, and important trade-offs are clear enough to write spec.md without high-risk assumptions.
- Before asking for acceptance, present a Proposed Spec using the existing sections: Goal, Scope, Non-goals, Constraints, Decisions, and Acceptance Criteria. Continue asking if any high-risk assumption remains.
- Advisor review must target the current Proposed Spec identity. Old advisor review cannot be reused for a new proposal.
- Advisor unavailable is degraded execution. Record the attempted invocation, harness, failure reason, timestamp, and fallback checklist result before continuing inline.
- Concern handling must be explicit: resolve it, defer it with rationale, or get user risk acceptance. Blocker handling requires a revised review or explicit user override.
- Do not create clarify.md. spec.md is the only long-lived clarify artifact.
- Clarify terminology lightly. Task-local terms belong in spec.md; stable reusable project concepts may become baseline-delta.md candidates.
- Project Baseline files are not updated during clarify. Confirmed long-term facts should be captured as task-local candidates for later Baseline Outcome handling.
- For generated workflow guidance changes, challenge likely agent behavior directly: would this wording let an agent skip challenge, skip grill, move to plan/run too early, misuse subagents, or accept vague evidence?

## Clarify Protocol

### Brainstorm Pass

- Purpose: clarify the user's desired outcome before drafting a Proposed Spec. Restate the goal and motivation in concrete terms.
- Required output: present at most three viable directions, recommend the smallest sufficient path, and list assumptions, risks, and acceptance evidence for that path.
- Open Decisions: produce a short list of unresolved product, workflow, risk, or evidence decisions that would materially change the task contract.
- Do not write spec.md during Brainstorm Pass. Move forward only to the Grill Loop or, when no Open Decisions or high-risk assumptions remain, to Proposed Spec.

### Grill Loop

- Input: use the Brainstorm Pass Open Decisions and any high-risk assumptions found in the request, baseline, or current task artifacts.
- Ask one concrete question at a time. Include your recommended answer and the trade-off so the user can choose or correct the path.
- Escalate to the full loop for broad, ambiguous, high-risk, irreversible, workflow-semantics, CLI/API, task-lifecycle, state-machine, cross-module, or baseline-promotion decisions.
- Stop only when the goal, boundary, acceptance criteria, key risks, and important trade-offs are clear enough to write spec.md without high-risk assumptions, or when the user explicitly accepts the remaining risk.
- Keep Brainstorm Pass and Grill Loop inside this ff-clarify guidance; do not rely on another skill or cross-skill lookup for these protocol stages.


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
