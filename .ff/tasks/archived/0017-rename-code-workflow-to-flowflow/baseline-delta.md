# Baseline Delta

## overview.md

- The project is named Flowflow. Its npm package name is `flowflow`, and its GitHub repository is `Foabo/flowflow`.
- Flowflow is a repository-scoped workflow kernel for coding agents. It turns development requests into recoverable, verifiable task progress across clarify, plan, run, check, finish, resume, discard, doctor, and understand actions.

## architecture.md

- Flowflow stores Repo Truth under `.ff/`. Project baseline, templates, task state, archived tasks, enhancement config, orchestration config, trace events, and task artifacts live under this directory.
- Generated invocation surfaces use the `ff-*` prefix. Codex, OpenCode, and Pi repo-local skills are generated under `.agents/skills/`; Claude skills are generated under `.claude/skills/`; role agents are generated as `ff-<role>` files for each supported harness.
- Local clarify watchdog artifacts call `ff internal validate-clarify --watchdog`.

## rules.md

- Current workflow commands and generated skills must use `ff` / `ff-*` and `.ff`. Old `cw` / `cw-*` / `.cw` names are historical migration context only.
- Do not edit generated Flowflow skills as canonical workflow truth; update adapter rendering code and regenerate harness artifacts.
- Use `ff internal ...` helpers for deterministic task state changes and trace events.

## commands.md

- Generate or refresh Codex repo-local skills with `ff update --harness codex`.
- Verify adapter behavior with `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, and `node dist/src/cli.js doctor --root .`.
