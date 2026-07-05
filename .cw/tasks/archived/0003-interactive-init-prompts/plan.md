# Plan

## Approach
1. Keep `initProject` focused on creating baseline `.cw` files by default. Harness entries are generated only when a real harness is explicitly selected. Provider installation and config writes belong to the CLI `init` post-step.
2. Replace the record-only enhancement prompt model with a provider registry. Each provider declares category, supported harnesses, default priority, install/init commands, config files it may touch, verification command, restart notes, and intrusion warnings.
3. Expose the v1 public harness set in `cw init`: Codex, Claude, OpenCode, and Pi. Codex and Claude should default code index to `codebase-memory-mcp`; Codex context memory should default to native Codex Memories; Claude context memory should default to `claude-mem`; OpenCode and Pi should default to `aft` for code index and `magic-context` for context memory.
4. Split setup into three pure stages: select provider, build setup plan, then execute confirmed steps. This keeps prompt text, command preview, file patching, command execution, and metadata writing testable without running real installers.
5. Extend `.cw/enhancements.json` validation in a backward-compatible way. Preserve the existing high-level fields, and add optional provider metadata for `code_index` and `context_memory`.
6. Make non-interactive execution conservative. `--yes`, non-TTY, and CI paths must not run installers or write global config. They may record a pending setup and print follow-up instructions.
7. Add focused tests around provider selection, non-interactive safety, Codex memory config patching, metadata shape, and interactive confirmation.

## Implementation Shape
- Add a small enhancement setup module, likely `src/enhancements.ts`, with provider types, provider registry, setup-plan builders, metadata helpers, and config patch helpers.
- Keep `EnhancementChoice` for the existing kernel surface. Add provider metadata types without requiring every existing `.cw/enhancements.json` file to contain the new fields.
- Update CLI flag parsing so public values can be concrete provider ids such as `codebase-memory-mcp` and `codex-native-memories`, plus `skipped`. Keep legacy `configured` acceptance only as a compatibility path, and remove it from user-facing prompt/help text.
- Change CLI `init` flow to gather harness/provider choices, call `initProject`, then run setup planning and confirmation. The final JSON should include the normal init result plus setup results or pending setup summaries.
- For Codex Memories, update `~/.codex/config.toml` only after confirmation. Preserve existing content by editing or adding the `[features]` section and setting `memories = true`.
- For `codebase-memory-mcp`, preview the installer/init command and verification command before execution. Execute through a command-runner abstraction so tests can use a fake runner.
- Record provider metadata after setup attempt: provider id, category, status, commands planned or run, verification result, touched files, and timestamp.

## Key Decisions
- Provider setup is a CLI responsibility. `initProject` remains the kernel primitive for baseline initialization, with optional harness output only when requested.
- Interactive defaults may prioritize a provider, but actual installation/config writes still require a second confirmation.
- Current public harness selection is Codex, Claude, OpenCode, and Pi. There is no `generic` adapter output.
- OpenCode LSP is a diagnostic option to mention later when OpenCode becomes a public harness; it is not modeled as the default code index provider.
- No package-manager, network installer, or global config write runs in non-TTY mode.
- Do not introduce a general TOML dependency for the initial Codex Memories patch unless tests show the scoped updater is insufficient. A targeted updater can preserve comments and formatting better than parsing and rewriting the whole file.

## Risks
- `.cw/enhancements.json` is already in the schema, so metadata changes must remain compatible with existing files and old tests.
- Running third-party installer commands from init is sensitive. Command preview and explicit confirmation must be difficult to bypass by accident.
- Config files in user home directories can contain comments or custom layout. The Codex TOML updater should preserve unrelated content and fail clearly on ambiguous structures.
- Prompt tests can be flaky if they depend on timing. Keep stdin answers deterministic and avoid real network/process work in tests.
- Future OpenCode/Pi provider defaults are more invasive than Codex defaults; the registry should carry intrusion metadata now so later harness support does not silently enable risky flows.

## Validation Strategy
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .`.
- Manually exercise or test CLI cases for interactive Codex setup, explicit skip flags, legacy compatibility flags, and non-TTY safety.

## Addendum: Installed Provider Detection
- Detect existing `codebase-memory-mcp` before building the Codex code index setup prompt. Use the binary path and `codebase-memory-mcp --version` as the low-risk detection path; use project index detection only when the CLI exposes a stable command for it.
- If `codebase-memory-mcp` is already installed, default to a safer prompt:
  - Use existing and index this repo.
  - Skip.
- If it is not installed, keep the current install-and-index default flow.
- Normalize provider metadata before writing `.cw/enhancements.json`: home paths should be recorded as `~`, repo-local paths as relative paths, and machine-specific absolute paths should not become durable repo facts.
- Keep actual command execution separate from recorded display metadata where necessary. For example, the command runner may need an absolute repo path, while `.cw/enhancements.json` should record a normalized path.
- Keep Codex experimental code index candidates limited to CodeGraph and Graphify for now. Serena is out of the v1 init candidate set because it is broader than code indexing and has a more involved MCP lifecycle.
- Add tests for installed detection, prompt branch ordering, use-existing command selection, and path normalization.

## Addendum: Experimental Code Index Candidates
- Keep `codebase-memory-mcp` as the Codex default. CodeGraph and Graphify may be offered only as explicit experimental alternatives.
- The provider registry should carry an `experimental` marker and a user-facing intrusion warning. The init prompt and setup preview must show those labels before either provider can be selected.
- CodeGraph isolated test result: `codegraph` 1.2.0 successfully ran `init`, `status`, `query`, `explore`, `sync`, `index`, and `uninit` in a fixture repo. Its Codex config preview prints an MCP config block, but the full install/uninstall config-write path was not fully verified. Treat it as experimental and intrusive because it can update agent config, writes `.codegraph/`, and records telemetry under the user's home directory.
- Graphify isolated test result: `graphifyy` 0.9.6 successfully ran `graphify codex install` and `graphify update .` without an API key or LLM call in a fixture repo. It wrote `AGENTS.md`, `.codex/hooks.json`, and `graphify-out/`; uninstall removed the main artifacts but left an empty `.codex/hooks.json`. Treat it as experimental and intrusive because it writes project instructions, Codex hooks, and generated graph output.
- Tests should assert that experimental providers are not the default Codex code index choice, that prompt labels mention experimental/intrusive behavior, and that setup previews list expected files and cleanup caveats.

## Addendum: Claude, OpenCode, and Pi Init Support
- Keep the public harness model to Codex, Claude, OpenCode, and Pi only. Do not keep `generic` as a harness or adapter result.
- Update `cw init` harness prompting and `--harness` parsing so the public order is Codex, Claude, OpenCode, Pi. Existing explicit Codex behavior must keep working.
- Add harness adapters:
  - Claude: generate repository-local Claude skills under `.claude/skills/`.
  - Codex, OpenCode, and Pi: generate repository-local agent skills under `.agents/skills/`.
  - Do not generate `.cw/agent-commands/`; it has no runtime consumer.
  - Do not generate plugin, marketplace, or custom command directories by default. Add those only behind a future explicit option when a harness integration needs them.
- Keep adapter rendering source-owned. Do not edit generated command/skill files as canonical truth.
- Extend provider defaults by harness:
  - Codex: `codebase-memory-mcp` and `codex-native-memories`.
  - Claude: `codebase-memory-mcp` and `claude-mem`.
  - OpenCode: `aft` and `magic-context`.
  - Pi: `aft` and `magic-context`.
- Add provider registry entries and setup plans for `claude-mem`, `magic-context`, and `aft`. The plans should include install commands, expected config files, restart notes, and intrusion warnings, but they must still require confirmation before execution.
- Treat `aft` and `magic-context` as high-intrusion defaults. Prompt text and setup preview should explicitly mention model/config prerequisites, built-in compaction or tool replacement risks, and required restart/reload steps.
- Reuse installed `codebase-memory-mcp` detection for Claude. When installed, the Claude code index prompt should offer use existing or skip; no update/reinstall choices.
- Keep non-interactive behavior unchanged across all harnesses: record pending provider setup and never run installers, package managers, or global config writes.
- `cw update --harness <name>` should refresh only the selected harness's default skill surface.
- Add CLI tests for harness prompt choices, explicit `--harness claude|opencode|pi`, default provider selection per harness, non-interactive pending setup, and generated adapter file paths.
