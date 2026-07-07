# Spec

## Goal
Make `cw init` match the intended first-run experience:
when no `--root` is provided it initializes the current directory, and when
interactive choices are missing it asks the user which harness and optional
enhancements to use.

## Scope
- Public `cw init` CLI behavior.
- Harness selection when `--harness` is omitted.
- Code index tool and context memory tool choices when their flags are omitted.
- Positional root support for `cw init .`.
- Tests for non-interactive flag behavior and interactive prompt behavior.
- Tool setup flow for selected code index and context memory providers.
- Public init harness choices for Codex, Claude, OpenCode, and Pi.
- Harness-specific provider defaults for Claude, OpenCode, and Pi.

## Non-goals
- Making code index or context memory tools mandatory.
- Proving third-party provider quality beyond setup metadata and safe command planning.
- Fully validating high-intrusion providers against the user's real global agent configuration.
- Adding plugin, marketplace, or custom command generation before a harness integration explicitly requires it.

## Constraints
- Missing `--root` must keep using the current working directory.
- Explicit flags must keep working for automation and CI.
- Existing user files must not be overwritten by init.
- Prompt choices must remain skippable for optional enhancements.

## Decisions
- `cw init .` treats `.` as the root path.
- `cw init --root <path>` remains supported.
- `cw init --harness <value>` skips the harness prompt.
- Missing `--harness` prompts for a real supported harness choice: Codex, Claude, OpenCode, or Pi.
- There is no `generic` adapter output; init without a harness creates only `.cw` Repo Truth.
- Missing `--code-index` prompts whether to install and initialize a code index tool.
- Missing `--context-memory` prompts whether to install and initialize a context memory tool.
- Public enhancement prompts must choose concrete tool providers, not vague detect/configure states.
- Tool setup must show the install/init commands and ask for confirmation before running network or package-manager commands.
- Successful setup records provider metadata in `.cw/enhancements.json`, including provider id, status, commands run, and verification result.
- Non-TTY execution falls back to the existing conservative defaults.

## V1 Default Strategy
- Codex and Claude should prioritize `codebase-memory-mcp` for code index setup.
- Codex should use native Codex memories as the default memory option by setting `memories = true` under `[features]` in `~/.codex/config.toml`.
- Claude should use `claude-mem` as the default context memory provider.
- OpenCode and Pi should prioritize `magic-context` for memory/context management.
- OpenCode and Pi should prioritize `aft` for code index / code action enhancement, but only after an explicit high-intrusion warning because AFT replaces built-in harness tools.
- When OpenCode or Pi is selected, CW should tell the user that `magic-context` and `aft` need additional initialization and restart steps after install.
- CW should warn that `magic-context` uses model-backed background work for history compression, memory formation, and maintenance; users may need to configure suitable models.
- If the user declines `magic-context` / `aft`, CW may offer lower-intrusion alternatives from the provider registry.
- OpenCode has its own LSP support. CW should treat OpenCode LSP as a built-in diagnostic option, not as a replacement for code index providers. LSP setup can be suggested before high-intrusion AFT when the user wants a lighter path.

## Non-interactive Policy
- `cw init --yes` and non-TTY init must not run package-manager commands, network installers, or global config writes.
- Non-interactive setup may record a pending provider choice and print the exact follow-up command the user can run in an interactive shell.
- Tool installation requires an interactive TTY confirmation or a future explicit install command designed for that purpose.

## Config Write Policy
- Interactive setup may modify config files after CW previews the exact file path, intended patch, install/init commands, and verification step.
- Codex native memories should be enabled by updating `~/.codex/config.toml` after confirmation. If the file already has a `[features]` table, preserve existing keys and set `memories = true`; otherwise add the table.
- Project-local config changes and tool-owned files follow the same preview-and-confirm rule.

## Candidate Tool Registry

### Code Index Providers
- `codebase-memory-mcp`: candidate default for Codex and Claude; installs a local MCP code intelligence engine and can configure multiple coding agents.
- `graphify`: experimental graph/index provider; supports Codex, OpenCode, Pi, and project-local skill installation. Intrusion is medium to high because Codex install writes project instructions and hooks, indexing writes `graphify-out/`, and uninstall may leave empty hook config behind.
- `codegraph`: experimental code graph provider; installs globally, wires agents, then initializes each project with `codegraph init`. Intrusion is medium because it may update agent MCP config, writes per-project `.codegraph/`, and records telemetry under the user's home directory.
- `aft`: candidate for OpenCode and Pi only; high-intrusion provider because it replaces built-in read/write/edit/search tools with AFT-backed versions.

### Context Memory Providers
- Codex native memories: default Codex memory provider. Enables built-in Codex memory by writing `[features] memories = true` to `~/.codex/config.toml`.
- `Kage`: experimental generic memory provider; repo-native verified memory under `.agent_memory/`, with agent auto-wiring. Do not make it the default until adoption and effectiveness are better validated.
- `claude-mem`: Claude-oriented memory provider; can also install for OpenCode.
- `opencode-dynamic-context-pruning`: OpenCode context pruning provider, not general memory; may conflict with other context managers.
- `magic-context`: recommended memory/context provider for OpenCode and Pi.
- `opencode-mem`: OpenCode plugin with local SQLite/vector memory.
- `pi-dcp`: Pi-specific context pruning provider, not general memory.
- `Hindsight`: hosted or local-daemon memory provider with integrations for OpenCode, Claude Code, Cursor, and Codex.
- `engram`: agent-agnostic memory provider using a Go binary, SQLite/FTS5, MCP, CLI, HTTP API, and per-agent setup commands.

## Init Setup Principles
- CW must distinguish code index, long-term memory, and context pruning; they solve different problems and may conflict.
- CW must show provider-specific file writes, global config changes, package manager commands, required restarts, and known conflicts before confirmation.
- High-intrusion providers such as AFT and Magic Context require stronger confirmation because they replace or disable existing harness behavior.
- Harness-specific provider choices should be filtered by selected harness. For example, AFT is relevant to OpenCode/Pi, while Codex should not be offered AFT as a normal code index choice.
- CodeGraph and Graphify may be offered as Codex code index experiments, but they must be labeled experimental and intrusive in the prompt and preview. They are not v1 defaults.
- Context memory should default to skip until a provider has enough evidence for the selected harness. Low-adoption providers may be offered only with an experimental warning.
- Every provider setup must preview the config files it may modify, including Codex `~/.codex/config.toml`, OpenCode `opencode.json`, Pi config, project-local files such as `.cortexkit/`, and tool-owned files such as `.agent_memory/`.

## Harness Defaults
- Codex:
  - Code index default: `codebase-memory-mcp`.
  - Context memory default: Codex native memories.
- Claude:
  - Code index default: `codebase-memory-mcp`.
  - Context memory default: `claude-mem`.
- OpenCode:
  - Code index default: `aft`.
  - Context memory default: `magic-context`.
- Pi:
  - Code index default: `aft`.
  - Context memory default: `magic-context`.

## Harness Setup Requirements
- `cw init --harness claude` must generate or configure the Claude harness entry points that CW supports, then run the Claude provider selection flow.
- `cw init --harness opencode` must generate or configure the OpenCode harness entry points that CW supports, then run the OpenCode provider selection flow.
- `cw init --harness pi` must generate or configure the Pi harness entry points that CW supports, then run the Pi provider selection flow.
- If a harness-specific adapter is not yet implemented, `cw init` must not silently fall back to Codex. It should either generate the correct adapter or fail with a clear unsupported-adapter message.
- High-intrusion defaults such as `aft` and `magic-context` must still require explicit setup preview and confirmation before command execution or config writes.
- Non-TTY and `--yes` flows for Claude, OpenCode, and Pi must record pending setup and must not run package managers, installers, or global config writes.

## Acceptance Criteria
- [x] `cw init` prompts for Codex, Claude, OpenCode, and Pi in a TTY when `--harness` is omitted.
- [x] `cw init` prompts for harness and enhancement choices in a TTY when those flags are omitted.
- [x] `cw init .` initializes the positional root.
- [x] Explicit flags skip their corresponding prompts.
- [x] Non-TTY init remains usable with safe defaults.
- [x] Tests cover prompt behavior and positional root parsing.
- [x] The init prompt does not expose Generic as a coding harness.
- [x] Enhancement prompts use concrete tool provider choices instead of detect/configure states.
- [x] Selected code index setup installs, initializes, verifies, and records a provider.
- [x] Selected context memory setup installs, initializes, verifies, and records a provider.
- [x] `cw init --harness claude` defaults to `codebase-memory-mcp` for code index and `claude-mem` for context memory.
- [x] `cw init --harness opencode` defaults to `aft` for code index and `magic-context` for context memory.
- [x] `cw init --harness pi` defaults to `aft` for code index and `magic-context` for context memory.
- [x] Claude, OpenCode, and Pi setup previews list the config files, commands, restart notes, and intrusion warnings for their default providers.
- [x] Non-TTY and `--yes` flows for Claude, OpenCode, and Pi record pending provider setup without executing installers or global config writes.
- [x] Default init without an explicit harness creates only `.cw` Repo Truth.
- [x] `cw init` does not generate `.cw/agent-commands/`, plugin marketplace files, or duplicate harness-specific skill directories by default.
