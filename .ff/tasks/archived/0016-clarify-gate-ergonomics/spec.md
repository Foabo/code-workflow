# Spec

## Goal

Make `cw-clarify` satisfiable from the generated skill text alone: an agent following the skill can pass the clarify gate without reading `clarify-gate.ts` source. Eliminate the silent-filter bug where malformed `spec.proposed` events are dropped without naming the missing identity fields, and add high-level helpers so agents never manually compute `proposal_hash`/`proposal_id` or thread snake_case identity field names.

## Scope

- **Issue 1 (error path):** In `src/clarify-gate.ts`, stop `findProposalEvent` from silently dropping `spec.proposed` events that lack the identity triple. A partial or misnamed identity must surface the field-naming message (`attempt_id`, `proposal_id`, `proposal_hash`) instead of the generic "requires a current spec.proposed event" message.
- **Issue 3 (helpers):** Add two `cw internal` subcommands in `src/cli.ts` that reuse exported primitives (`proposalHash`, `proposalIdFromHash`, `appendTrace`, `readTraceEvents`, `validateClarifyGate`):
  - `cw internal propose-spec --task <id> --spec-file <path>` — reads the file, hashes it, computes `proposal_id`/`attempt_id`, appends `brainstorm.done` + `spec.proposed` (with identity data), returns the identity. Does not write spec.md, does not move phase.
  - `cw internal accept-spec --task <id> --verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | [--advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>]` — resolves the identity from the latest `spec.proposed` event via the exported `latestProposalIdentity(events)` primitive (auto-lookup, no id args), appends `advisor.reviewed` (or `advisor.unavailable` when advisor-fallback flags are given) + `spec.accepted` (`explicit:true`), returns the identity. Does not move phase.
- **Issue 2 + 4 (skill text):** Update `src/adapters.ts` `commandSteps`/`commandGuidance` for `cw-clarify` to: document the required event sequence (`brainstorm.done` -> `spec.proposed` -> `advisor.reviewed`|`advisor.unavailable` -> `spec.accepted`), point to the `propose-spec`/`accept-spec` helpers, and reword steps 10 AND 11 together so they reflect the real order: write spec content -> `propose-spec --spec-file` (hashes + records `brainstorm.done`+`spec.proposed`; spec.md is now the proposed content, bound by hash) -> advisor review (call `cw-advisor`, or record `advisor.unavailable` fallback) -> `accept-spec` (records `advisor.reviewed`|`advisor.unavailable` + `spec.accepted`) -> `validate-clarify --stage advance` -> `set-state --phase plan`. Step 10 becomes "validate before `set-state --phase plan`"; step 11 becomes "spec.md is written at propose time and bound by `proposal_hash`; do not edit it between propose and accept."

## Non-goals

- Do NOT simplify the identity triple to hash-only (drop `proposal_id`/`attempt_id`). That is a gate-semantics + baseline (`rules.md:27`) change, deferred to a separate task.
- Do NOT add `validate-clarify --spec-file` content re-check (issue 4 stronger binding). Document-only.
- Do NOT touch issue 5 (`--help` short-circuit, `create-task` id auto-suggest, dirty-worktree noise).
- Do NOT change `runClarify`'s templated propose/accept flow or refactor it to share code with the new helpers (keep helpers thin; avoid a second phase-movement source).
- Do NOT change the gate's binding semantics, the watchdog behavior, or role-agent generation.

## Constraints

- Repo rules (`.cw/project/rules.md:24`): do not edit generated SKILL.md directly; update `adapters.ts` rendering and regenerate.
- Tests: `tests/kernel.test.ts`, Node `node --test` runner. `npm run build && node --test dist/tests/*.test.js`.
- CLI dispatch is a `switch` in `runInternal` (cli.ts:179-326); new subcommands slot in as cases.
- Helpers must reuse exported `proposalHash`/`proposalIdFromHash`/`appendTrace`/`readTraceEvents`/`validateClarifyGate` — no re-implementation of hashing or gate logic. Add one new export to `clarify-gate.ts`: `latestProposalIdentity(events: TraceEvent[]): ClarifyGateIdentity | null` (thin wrapper over the module-private `findProposalEvent` + `identityFromEvent`, returning the identity of the latest `spec.proposed` event, or null when absent/malformed) so `accept-spec` does not duplicate gate lookup logic.
- `accept-spec` auto-lookup: identity comes from the latest `spec.proposed` event (the gate's `findProposalEvent` semantics). It MUST fail with a clear error if the latest `spec.proposed` lacks a valid identity; it must NOT fall back to an earlier proposal (would misbind accept to stale content). When advisor fallback is recorded, emit `advisor.unavailable` with `attempted:true`/`harness`/`failure_reason`/`fallback_checklist_result` instead of `advisor.reviewed`.
- Skill rewording must not let an agent skip brainstorm, grill, advisor review, or explicit accept.
- `accept-spec` encapsulates identity threading only; it records the *resolved* advisor outcome, not the review itself. The gate validates structure (verdict + resolution flags), not provenance — same limitation as `runClarify`. The skill text must mandate that the agent actually calls `cw-advisor` (or records the `advisor.unavailable` fallback) before `accept-spec`; the helper is not a self-certification path.
- The agent flow (write spec.md early at propose time, bound by hash) and the kernel flow (`runClarify` writes spec.md late at accept) are distinct paths and must not be interleaved within a single proposal cycle.

## Decisions

- **Scope B** (issues 1 + 3, docs 2 + 4), per user. Issue 5 deferred.
- **accept-spec identity = auto-lookup latest spec.proposed** (no id args), per user. Reduces leaky field names; well-defined for multi-proposal traces (binds latest).
- **Issue 4 = document-only.** `propose-spec --spec-file` hashes the file at propose time; skill step 10 reworded to "validate before `set-state --phase plan`." No validate-side `--spec-file` re-check. The hash binds content; agent trusted not to edit spec.md between propose and accept.
- **Triple simplification deferred.** `proposal_hash` is earned (content binding); `proposal_id`/`attempt_id` are redundant/marginal, but removing them is a gate-semantics + baseline change, out of scope. Captured as a follow-up candidate.
- **Helpers stay thin.** No phase transitions (skill's `set-state` owns phase), no spec rendering. Avoids dual source-of-truth with `runClarify`. Invalid flag combinations fail at the helper (early) where cheap to detect (no prior proposal, mutually-exclusive branches), else defer to the gate.

## Acceptance Criteria

- [x] A `spec.proposed` event missing the identity triple, validated with `cw internal validate-clarify --task <id> --stage advance`, produces an issue naming `attempt_id`, `proposal_id`, and `proposal_hash` (not the generic "requires a current spec.proposed event" message). [Issue 1]
- [x] `cw internal propose-spec --task <id> --spec-file <path>` appends `brainstorm.done` + `spec.proposed` with a correct identity triple (`proposal_hash = sha256(file)`), returns the identity, and does not write spec.md or move phase. [Issue 3]
- [x] `cw internal accept-spec --task <id> --verdict pass` (after a proposal) appends `advisor.reviewed` + `spec.accepted(explicit:true)` bound to the latest proposal's identity, with no id args passed. [Issue 3]
- [x] `accept-spec` with advisor-fallback flags emits `advisor.unavailable` with `attempted:true`/`harness`/`failure_reason`/`fallback_checklist_result`. [Issue 3]
- [x] `accept-spec` against a trace whose latest `spec.proposed` lacks a valid identity fails with a clear error rather than misbinding to an earlier proposal. [Issue 1+3 interaction]
- [x] After `propose-spec` + `accept-spec`, `cw internal validate-clarify --task <id> --stage advance` returns `ok:true` — the helpers produce a passing gate from a spec file. [Issues 1+3+4]
- [x] `accept-spec` with no prior `spec.proposed` event in the trace fails with a clear error. `accept-spec` with contradictory flags (e.g. `--verdict pass --advisor-unavailable`, or `--verdict concern` with no resolution flag) fails early rather than emitting a malformed event. [Issue 3]
- [x] The generated `cw-clarify` SKILL.md documents the event sequence and points to `propose-spec`/`accept-spec`; step 10 says validate runs before `set-state --phase plan`, not before writing spec.md. [Issues 2+4]
- [x] `npm run typecheck`, `npm test`, and `npm run build` pass. Existing clarify-gate tests remain green.
