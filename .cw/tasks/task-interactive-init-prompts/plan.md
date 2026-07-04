# Plan

## Approach
1. Add a small CLI prompt helper for single-choice questions using stdin/stdout.
2. Parse a positional init root before falling back to `--root` or `process.cwd()`.
3. Use prompts only for `init` when the relevant flag is missing and the process is interactive.
4. Keep `initProject` unchanged so kernel tests and direct API usage stay stable.
5. Add focused CLI tests that execute `dist/src/cli.js` in a pseudo-terminal for the interactive path.

## Key Decisions
- Keep default choices as the first option in every prompt.
- Keep JSON output for now, because changing output format is a separate product decision.
- Avoid introducing a prompt dependency; the prompt behavior is small enough for Node's readline.

## Risks
- Prompt tests can be flaky if they rely on raw timing; use deterministic stdin writes and output assertions.
- TTY detection can break automation; only prompt when stdin and stdout both report TTY.

## Validation Strategy
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `node dist/src/cli.js validate --root .`.
