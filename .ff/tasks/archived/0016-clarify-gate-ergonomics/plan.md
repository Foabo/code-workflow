# Plan

## Approach

Six vertical slices, each independently verifiable. Slice 1 first (TDD the error path) because the new `latestProposalIdentity` export depends on the `findProposalEvent` fix. Then the two CLI helpers reusing exported primitives. Then the skill-text rewrite (issues 2+4). Build + full suite last.

1. **Issue 1** — fix `findProposalEvent` silent-filter (clarify-gate.ts:131-152) so a malformed `spec.proposed` surfaces the field-naming message (:66) instead of being dropped. TDD.
2. **New export `latestProposalIdentity(events)`** in clarify-gate.ts — thin wrapper over the fixed `findProposalEvent` + `identityFromEvent`; returns the latest proposal identity or null when absent/malformed.
3. **`cw internal propose-spec --task --spec-file`** — cli.ts `runInternal` case (mirror `append-trace` case 199-210): hash file, compute ids, append `brainstorm.done` + `spec.proposed`, return identity. No spec.md write, no phase move.
4. **`cw internal accept-spec --task --verdict ...`** — cli.ts `runInternal` case: `latestProposalIdentity` auto-lookup (throw on null, no fallback), append `advisor.reviewed`|`advisor.unavailable` + `spec.accepted(explicit:true)`, flag-combo validation.
5. **Issues 2+4 skill text** — rewrite cw-clarify `commandSteps` (adapters.ts:52-67) + add sequence/identity note to guidance; add the two subcommands to the Helper Commands renderer + `printInternalUsage`.
6. **Build + full suite + smoke-test** the new CLI against a scratch task.

## Key Decisions

- Slice order 1 → 2: `latestProposalIdentity` relies on the `findProposalEvent` fix returning malformed candidates (so it can return null rather than skipping them).
- `propose-spec` generates `attemptId` in the same format as `clarifyProposalIdentity` (`a-<Date.now().toString(36)>-<hash.slice(0,8)>`) for consistency with `runClarify`.
- `accept-spec` resolves identity via `latestProposalIdentity(events)`; throws on null (no fallback to earlier proposal). `--advisor-unavailable` is mutually exclusive with `--verdict`; `--verdict concern` without a resolution flag defers to the gate (helper stays thin per spec).
- Skill rewrite touches `commandSteps` (steps 5, 9-11) and adds a sequence/identity note in `commandGuidance` or `commandProtocolSections`; adds the two subcommands to the Helper Commands rendering and `printInternalUsage` (cli.ts:952).
- No refactor of `runClarify`; helpers stay thin (no phase transitions, no spec rendering).

## Risks

- `findProposalEvent` signature takes `ClarifyGateInput`; the fix must keep identity-filter behavior when `--attempt-id`/`--proposal-id`/`--proposal-hash` are passed (validate-clarify uses these), relaxing only the no-filter case. Test both paths.
- Skill-text tests assert the old sequence at kernel.test.ts:203-208 (`assertInOrder` with 'write spec.md' as last item); slice 5 must update both `commandSteps` and this assertion (write spec.md moves up to propose time).
- `printInternalUsage` and the Helper Commands renderer must both list the new subcommands or agents won't discover them.
- Don't commit `.opencode/` (user instruction); commit only `src/`, `tests/`, `dist/`, `.cw/tasks/0016-...`.

## Validation Strategy

- TDD slice 1 (failing test first). Each slice: `npm run build && node --test dist/tests/kernel.test.js`.
- Slices 3-4: smoke-test against a scratch `.cw` task dir — `propose-spec` + `accept-spec` → `validate-clarify --stage advance` ok:true from a spec file, no manual hashing.
- Gate: `npm run typecheck`, `npm test`, `npm run build` all green; existing clarify-gate tests unchanged in intent.
- Regenerate the consumer skill (`cw update --harness opencode`) and confirm the new steps/commands appear.
