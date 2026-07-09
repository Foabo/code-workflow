# Task

## Implementation
- [x] 梳理公开入口清单：确认 README、`package.json` bin、顶层 CLI、workflow wrapper、internal helper 与 spec 范围一致。
- [x] 建立共享 help catalog 和渲染函数，覆盖顶层命令、workflow wrapper、公开 internal helper 的用途、用法和关键参数。
- [x] 接入 `ff --help` 和 `ff <command> --help`，确保帮助分支在命令执行前返回 0。
- [x] 接入 `ff internal --help` 和 `ff internal <helper> --help`，确保 helper 帮助不要求业务参数，也不进入 helper switch 的写入逻辑。
- [x] 接入 `ff-<workflow> --help` 和 `agent-command.js <workflow> --help`，确保帮助分支不调用 `runWorkflowAction`。
- [x] 将默认 `README.md` 改写为英文版，并新增 `README.zh-CN.md`；两份 README 互链，覆盖安装、初始化、常用工作流、公开命令、生成 harness 输出、验证和故障排查。
- [x] 检查 npm package `files` 配置，必要时纳入中文版 README。
- [x] 如 CLI 帮助或 README 变更影响生成 skill 文案，更新渲染源并刷新所有受影响且已纳入仓库的 harness 生成物；若生成源未变，记录不刷新生成物的原因。
- [x] 增加顶层 CLI 帮助测试，覆盖全局帮助、所有公开顶层子命令帮助和退出码 0。
- [x] 增加 internal helper 帮助测试，覆盖 spec 列出的所有公开 helper，并断言帮助请求无写入副作用。
- [x] 增加 workflow wrapper 帮助测试，覆盖真实 `ff-*` symlink 和 `agent-command.js` fallback，并断言不会推进任务状态。

## Verification
- [x] 运行针对性帮助测试，确认新增测试先覆盖关键入口和无副作用行为。
- [x] 运行 `npm run typecheck`。
- [x] 运行 `npm test`。
- [x] 运行 `npm run build`。
- [x] 运行 `node dist/src/cli.js validate --root .`。
- [x] 如刷新了生成 harness 输出，运行 `node dist/src/cli.js doctor --root .`，并记录刷新了哪些 harness；如未刷新，记录生成源未变。
- [x] 手动抽查 `node dist/src/cli.js --help`、`node dist/src/cli.js internal accept-spec --help` 和一个真实 `ff-<workflow> --help` 输出。

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded.
- [x] 确认 `spec.md` 合同内容未变，仅同步已验证的验收勾选状态。
- [x] 确认帮助请求没有执行 workflow、doctor、preflight、resume 消费或 internal 写入 helper。
- [x] 确认 README 中英文互链、命令名称、npm bin、`.ff` Repo Truth、repo-local skill 路径和 `ff update --harness codex` 说明准确。
- [x] 确认生成物如有变化，来源和刷新命令记录清楚，没有直接手改生成 skill 作为事实源。
- [x] 记录 Baseline Outcome：创建 task-local `baseline-delta.md` 候选，或明确说明本任务没有稳定 Project Baseline 变更。

## Notes
- 生成 skill 渲染源未变，本轮没有刷新 harness 生成物。
- 已创建 task-local `baseline-delta.md` 候选，供 check/finish 阶段决定是否合并到 Project Baseline。
- check 阶段补强了 workflow wrapper 的关键参数说明：`ff-work --help` 包含 `--title`，`ff-check --help` 包含 `--command` 和 `--baseline-outcome`，`ff-finish --help` 包含 `--summary` 和 `--dirty-worktree`，`ff-discard --help` 包含 `--confirm` 和 `--worktree`。
- 验证证据：`npm run typecheck` exit 0；`npm test` exit 0，66 tests passed；`npm run build` exit 0；`node dist/src/cli.js validate --root .` exit 0 with `ok: true`；`node dist/src/cli.js doctor --root .` exit 0 with `ok: true`；`git diff --check` exit 0。
- 手动抽查证据：`node dist/src/cli.js --help` 列出顶层命令和 workflow wrappers；`node dist/src/cli.js internal accept-spec --help` 返回 helper help；临时真实 symlink `ff-plan --help` 返回 wrapper help 且未执行 workflow。
- `doctor` 报告中 `enhancements.code_index.status = failed` 是既有 OpenCode/AFT 外部工具状态；Flowflow doctor 整体 `ok: true`，本任务未修改 enhancement 设置。
- 当前 dirty worktree 的变更均属于任务 0020：README 语言拆分、package files、CLI help、CLI help 测试和 `.ff/tasks/0020...` 任务工件。
