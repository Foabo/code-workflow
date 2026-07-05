# Harness Init Fixture

Generated on 2026-07-05 for task 0011 after the OpenCode temperature refinement.

Commands:

- `node dist/src/cli.js init --root <fixture>/claude --harness claude --code-index skipped --context-memory skipped --yes`
- `node dist/src/cli.js init --root <fixture>/opencode --harness opencode --code-index skipped --context-memory skipped --yes`
- `node dist/src/cli.js init --root <fixture>/pi --harness pi --code-index skipped --context-memory skipped --yes`
- `node dist/src/cli.js init --root <fixture>/cursor --harness cursor --code-index skipped --context-memory skipped --yes`

OpenCode temperature check:

- `opencode/.opencode/agents/cw-advisor.md` renders `temperature: 0.1`.
- `opencode/.opencode/agents/cw-implementer.md` renders `temperature: 0.2`.
- Temperature range follows the OMO-slim-compatible `0` to `2` schema.

Pi notes:

- Local `pi` is installed and `pi --version` returned `0.80.3` in the separate Pi retest fixture.
- This fixture uses the same default Pi init path, which runs `pi install npm:pi-subagents` unless skipped.
- Generated Pi role agents land under `.pi/agents/`.

Inspection targets:

- Claude: `claude/.claude/agents/cw-advisor.md`
- OpenCode: `opencode/.opencode/agents/cw-advisor.md`
- Pi: `pi/.pi/agents/cw-advisor.md`
- Cursor: `cursor/.cursor/agents/cw-advisor.md`
