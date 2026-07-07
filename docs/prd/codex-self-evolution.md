# PRD: Codex Adapter And Flowflow Self-Evolution

## Problem Statement

Flowflow currently has a workflow kernel and generic command templates, but Codex users do not yet get a native project-local invocation surface. The project also has not proven that Flowflow can guide its own development inside this repository using Repo Truth, task artifacts, preflight, verification, finish, and baseline promotion.

## Solution

Add a Codex harness adapter that generates repository-local Codex plugin skills for every `ff-*` workflow action. Use this repository as the first self-evolution case: initialize Flowflow in the repo, create a task for Codex adaptation, carry the task through Flowflow artifacts, implement the adapter, verify it, and finish the task with trace evidence.

## User Stories

1. As a Codex user, I want `ff init --harness codex` to generate Codex plugin skill entries, so that I can invoke Flowflow actions from Codex.
2. As a Codex user, I want generated skills for `ff-work`, so that I can start or continue task progress from Codex.
3. As a Codex user, I want generated skills for `ff-clarify`, so that Codex can help turn unclear requests into an accepted task spec.
4. As a Codex user, I want generated skills for `ff-plan`, so that Codex can produce plan and checklist artifacts before implementation.
5. As a Codex user, I want generated skills for `ff-run`, so that Codex can execute task checklist items while respecting Flowflow state.
6. As a Codex user, I want generated skills for `ff-check`, so that Codex verifies and reviews work before finish.
7. As a Codex user, I want generated skills for `ff-finish`, so that Codex closes tasks through the Closure Gate.
8. As a Codex user, I want generated skills for `ff-resume`, so that Codex can consume a user-triggered resume note.
9. As a Codex user, I want generated skills for `ff-discard`, so that Codex can abandon work only after explicit worktree handling.
10. As a Codex user, I want generated skills for `ff-doctor`, so that Codex can inspect workflow health.
11. As a Codex user, I want generated skills for `ff-understand`, so that Codex can draft Project Baseline updates for an existing repository.
12. As a project maintainer, I want Codex plugin skills stored in the repository, so that workflow behavior follows the project instead of a single global Codex installation.
13. As a project maintainer, I want Codex plugin skills to point back to `.ff` Repo Truth, so that generated skill files do not become canonical workflow state.
14. As a project maintainer, I want the Codex adapter to coexist with the generic adapter, so that other coding harnesses are not affected.
15. As a project maintainer, I want `ff update --harness codex` to refresh generated Codex plugin skills, so that plugin skill changes can be regenerated safely.
16. As a Flowflow developer, I want Flowflow to initialize itself in this repository, so that the implementation can prove the workflow works on its own codebase.
17. As a Flowflow developer, I want the Codex adapter work captured in `spec.md`, `plan.md`, `task.md`, and `trace.jsonl`, so that the work is recoverable across sessions.
18. As a Flowflow developer, I want preflight to support self-evolution tasks, so that creating a new task does not produce misleading failure state.
19. As a Flowflow developer, I want tests for Codex plugin skill generation at the adapter seam, so that generated files are verified by observable behavior.
20. As a Flowflow developer, I want an end-to-end self-evolution test path, so that Flowflow is tested as a workflow tool instead of isolated helper functions only.
21. As a future adapter author, I want adapter rendering to share workflow content, so that harness-specific surfaces do not drift from Flowflow command semantics.
22. As a user evaluating Flowflow, I want concrete self-generated artifacts in the repository, so that claims about Flowflow being usable can be inspected.

## Implementation Decisions

- Add `codex` as a supported harness name alongside `generic`.
- The Codex adapter generates a repository-local marketplace plugin with one skill per `ff-*` workflow action.
- Codex plugin skill files live under the repository plugin folder, while `.ff` remains Repo Truth.
- The generic command rendering remains available and is reused as the semantic source for Codex skill content.
- `ff init` and `ff update` accept `codex` as a harness choice.
- Self-evolution is represented by a normal Flowflow task in this repository, using the same task state record, task artifacts, trace events, and finish path as other work.
- The task creation flow should treat a missing named task as an expected creation path for `ff-work`.
- No external memory, global Codex state, model routing, or provider configuration becomes required for correctness.

## Testing Decisions

- Test at the adapter generation seam by running `initProject` with the Codex harness and asserting generated Codex marketplace, plugin manifest, and skill files exist with valid skill frontmatter.
- Test at the update seam by running `updateProject` with the Codex harness and asserting regenerated skills remain valid.
- Test at the workflow seam by using this repository's own `.ff` task artifacts and checking `ff validate`, typecheck, build, and tests.
- Existing Node test coverage remains the highest automated seam for kernel behavior.
- Smoke tests should exercise actual command-line behavior where possible, because Codex uses generated skill files to guide command execution.

## Out of Scope

- Global installation into `~/.codex`.
- Global Codex prompt installation.
- Model routing or provider configuration.
- Full marketplace distribution.
- Automatic issue tracker publishing, because this repository currently has no configured remote issue tracker.

## Further Notes

The Codex adapter should be treated as the first real harness adapter. The self-evolution task should remain inspectable in `.ff/tasks/` so future work can see how Flowflow was used to extend itself.
