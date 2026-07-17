# Plan

## Implementation

- 在 `src/harness/adapters.ts` 增加 OpenCode command 生成路径，仅当 harness 是 `opencode` 时生成 `.opencode/commands/<command>.md`。
- 以 `AGENT_COMMANDS` 作为唯一命令清单，新增 OpenCode command expected/render helper，避免手写单个 `ff-*` 命令。
- OpenCode command frontmatter 只输出 `description`。正文开头写明 slash command 用户请求来自 `$ARGUMENTS`，随后包含对应 workflow action 的完整指导。
- 保留 `.agents/skills`、OpenCode role agents、OpenCode watchdog 的现有生成行为。新增 command 文件只作为 OpenCode slash menu 的调用表面，不承载 role/model 配置。
- 在 `src/project/validate.ts` 的 doctor generated warnings 中加入 OpenCode command currentness 检查。触发条件限定为 `.opencode/agents`、`.opencode/plugins` 或 `.opencode/commands` 已存在；缺失或内容不等于当前生成器输出时，报告具体 `.opencode/commands/<command>.md` 路径。
- `validateProject` 保持结构校验职责，不加入 generated output stale/missing warning。
- 更新 `tests/harness/harness.test.ts`：导入 `AGENT_COMMANDS`，遍历该常量覆盖 init 生成、update 刷新、doctor missing、doctor stale、doctor currentness。
- 刷新当前仓库 OpenCode generated outputs。若普通 `ff update --harness opencode` 遇到 protected role-agent config conflict，停止并分类冲突，不用 `--force` 覆盖用户配置。

## Key Decisions

- `.opencode/commands/<command>.md` 是 OpenCode 斜杠提示和执行模板的专用调用表面；`.agents/skills` 继续保留为跨 harness skill 产物。
- Command 正文复用 workflow 指导渲染结果，并额外加入 `$ARGUMENTS` 用户请求入口，保证 slash command 执行时有行为规则和用户输入。
- Doctor 报 generated output drift；validate 只检查 repo 结构和 `.ff` 事实文件。

## Risks

- OpenCode command currentness 检查触发条件过宽会误报只有 `.opencode` 依赖目录的仓库；检查必须绑定 `.opencode/agents`、`.opencode/plugins` 或 `.opencode/commands`。
- Command renderer 如果只复用 workflow 指导，可能漏掉 `$ARGUMENTS`；测试必须断言参数入口。
- Frontmatter 如果复用 skill 或 role-agent renderer，可能带入 `name`、`agent`、`model` 等字段；测试要检查 frontmatter key 集合。
- 当前仓库执行 OpenCode update 可能遇到 protected role-agent config conflict；不能用 force 覆盖未确认的用户配置。

## Acceptance Mapping

- AC1：OpenCode adapter 生成 `expectedGeneratedOpenCodeCommands()`；测试遍历 `AGENT_COMMANDS` 检查 init 后所有 `.opencode/commands/<command>.md` 存在。
- AC2：`renderOpenCodeCommand(command)` 输出仅含 `description` 的 frontmatter，并在正文包含 command 名称、`.ff` Repo Truth、完整 workflow 指导和 `$ARGUMENTS`；测试逐文件断言。
- AC3：针对 `.opencode/commands/ff-clarify.md` 增加专项断言，覆盖 `ff-clarify`、`.ff` Repo Truth、`Proposed Spec`、`validate-clarify`、`$ARGUMENTS`。
- AC4：测试写入 stale command 内容后运行 `updateProject(root, ["opencode"])`，再断言文件恢复为生成器期望内容。
- AC5：`doctorProject` 的 generated warnings 纳入 OpenCode command missing/stale 检查，测试分别覆盖 `.opencode/agents` 和 `.opencode/plugins` 已存在场景，并断言 warning path 是具体 command 文件。
- AC6：保留现有 role agent、watchdog、`.agents/skills` 生成流程和测试；新增断言确认这些路径仍存在并包含原有关键内容。
- AC7：完成后运行 `npm run typecheck`、`npm test`、`npm run build`、`node dist/src/cli.js validate --root .`；补充运行 `node dist/src/cli.js doctor --root .` 和 `git diff --check`。
