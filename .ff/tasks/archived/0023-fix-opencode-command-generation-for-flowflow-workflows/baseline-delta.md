# Baseline Delta

## overview.md

## architecture.md

- OpenCode harness 会生成项目级 slash command 文件到 `.opencode/commands/<ff-command>.md`。这些 command 文件是 OpenCode 斜杠菜单和 command template 的调用表面，正文包含对应 Flowflow workflow 指导和 `$ARGUMENTS` 参数入口。

## rules.md

- OpenCode generated command 文件属于 generated invocation surface。其规范变更应通过更新 `src/harness/adapters.ts` 并重新生成完成，不能把 `.opencode/commands/*.md` 的手工编辑当作 canonical workflow truth。
- `doctor` 需要检查现有 OpenCode harness 产物中 `.opencode/commands/<ff-command>.md` 的缺失或过期；`validate` 继续只负责结构校验。

## commands.md
