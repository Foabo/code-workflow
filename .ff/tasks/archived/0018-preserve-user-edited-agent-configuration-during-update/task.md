# Task

## Implementation

- [x] Add update options so `updateProject` and CLI `ff update` support default protect mode plus explicit `--force`.
- [x] Add role agent protected-config comparison before overwriting generated role agent files.
- [x] Parse protected Codex TOML fields: `model` and `model_reasoning_effort`.
- [x] Parse protected markdown/frontmatter role agent fields for Claude, OpenCode, Pi, and Cursor: `model`, `temperature`, `tools`, `readonly`, `is_background`, `capability_tier`, and equivalent generated config fields.
- [x] Make default `ff update` refuse protected role agent config conflicts with a clear affected-file/field message, `.ff/orchestration.json` migration guidance, and force guidance.
- [x] Make `ff update --force` overwrite protected role agent config from `.ff/orchestration.json`.
- [x] Print a final restart/reload notice after successful `ff update`, scoped to the selected harness.
- [x] Ensure protected-conflict failure output does not claim update success or print the successful restart/reload notice.
- [x] Keep ordinary generated skill, watchdog, role instruction, and `.ff/orchestration.json`-driven role agent refresh behavior working.
- [x] Fix generated `ff-clarify` helper wording so `accept-spec --advisor-unavailable` is not shown as combinable with `--verdict`.
- [x] Regenerate checked-in generated skills/agents after adapter changes.

## Verification

- [x] Add tests for Codex TOML protected model/reasoning conflict refusing ordinary update.
- [x] Add tests for markdown/frontmatter protected config conflict refusing ordinary update.
- [x] Add tests for `--force` overwriting protected role agent config.
- [x] Add tests proving `.ff/orchestration.json` changes still regenerate role agents through ordinary update.
- [x] Add tests for successful update restart/reload notice.
- [x] Add tests proving protected conflict output uses conflict guidance and no successful restart/reload notice.
- [x] Add or update tests for generated `ff-clarify` helper wording around advisor-unavailable accept.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
- [x] Run `node dist/src/cli.js doctor --root .`.

## Check

- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded.

## Notes

- Direct role agent file edits are protected as user config only for recognized config fields; arbitrary generated body edits remain generated-output drift.
- `ff update` success output should tell the user to restart or reload the host agent, because generated skill/agent files may not be picked up by the running host process.
- Current Codex subagent registry may expose old `cw-*` roles even when repo-local `ff-*` agent files exist; this task handles restart guidance, not host registry internals.
- Evidence: `npm run typecheck`, `npm test` (54 tests passing), `npm run build`, `node dist/src/cli.js validate --root .`, `node dist/src/cli.js doctor --root .`, and `git diff --check` passed after implementation and regeneration.
- Acceptance coverage: Codex TOML protected config, Claude/OpenCode/Pi/Cursor frontmatter protected config, `--force`, `.ff/orchestration.json` regeneration, restart notice success output, protected-refusal output, generated `ff-clarify` accept-spec wording, and generated artifact freshness are covered.
- Dirty worktree: current changes are task-related implementation, tests, regenerated skills, task artifacts, baseline-delta, and the `.learnings/ERRORS.md` entry created for the reproduced accept-spec flag error.
- Baseline Outcome: `baseline-delta.md` records stable reusable facts for update protection, `--force`, restart notices, and generated clarify helper wording.
