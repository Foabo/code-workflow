# Plan

## Approach

- 在 adapter/update 层增加 role agent 配置保护，而不是把直接编辑 agent 文件变成长期配置入口。
- 先让 `updateProject` 接收更新策略参数，CLI 暴露 `ff update --force`，默认保持 protect 行为。
- 在写入 role agent 前比较“现有文件”和“按 `.ff/orchestration.json` 生成的期望文件”的可配置头部字段：
  - Codex TOML：`model`、`model_reasoning_effort`。
  - Markdown/frontmatter agents：`model`、`temperature`、`tools`、`readonly`、`is_background`、`capability_tier` 等当前生成器会输出的配置字段。
- 只有 recognized configuration fields 发生差异时阻止覆盖；正文说明、职责、required context 等生成内容仍可由普通 `ff update` 刷新。
- 冲突时抛出结构化错误，CLI 输出 affected files、protected fields、`.ff/orchestration.json` 迁移说明，以及 `--force` 覆盖方式。
- 成功完成更新时在 CLI 输出最后追加 restart/reload notice，提示用户重启或 reload 对应 agent host。
- 保持 `ff init` 的缺省生成行为不变，保持 `.ff/orchestration.json` 改动可以通过普通 `ff update` 正常刷新 role agents。

## Key Decisions

- `.ff/orchestration.json` 是 durable role model configuration source。
- `ff update` 默认 protect，`ff update --force` 才允许覆盖 protected user-edited role agent config。
- 保护范围限定为 role agent 文件头部/前言里的配置字段，不保护任意正文文本差异。
- 成功更新才提示 restart/reload；因保护冲突中止时只提示解决冲突和重新运行 update。
- 本次任务顺便修正 generated `ff-clarify` helper wording 中 `accept-spec --verdict` 与 `--advisor-unavailable` 互斥的文案偏差，因为已经在本任务执行中复现并记录。

## Risks

- 直接解析 TOML/frontmatter 容易过度扩大保护范围；实现应只解析当前生成器自己输出的少量字段。
- 不同 harness 的 role agent 格式不同，测试必须覆盖 Codex TOML 和至少一个 markdown/frontmatter 路径。
- `validate`/`doctor` 现有 stale generated-output 检查会把用户配置差异报告为 stale；实现需要让 update 的保护行为和现有 stale warnings 同时成立。
- Restart notice 如果出现在失败路径，会误导用户；CLI 输出需要区分成功和保护冲突。
- `--force` 需要足够显式，避免用户无意覆盖本地配置。

## Validation Strategy

- Add unit/integration tests around `updateProject`/CLI update behavior:
  - Codex TOML protected model/reasoning conflict refuses default update.
  - Markdown/frontmatter protected model/tools/permission conflict refuses default update.
  - `--force` overwrites protected role agent config from `.ff/orchestration.json`.
  - `.ff/orchestration.json` changes regenerate role agents with ordinary update.
  - Successful CLI update prints restart/reload notice.
  - Protected refusal does not print successful restart/reload notice and includes migration/force guidance.
- Regenerate affected checked-in harness artifacts after adapter changes.
- Run `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, and `node dist/src/cli.js doctor --root .`.
- Manually review generated `ff update` output and generated skill wording for agent behavior risks.
