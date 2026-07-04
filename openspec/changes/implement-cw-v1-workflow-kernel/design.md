## Context

CW is a TypeScript/Node.js workflow tool for coding harnesses. It does not replace coding harnesses and does not become a universal harness manager. The product center is task progress quality and context efficiency: a developer should be able to move a coding task from fuzzy request to finished work without losing task facts, drifting away from the spec, or rebuilding project context every session.

Current supporting material exists in:

- `DESIGN.md`: implementation-oriented system design.
- `CONTEXT.md`: project language.
- `docs/adr/`: accepted architecture decisions.
- `docs/prd/cw-version-1-workflow-kernel.md`: v1 PRD.
- `docs/issues/0001..0014`: tracer-bullet implementation slices.

OpenSpec should not replace those files retroactively. It should provide the active change surface that implementation agents can follow.

## Goals / Non-Goals

**Goals:**

- Encode CW v1 as OpenSpec proposal, capability specs, design, and tasks.
- Preserve the core v1 design: agent-native commands, thin CLI, Repo Truth, small task artifacts, Project Baseline, preflight, Closure Gate, baseline sync, resume, discard, doctor, understand, and adapter generation.
- Keep task artifacts small: `spec.md`, `plan.md`, `task.md`, optional `baseline-delta.md`, optional `resume.md`.
- Keep Git as the code-change source of truth.
- Provide implementation tasks that correspond to the 14 issue slices and can be worked independently in dependency order.

**Non-Goals:**

- Do not implement application code in this change creation step.
- Do not replace ADRs, `DESIGN.md`, or the PRD as historical records.
- Do not add model routing, token accounting, provider cost tracking, external-memory truth, or a code-change ledger.
- Do not require subagents, external code intelligence, external memory tools, or isolated worktrees for correctness.

## Decisions

### One umbrella change for CW v1

Use a single OpenSpec change, `implement-cw-v1-workflow-kernel`, with multiple capability specs and a task list derived from the 14 issue slices.

Alternative considered: create one OpenSpec change per issue. That would make dependency tracking noisy before the core capability boundaries are stable. The issue slices remain represented inside `tasks.md`; future work can split follow-up changes if a slice expands.

### Capability specs group behavior, not implementation modules

The specs are grouped around user-visible capabilities:

- repository setup
- task workflow
- project baseline
- harness invocation
- workflow health

Alternative considered: map each source file or module to a capability. That would produce horizontal implementation specs and would not match OpenSpec's requirement-oriented model.

### `cw-*` agent commands are the main invocation surface

Daily use happens through coding-harness-native agent commands. The public CLI remains setup and maintenance focused, while `cw internal ...` helpers perform deterministic state mutation.

Alternative considered: expose all workflow actions as public CLI commands first. That would make CW feel like a command-line task tracker rather than an agent-native workflow tool.

### Task truth stays small

Each task uses a machine-readable `task.json`, append-only `trace.jsonl`, and three core Markdown artifacts: `spec.md`, `plan.md`, and `task.md`. Optional `baseline-delta.md` and `resume.md` exist only when needed.

Alternative considered: separate context, design, verification, review, and finish Markdown files. That created too much ceremony for v1 and made finish depend on too many documents.

### Project Baseline updates are delayed until understand or finish

Active task phases can update task-local truth and optional baseline deltas. Project Baseline files update only through `cw-understand` drafts or finish-time baseline delta sync.

Alternative considered: promote baseline facts during clarify, plan, run, or check. That risks writing unverified or unstable task facts into repository-level knowledge.

### Git remains the code-change source of truth

CW inspects dirty worktree state during preflight and finish, but does not maintain touched-file lists, changeset attribution records, or a separate change inbox.

Alternative considered: a global change inbox. It added conceptual and maintenance overhead without solving spec drift better than check and Closure Gate behavior.

### Agent orchestration is an execution strategy layer

Inline execution must fully work. Subagent and hybrid execution can improve context efficiency where supported, but task correctness cannot depend on them.

Alternative considered: require role-specific subagents for every phase. That would make CW too harness-dependent and too heavy for small tasks.

## Risks / Trade-offs

- **Risk: One umbrella change becomes too large.** → Keep `tasks.md` grouped by issue slices and split follow-up changes only when a slice becomes independently larger than expected.
- **Risk: Baseline sync can feel like extra work.** → Make `baseline-delta.md` optional, preview changes at finish, and allow skip.
- **Risk: Agent-generated Markdown can drift in format.** → Helpers validate task state, trace events, and expected artifact presence; generated templates keep the Markdown shape stable.
- **Risk: Harness adapters diverge.** → Shared command semantics drive adapter generation; generated files point back to Repo Truth.
- **Risk: Users confuse blocked and parked tasks.** → Lifecycle semantics are simple and encoded in task state, doctor output, and generated command guidance.
- **Risk: OpenSpec artifacts duplicate existing PRD/ADR/DESIGN context.** → OpenSpec captures active implementation requirements, while ADRs and design remain historical and explanatory references.

## Migration Plan

1. Create this OpenSpec change with proposal, specs, design, and tasks.
2. Validate the OpenSpec change.
3. Implement tasks in dependency order, using the existing issue slices as the task grouping.
4. Keep existing tests passing and extend them through workflow/action and adapter seams.
5. When the v1 workflow is complete and validated, archive the OpenSpec change into main specs.

## Open Questions

- Whether future agent orchestration and ecosystem integration should become a separate OpenSpec change after v1 basics are stable.
- Isolated Git worktree handling is in v1 only for discard semantics after explicit confirmation. Broader isolated-worktree task execution can become a later change if needed.
- Which coding harness adapters beyond generic and Codex should be first-class in v1.
