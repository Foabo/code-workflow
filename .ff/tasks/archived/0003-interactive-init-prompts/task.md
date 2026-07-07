# Task

## Implementation
- [x] Add init positional root parsing.
- [x] Add TTY-only prompt helpers for missing init choices.
- [x] Wire prompt choices into `initProject` without changing the kernel API.
- [x] Add CLI tests for interactive and non-interactive init behavior.
- [x] Remove user-facing Generic and detect/configure choices from init prompts.
- [x] Remove misleading setup wording from enhancement prompts.
- [x] Record v1 default providers for code index and context memory setup.
- [x] Replace the current record-only enhancement prompt implementation with concrete provider choices.
- [x] Add a provider registry for code index and context memory setup metadata.
- [x] Extend `.cw/enhancements.json` types and validation with backward-compatible provider metadata.
- [x] Add setup-plan builders for Codex `codebase-memory-mcp` and Codex native memories.
- [x] Add confirmation, command preview, config patch preview, and command-runner plumbing for init setup.
- [x] Add Codex Memories `~/.codex/config.toml` patching after confirmation.
- [x] Add `codebase-memory-mcp` install/init/verify execution after confirmation.
- [x] Make non-TTY and `--yes` paths record pending setup or print follow-up instructions without running installers or global config writes.
- [x] Update CLI help and flag parsing to expose provider ids and hide legacy detect/configure language.
- [x] Update tests for provider prompts, confirmed setup, skipped setup, non-interactive safety, and metadata validation.
- [x] Detect existing `codebase-memory-mcp` before prompting for install.
- [x] Change installed `codebase-memory-mcp` flow to offer use existing or skip.
- [x] Default installed-provider flow to use existing and index this repo.
- [x] Normalize provider metadata paths before writing `.cw/enhancements.json`.
- [x] Normalize current repo-local `.cw/enhancements.json` provider metadata from the actual setup run.
- [x] Add tests for installed-provider prompts, use-existing command selection, and path normalization.
- [x] Add CodeGraph and Graphify as Codex code index providers with experimental markers.
- [x] Show intrusive setup warnings for CodeGraph and Graphify in the init prompt and setup preview.
- [x] Keep `codebase-memory-mcp` as the default Codex code index provider when experimental providers are present.
- [x] Add CodeGraph setup metadata for global CLI install, Codex MCP config, per-project `.codegraph/`, and home telemetry.
- [x] Add Graphify setup metadata for Python package install, project `AGENTS.md`, `.codex/hooks.json`, `graphify-out/`, and uninstall residue.
- [x] Add tests that experimental providers are labeled, non-default, previewed with affected files, and skipped unless explicitly selected.
- [x] Extend public `cw init` harness choices to Codex, Claude, OpenCode, and Pi while removing `generic` from adapter output.
- [x] Extend `HarnessName` and adapter routing for `claude`, `opencode`, and `pi`.
- [x] Add Claude adapter output for repository-local `.claude/skills/` skill files.
- [x] Add Codex, OpenCode, and Pi adapter output for repository-local `.agents/skills/` skill files.
- [x] Remove default `.cw/agent-commands/`, plugin, marketplace, custom command, and harness-specific duplicate skill generation.
- [x] Add provider registry entries and setup plans for `claude-mem`, `magic-context`, and `aft`.
- [x] Set Claude defaults to `codebase-memory-mcp` and `claude-mem`.
- [x] Set OpenCode defaults to `aft` and `magic-context`.
- [x] Set Pi defaults to `aft` and `magic-context`.
- [x] Reuse installed `codebase-memory-mcp` detection for Claude without update or reinstall choices.
- [x] Show high-intrusion warnings for `aft` and `magic-context` in prompt text and setup previews.
- [x] Preserve non-interactive and `--yes` safety for Claude, OpenCode, and Pi by recording pending setup only.
- [x] Add tests for harness prompt choices, explicit harness flags, generated adapter paths, default provider selection, and non-interactive pending setup for Claude/OpenCode/Pi.

## Verification
- [x] Run typecheck.
- [x] Run tests.
- [x] Run build.
- [x] Run CW validation.
- [x] Verify prompt text no longer exposes Generic, Detect, or Configure.
- [x] Verify setup previews commands/config patches before confirmation.
- [x] Verify non-TTY and `--yes` do not run package-manager commands, network installers, or global config writes.
- [x] Verify provider metadata is recorded for success, skipped, pending, and failed setup outcomes.
- [x] Verify repeated `cw init` does not reinstall `codebase-memory-mcp` when the user chooses use existing.
- [x] Verify `.cw/enhancements.json` does not record user-home or repo-root absolute paths.
- [x] Verify CodeGraph and Graphify prompt text marks them experimental and intrusive.
- [x] Verify selecting the default Codex code index path does not run CodeGraph or Graphify setup commands.
- [x] Verify `cw init` shows Codex, Claude, OpenCode, and Pi without exposing Generic.
- [x] Verify `cw init --harness claude` uses `codebase-memory-mcp` and `claude-mem` as default providers.
- [x] Verify `cw init --harness opencode` uses `aft` and `magic-context` as default providers.
- [x] Verify `cw init --harness pi` uses `aft` and `magic-context` as default providers.
- [x] Verify `--yes` and non-TTY init for Claude/OpenCode/Pi records pending setup without running installers or global config writes.
- [x] Verify generated Claude/OpenCode/Pi adapter files validate and do not overwrite existing user files.
- [x] Verify default init without a harness creates only `.cw` Repo Truth and no unused adapter surface.

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.

## Notes
- Check fixed two local defects: provider setup now records thrown command failures as failed metadata, and malformed `.cw/enhancements.json` is not silently overwritten before config writes.
- Dirty worktree includes `.cw/enhancements.json` with configured `codebase-memory-mcp` and Codex native memories metadata from an actual provider setup run; finish should decide whether that repo-local state belongs in the final commit.
- User confirmed the actual init result is close to expected, but repeated installs and machine-specific metadata need improvement before finish.
- Isolated CodeGraph test used temporary HOME/npm/cache paths. Core CLI worked for init/status/query/explore/sync/index/uninit, but full Codex install/uninstall config writes were not fully verified. Mark CodeGraph experimental and intrusive.
- Isolated Graphify test used temporary HOME/Python paths. Codex install and no-LLM update worked, but it wrote project `AGENTS.md`, `.codex/hooks.json`, and `graphify-out/`; uninstall left an empty `.codex/hooks.json`. Mark Graphify experimental and intrusive.
- Run implemented installed-provider detection, use-existing setup mode, metadata normalization, and experimental/intrusive CodeGraph and Graphify provider warnings.
- User removed the installed-provider update/reinstall choices; installed `codebase-memory-mcp` now offers use existing or skip.
- Plan expanded implementation for Claude, OpenCode, and Pi init support with harness-specific default providers and adapter output.
- Run implemented Claude/OpenCode/Pi init harness choices, repository-local adapter outputs, default provider setup plans, high-intrusion prompt labels, and `--yes` pending setup safety.
- Follow-up fixed the type boundary: public `HarnessName` now contains only Codex, Claude, OpenCode, and Pi.
- Follow-up removed the unused internal adapter mode entirely: default init creates no adapter, Claude uses `.claude/skills`, and Codex/OpenCode/Pi use `.agents/skills`.
