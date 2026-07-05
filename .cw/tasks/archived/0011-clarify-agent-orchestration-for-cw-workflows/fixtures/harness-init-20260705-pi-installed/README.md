# Pi Installed Retest Fixture

Generated on 2026-07-05 after `pi` was installed locally.

Environment evidence:

- `command -v pi` returned `/Users/abboo/.local/share/mise/installs/node/22.22.1/bin/pi`.
- `pi --version` returned `0.80.3`.

Command:

- `node dist/src/cli.js init --root <fixture>/pi --harness pi --code-index skipped --context-memory skipped --yes`

Result:

- Pi setup record status: `configured`
- Command run: `pi install npm:pi-subagents`
- Exit code: `0`
- Generated role agents: `pi/.pi/agents/cw-*.md`

Follow-up check:

- `node dist/src/cli.js validate --root <fixture>/pi` returned `ok: true`.
- `node dist/src/cli.js update --root <fixture>/pi --harness pi` returned only adapter refresh and validation output, with no setup/install record.
