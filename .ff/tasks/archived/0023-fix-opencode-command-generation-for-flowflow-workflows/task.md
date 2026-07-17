# Task

## Implementation
- [x] 对照 accepted spec、`.ff/project/architecture.md`、`.ff/project/rules.md` 确认范围只包含 OpenCode command surface，不修改其他 harness command surface。
- [x] 在 `src/harness/adapters.ts` 新增 OpenCode command expected/render helper，路径为 `.opencode/commands/<command>.md`，命令清单来自 `AGENT_COMMANDS`。
- [x] 让 OpenCode adapter 在 init/update 时创建 command 目录并写入每个 command 文件，同时保持 `.agents/skills`、role agents、watchdog 原流程可用。
- [x] 确保 command frontmatter 只含 `description`，正文显式包含 `$ARGUMENTS` 用户参数入口和完整 workflow 指导。
- [x] 在 `src/project/validate.ts` 增加 doctor-only OpenCode command missing/stale warning，报告具体 `.opencode/commands/<command>.md` 路径。
- [x] 保持 `validateProject` 不检查 generated output stale/missing。
- [x] 更新当前仓库 OpenCode generated outputs，优先运行普通 `opencode` update；如遇 protected config conflict，记录并停止确认。

## Verification
- [x] 更新 `tests/harness/harness.test.ts`，遍历 `AGENT_COMMANDS` 断言 init 生成所有 OpenCode command 文件。
- [x] 增加 command frontmatter/body 断言：只有 `description`，正文包含 command 名称、`.ff` Repo Truth、workflow 指导、`$ARGUMENTS`。
- [x] 增加 `.opencode/commands/ff-clarify.md` 专项断言：包含 `ff-clarify`、`.ff` Repo Truth、`Proposed Spec`、`validate-clarify`、`$ARGUMENTS`。
- [x] 增加 update stale 测试：改写某个 command 文件后运行 `updateProject(root, ["opencode"])`，断言内容恢复 current。
- [x] 增加 doctor missing 测试：`.opencode/agents` 或 `.opencode/plugins` 存在但 command 文件缺失时，warning 指向具体 command path。
- [x] 增加 doctor stale/currentness 测试：stale command 产生 warning，current command 不产生 command warning。
- [x] 保留并更新现有 OpenCode harness 测试，确认 `.agents/skills`、`.opencode/agents`、`.opencode/plugins/ff-clarify-watchdog.ts` 仍生成并可用。

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear: current dirty entries are task-owned source, tests, task artifacts, and generated OpenCode commands.
- [x] Baseline Outcome is recorded: `baseline-delta.md` contains OpenCode command surface facts.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
- [x] Run `node dist/src/cli.js doctor --root .`.
- [x] Run `git diff --check`.
- [x] Check diff confirms no Codex, Claude, Pi, or Cursor command surface changes.

## Notes
- Verification passed: `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, `node dist/src/cli.js doctor --root .`, and `git diff --check`.
- Final implementation review passed: OpenCode commands cover all `AGENT_COMMANDS`, doctor checks missing/stale command files, command frontmatter is limited to `description`, and no other harness command surface changed.
