# Plan

## Approach

Use the same quality bar established by task 0006: generated CW skills are the product surface, `src/adapters.ts` is the primary source of truth for skill behavior, and implementation changes should stay narrow unless a behavior claim needs a deterministic gate.

Implement this in vertical slices:

1. Tighten generated skill guidance.
   - Replace `cw-clarify` strict/light labels with a single clarify quality gate and a fast path.
   - Add self-contained minimum behavior for grill, TDD, domain modeling, and subagent references so external skills remain optional.
   - Add `cw-plan` post-plan artifact cross-review guidance with subagent preference and inline fallback.
   - Add `cw-run`, `cw-check`, and `cw-finish` phase guidance for execution boundaries, evidence, closure, Git independence, and baseline merge responsibility.
   - Include `cw-check` rules for small local defect fixes, spec drift escalation, and final broad review when the change is cross-cutting or behaviorally large.

2. Remove generated marker noise from generated skill bodies while preserving stale detection.
   - Stop rendering `<!-- generated-by-cw:v1 -->` into skill instructional bodies.
   - Replace marker-based stale detection with a render-and-compare check against the current adapter output, or another non-instructional mechanism that does not appear in the generated skill body.
   - Update tests that currently expect marker-based freshness behavior.

3. Change baseline sync semantics from append-only to current-state application.
   - Keep `baseline-delta.md` as the candidate input.
   - Make finish-stage guidance assign merge preparation to the agent: read existing baseline files and delta, prepare a candidate diff, ask the user to accept/select/edit/skip.
   - Keep CLI helpers deterministic: they should apply confirmed current-state baseline content or record skip/selection decisions; they should not call an LLM.
   - Define the helper contract explicitly: a confirmed baseline merge payload is markdown sections keyed by `overview.md`, `architecture.md`, `rules.md`, and `commands.md`; each nonempty section contains the full desired current content for that project baseline file.
   - Apply accepted, selected, and edited decisions by writing confirmed current-state content for the applicable files. `skipped` records no project baseline changes.
   - Require confirmed current-state content for non-skipped baseline sync decisions so helpers do not fall back to silent append behavior.

4. Update generated skills and tests.
   - Regenerate Codex skills with `cw update --harness codex` after adapter changes.
   - Add or update focused tests for generated guidance, stale detection without body markers, current-state baseline sync, and workflow closure behavior.

5. Run the full validation set.
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `node dist/src/cli.js validate --root .`

## Key Decisions

- Keep `spec.md` unchanged during planning and implementation unless a future check finds confirmed spec drift.
- Keep generated CW skills self-contained. External skills and plugins may improve execution when present, but generated guidance must work without them.
- Use observable clarify rules rather than strict/light mode labels.
- Prefer an independent reviewer subagent for nontrivial post-plan artifact cross-review, with inline fallback when subagents are unavailable.
- Treat behavior changes as requiring test evidence by default; red-green TDD is preferred only when a clear test seam exists.
- Keep check evidence in `task.md` Verification or Check entries rather than adding a new report artifact.
- Keep `cw-finish` separate from Git commit, push, PR, branch cleanup, deployment, and commit ledger concerns.
- Treat Project Baseline files as current-state descriptions. Baseline merge intelligence belongs to the finish-stage agent; deterministic helpers apply accepted content.
- Remove machine-oriented generated metadata from generated skill bodies.

## Risks

- Generated skill text can sprawl. Keep phase guidance compact and use leading words only where they change behavior.
- Render-and-compare stale detection can be brittle if formatting is not deterministic. Reuse the existing adapter renderer rather than duplicating expected text.
- Baseline sync behavior change may affect existing tests that assume append-only `## From <task-id>` sections. Update tests around product intent, not just string format.
- Current-state baseline application needs careful CLI/API shape. Avoid a large patch engine; use explicit confirmed markdown sections as the helper input and keep accepted, selected, edited, and skipped behavior easy to test.
- The worktree already contains a user feedback change in `.agents/skills/cw-check/SKILL.md` that removes the generated marker. Preserve that intent and do not revert it.

## Validation Strategy

- Generated skill text tests assert stable behavioral phrases for:
  - `cw-clarify` quality gate, fast path, and expand-then-grill fallback.
  - self-contained external practice references.
  - `cw-plan` artifact cross-review and reviewer-subagent preference with inline fallback.
  - `cw-run` task-contract execution, drift stop conditions, and behavior-change test evidence.
  - `cw-check` artifact alignment, evidence mapping, CI/CD evidence shape, small local defect fixes, spec drift escalation, final broad review, and drift handling.
  - `cw-finish` closure packet, Git independence, baseline candidate diff, and deterministic helper boundary.
- Validation/doctor tests cover stale generated skills without requiring a `generated-by-cw` body marker.
- Baseline tests cover accepted, selected, edited, and skipped decisions under current-state semantics, including full-file current content application and avoiding silent stale append accumulation.
- Workflow tests cover finish baseline decision requirements and high-impact confirmation under the revised baseline guidance.
- Run `npm run typecheck`, `npm test`, `npm run build`, and `node dist/src/cli.js validate --root .`.
