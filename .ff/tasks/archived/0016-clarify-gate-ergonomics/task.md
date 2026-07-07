# Task

## Implementation

- [x] **Slice 1 (Issue 1, TDD):** Add failing test in `tests/kernel.test.ts` — `spec.proposed` with missing identity triple → `validate-clarify --stage advance` issue names `attempt_id`/`proposal_id`/`proposal_hash` (not the generic "requires a current spec.proposed event" message).
- [x] Fix `findProposalEvent` (clarify-gate.ts:131-152): when no identity input filter is set, return the last `spec.proposed` candidate regardless of identity validity, so `identityFromEvent` failure at :66 emits the field-naming message. Keep identity-filter behavior when `--attempt-id`/`--proposal-id`/`--proposal-hash` are provided.
- [x] Add test: identity-filtered lookup still rejects non-matching proposals (no regression — covered by existing `--proposal-id other` test at kernel.test.ts:1268).
- [x] **Slice 2:** Export `latestProposalIdentity(events: TraceEvent[]): ClarifyGateIdentity | null` in clarify-gate.ts — wraps the fixed `findProposalEvent(events, {})` + `identityFromEvent`; returns null when latest `spec.proposed` is absent/malformed.
- [x] Add test: returns latest valid identity; returns null when latest `spec.proposed` lacks identity (exercised via accept-spec error path test).
- [x] **Slice 3 (propose-spec):** Add `case "propose-spec"` in cli.ts `runInternal` (mirror `append-trace` case): parse `--task`/`--spec-file`, read file, `proposalHash`+`proposalIdFromHash`+attemptId, `appendTrace` `brainstorm.done` + `spec.proposed` (identity data), print `{ok, identity}`. No spec.md write, no phase move.
- [x] Add test: `propose-spec --spec-file` appends both events with `proposal_hash = sha256(file)`; `validate-clarify --stage proposal` passes; spec.md unchanged.
- [x] **Slice 4 (accept-spec):** Add `case "accept-spec"` in cli.ts `runInternal`: parse flags; `readTraceEvents` + `latestProposalIdentity` → throw clear error if null; build advisor data; validate flag combos BEFORE trace read; `appendTrace` advisor event + `spec.accepted(explicit:true)`; print `{ok, identity}`.
- [x] Add tests: `accept-spec --verdict pass` → advance gate ok; `--advisor-unavailable` branch; no prior proposal → error; contradictory flags → error.
- [x] **Slice 5 (Issues 2+4 skill text):** Rewrite cw-clarify `commandSteps` (adapters.ts) — step 5 → `propose-spec --spec-file`; reword steps 9-11 → spec.md written at propose time, advisor, `accept-spec`, `validate-clarify --stage advance` before `set-state --phase plan`.
- [x] Add event-sequence + identity note to `commandGuidance` for cw-clarify; list `propose-spec`/`accept-spec` in the Helper Commands block + `printInternalUsage`.
- [x] Update skill-content tests in kernel.test.ts to expect the new steps + helper listings.
- [x] **Slice 6:** `npm run typecheck` + `npm test` + `npm run build` green; smoke-test `propose-spec`+`accept-spec` on a scratch task → `validate-clarify --stage advance` ok without manual hashing.

## Verification

- [x] `npm run typecheck` passes.
- [x] `npm test` passes (50/50, +3 new tests).
- [x] `npm run build` passes.
- [x] Scratch-task smoke: helpers produce a passing advance gate from a spec file, no manual field names/hashing.
- [x] Malformed `spec.proposed` error names the three identity fields.

## Check

- [x] All 9 spec acceptance criteria covered by implementation + tests.
- [x] No drift between spec/plan/task.
- [x] Dirty worktree: only `src/`, `tests/`, `dist/`, `.cw/tasks/0016-...` staged; `.opencode/` excluded.
- [x] Baseline Outcome recorded (candidate in baseline-delta.md: helper pattern for clarify gate identity — propose-spec/accept-spec + latestProposalIdentity export).

## Notes

- `cw` binary is a symlink to `dist/src/cli.js`; `dist/` rebuilt by `npm test`/`npm run build`.
- `findProposalEvent` refactored to take `Pick<ClarifyGateInput, 'attemptId'|'proposalId'|'proposalHash'>` (no stub/cast); `latestProposalIdentity` calls it with `{}`.
- Don't commit `.opencode/` (user instruction, session note #2).
- Dogfood: this task's own clarify gate was satisfied by hand-hashing (the pain this task removes); future tasks use `propose-spec`/`accept-spec`.
- AC7 reconciliation: code follows AC7 (concern/blocker without resolution flag fails early at the helper, 3-line check mirroring `concernHandled`/`blockerHandled`). spec.md Decisions "else defer to the gate" is read as applying only to shape issues AC7 does not enumerate; no spec.md change needed (accepted contract unchanged).
