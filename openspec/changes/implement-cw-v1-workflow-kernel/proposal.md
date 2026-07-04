## Why

Developers using coding harnesses lose task state across sessions, repeat context-building work, and can finish tasks after code drift without a current task contract, checklist, verification, or reusable project knowledge update. CW needs a version 1 workflow kernel that turns the existing PRD, ADRs, design document, and issue slices into a coherent OpenSpec change that can be implemented and validated end to end.

## What Changes

- Add repository-local CW initialization with sparse Project Baseline templates, task templates, version state, validation, doctor support, and skippable enhancement prompts.
- Add agent-native `cw-*` workflow commands backed by deterministic kernel helpers.
- Add task workflow support for creating, clarifying, planning, running, checking, finishing, resuming, and discarding tasks.
- Add finish-time Closure Gate behavior, dirty worktree handling, and baseline delta sync.
- Add draft-first existing-repository understanding.
- Add generated coding-harness entries that treat `.cw` as Repo Truth.
- Add inline, subagent, and hybrid execution strategy guidance without requiring subagent support.
- Keep Git as the source of truth for code changes; do not add a change ledger, touched-file ledger, token ledger, or model router.

## Capabilities

### New Capabilities

- `repository-setup`: Repository initialization, validation, project baseline templates, task templates, and enhancement setup.
- `task-workflow`: Task lifecycle, task artifacts, workflow commands, preflight, Closure Gate, resume, discard, and trace behavior.
- `project-baseline`: Project Baseline files, understand drafts, baseline delta creation, and finish-time baseline sync.
- `harness-invocation`: Generated `cw-*` command entries, public CLI boundaries, internal helpers, and harness-native adapters.
- `workflow-health`: Doctor checks, dirty worktree handling, execution strategy guidance, and optional enhancement awareness.

### Modified Capabilities

- None. There are no archived OpenSpec capabilities in this repository yet.

## Impact

- TypeScript workflow kernel modules for initialization, task state, workflow actions, validation, preflight, baseline handling, Git inspection, adapters, CLI, and update flows.
- Repository-local `.cw` file layout and generated harness command files.
- Existing tests should be extended at the workflow/action seam and adapter generation seam.
- OpenSpec artifacts become the planning surface for the broader CW v1 implementation, while `DESIGN.md`, ADRs, PRD, and issue drafts remain supporting context.
