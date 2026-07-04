# Errors

## [ERR-20260703-001] npm_install_hung

**Logged**: 2026-07-03T23:48:01+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
`npm install` ran for over two minutes without output and had to be interrupted.

### Error
```text
npm error process terminated
npm error signal SIGINT
```

### Context
- Command attempted: `npm install`
- Workspace: `/Users/abboo/src/work/agents/code-workflow`
- The command produced no progress output before interruption.

### Suggested Fix
Retry with shorter network timeout or inspect the npm debug log before relying on dependency-based validation.

### Resolution
Replaced Vitest with Node's built-in test runner, then reran `npm install --no-audit --no-fund`. This removed the Vite/Rollup optional dependency path and restored typecheck/test/build.

### Metadata
- Reproducible: unknown
- Related Files: package.json

---

## [ERR-20260704-002] shell_command_string_invocation

**Logged**: 2026-07-04T17:36:34+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A zsh validation script stored `node /path/to/script.js` in a scalar variable and tried to execute it as one path.

### Error
```text
run_cmd:3: no such file or directory: node /Users/abboo/src/work/agents/code-workflow/dist/src/cli.js
```

### Context
- Command attempted: temporary-repository CW command matrix.
- Workspace: `/Users/abboo/src/work/agents/code-workflow`.
- The failure happened before exercising the product commands.

### Suggested Fix
Use bash arrays, shell functions, or pass `node` and the script path as separate command words.

### Resolution
Reran the command matrix with a bash script and separate command words.

### Metadata
- Reproducible: yes
- Related Files: none

---

## [ERR-20260704-001] plugin_validator_missing_yaml

**Logged**: 2026-07-04T10:51:31+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
The Codex plugin validator failed because the system Python environment lacked PyYAML.

### Error
```text
ModuleNotFoundError: No module named 'yaml'
```

### Context
- Command attempted: `python3 .../plugin-creator/scripts/validate_plugin.py plugins/cw-workflow`
- Workspace: `/Users/abboo/src/work/agents/code-workflow`

### Suggested Fix
Use a temporary virtual environment with PyYAML installed when validating local plugins.

### Resolution
Created a temporary venv, installed `pyyaml`, and reran the validator successfully.

### Metadata
- Reproducible: yes
- Related Files: plugins/cw-workflow/.codex-plugin/plugin.json

---
