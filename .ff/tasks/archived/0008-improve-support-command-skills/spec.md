# Spec

## Goal
Improve the generated CW support-command skills for `cw-understand`, `cw-doctor`, and `cw-resume` so agents execute them with the same predictable boundaries added recently for the core implementation workflow commands.

## Scope
- Add focused Phase Guidance for `cw-understand`, `cw-doctor`, and `cw-resume` in the adapter source that generates harness skills.
- Regenerate the Codex repo-local skills from the adapter source.
- Align the executable `resume` workflow action with the resume-note contract: load the note and task context for intentional continuation, then have the workflow kernel automatically consume the note after the first later workflow action that records progress.
- Update tests for generated skill guidance and the revised resume workflow behavior.

## Non-goals
- Redesign the CW task lifecycle or Project Baseline model.
- Add a new command or public TypeScript package surface.
- Change `cw-understand` so automatic scans directly overwrite `.cw/project/*`.
- Change `cw-doctor` into a repair command.

## Constraints
- Generated skills are not canonical workflow truth; adapter rendering code is canonical for generated guidance.
- Project Baseline files stay current-state descriptions and require user confirmation before updates.
- Resume notes point to task artifacts and do not replace `task.json`, `trace.jsonl`, `spec.md`, `plan.md`, or `task.md`.

## Decisions
- Include all three support commands in one change because they share the same generated-skill quality gap.
- Treat `cw-understand` as the highest-risk support command because it can influence reusable project truth.
- Treat `cw-doctor` as read-only by default, with repairs requiring a separate user request.
- Treat `cw-resume` as an intentional continuation entry point; the kernel consumes `resume.md` automatically only after later progress is recorded.

## Acceptance Criteria
- [x] Generated skills for `cw-understand`, `cw-doctor`, and `cw-resume` include command-specific Phase Guidance.
- [x] `cw-understand` guidance separates observed repository facts from inferred draft content and preserves the draft-first merge gate.
- [x] `cw-doctor` guidance defines report order, evidence, and read-only repair boundaries.
- [x] `cw-resume` guidance defines resume note precedence, parked-task handling, and automatic consume-after-progress behavior.
- [x] The executable `resume` action loads resume context without immediately deleting `resume.md`, then later progress actions consume it automatically.
- [x] Tests cover generated guidance and revised resume behavior.
