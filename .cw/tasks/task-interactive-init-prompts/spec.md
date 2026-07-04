# Spec

## Goal
Make `cw init` match the intended first-run experience:
when no `--root` is provided it initializes the current directory, and when
interactive choices are missing it asks the user which harness and optional
enhancements to use.

## Scope
- Public `cw init` CLI behavior.
- Harness selection when `--harness` is omitted.
- Code intelligence and external context choices when their flags are omitted.
- Positional root support for `cw init .`.
- Tests for non-interactive flag behavior and interactive prompt behavior.

## Non-goals
- Changing the `initProject` kernel contract.
- Adding mandatory code intelligence or external context setup.
- Changing `cw update` behavior.
- Supporting more harnesses than the current `generic` and `codex`.

## Constraints
- Missing `--root` must keep using the current working directory.
- Explicit flags must keep working for automation and CI.
- Existing user files must not be overwritten by init.
- Prompt choices must remain skippable for optional enhancements.

## Decisions
- `cw init .` treats `.` as the root path.
- `cw init --root <path>` remains supported.
- `cw init --harness <value>` skips the harness prompt.
- Missing `--harness` prompts for a harness choice.
- Missing `--code-intelligence` prompts for skipped, detected, or configured.
- Missing `--external-context` prompts for skipped, detected, or configured.
- Non-TTY execution falls back to the existing conservative defaults.

## Acceptance Criteria
- [x] `cw init` prompts for harness and enhancement choices in a TTY when those flags are omitted.
- [x] `cw init .` initializes the positional root.
- [x] Explicit flags skip their corresponding prompts.
- [x] Non-TTY init remains usable with safe defaults.
- [x] Tests cover prompt behavior and positional root parsing.
