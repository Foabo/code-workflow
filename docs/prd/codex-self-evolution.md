# PRD: Codex Adapter And CW Self-Evolution

## Problem Statement

CW currently has a workflow kernel and generic command templates, but Codex users do not yet get a native project-local invocation surface. The project also has not proven that CW can guide its own development inside this repository using Repo Truth, task artifacts, preflight, verification, finish, and baseline promotion.

## Solution

Add a Codex harness adapter that generates project-local Codex prompt entries for every `cw-*` workflow action. Use this repository as the first self-evolution case: initialize CW in the repo, create a task for Codex adaptation, carry the task through CW artifacts, implement the adapter, verify it, and finish the task with trace evidence.

## User Stories

1. As a Codex user, I want `cw init --harness codex` to generate Codex prompt entries, so that I can invoke CW actions from Codex.
2. As a Codex user, I want generated prompts for `cw-work`, so that I can start or continue task progress from Codex.
3. As a Codex user, I want generated prompts for `cw-clarify`, so that Codex can help turn unclear requests into an accepted task spec.
4. As a Codex user, I want generated prompts for `cw-plan`, so that Codex can produce plan and checklist artifacts before implementation.
5. As a Codex user, I want generated prompts for `cw-run`, so that Codex can execute task checklist items while respecting CW state.
6. As a Codex user, I want generated prompts for `cw-check`, so that Codex verifies and reviews work before finish.
7. As a Codex user, I want generated prompts for `cw-finish`, so that Codex closes tasks through the Closure Gate.
8. As a Codex user, I want generated prompts for `cw-resume`, so that Codex can consume a user-triggered resume note.
9. As a Codex user, I want generated prompts for `cw-discard`, so that Codex can abandon work only after explicit worktree handling.
10. As a Codex user, I want generated prompts for `cw-doctor`, so that Codex can inspect workflow health.
11. As a Codex user, I want generated prompts for `cw-understand`, so that Codex can draft Project Baseline updates for an existing repository.
12. As a project maintainer, I want Codex prompts stored in the repository, so that workflow behavior follows the project instead of a single global Codex installation.
13. As a project maintainer, I want Codex prompts to point back to `.cw` Repo Truth, so that generated prompt files do not become canonical workflow state.
14. As a project maintainer, I want the Codex adapter to coexist with the generic adapter, so that other coding harnesses are not affected.
15. As a project maintainer, I want `cw update --harness codex` to refresh generated Codex prompts, so that prompt changes can be regenerated safely.
16. As a CW developer, I want CW to initialize itself in this repository, so that the implementation can prove the workflow works on its own codebase.
17. As a CW developer, I want the Codex adapter work captured in `spec.md`, `plan.md`, `task.md`, and `trace.jsonl`, so that the work is recoverable across sessions.
18. As a CW developer, I want preflight to support self-evolution tasks, so that creating a new task does not produce misleading failure state.
19. As a CW developer, I want tests for Codex prompt generation at the adapter seam, so that generated files are verified by observable behavior.
20. As a CW developer, I want an end-to-end self-evolution test path, so that CW is tested as a workflow tool instead of isolated helper functions only.
21. As a future adapter author, I want adapter rendering to share workflow content, so that harness-specific surfaces do not drift from CW command semantics.
22. As a user evaluating CW, I want concrete self-generated artifacts in the repository, so that claims about CW being usable can be inspected.

## Implementation Decisions

- Add `codex` as a supported harness name alongside `generic`.
- The Codex adapter generates project-local prompt files using Codex prompt frontmatter with a description and argument hint.
- Codex prompt files live under a repository-owned Codex prompt directory, while `.cw` remains Repo Truth.
- The generic command rendering remains available and is reused as the semantic source for Codex prompt content.
- `cw init` and `cw update` accept `codex` as a harness choice.
- Self-evolution is represented by a normal CW task in this repository, using the same task state record, task artifacts, trace events, and finish path as other work.
- The task creation flow should treat a missing named task as an expected creation path for `cw-work`.
- No external memory, global Codex state, model routing, or provider configuration becomes required for correctness.

## Testing Decisions

- Test at the adapter generation seam by running `initProject` with the Codex harness and asserting generated Codex prompt files exist with Codex frontmatter.
- Test at the update seam by running `updateProject` with the Codex harness and asserting regenerated prompts remain valid.
- Test at the workflow seam by using this repository's own `.cw` task artifacts and checking `cw validate`, typecheck, build, and tests.
- Existing Node test coverage remains the highest automated seam for kernel behavior.
- Smoke tests should exercise actual command-line behavior where possible, because Codex uses generated prompt files to guide command execution.

## Out of Scope

- Global installation into `~/.codex`.
- Codex plugin packaging.
- Model routing or provider configuration.
- Full marketplace distribution.
- Automatic issue tracker publishing, because this repository currently has no configured remote issue tracker.

## Further Notes

The Codex adapter should be treated as the first real harness adapter. The self-evolution task should remain inspectable in `.cw/tasks/` so future work can see how CW was used to extend itself.
