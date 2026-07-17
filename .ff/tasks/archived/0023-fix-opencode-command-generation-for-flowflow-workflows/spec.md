# Spec

## Goal

修复 Flowflow 的 OpenCode harness 生成结果：`ff init --harness opencode` 和 `ff update --harness opencode` 需要生成 OpenCode 能发现的 project slash command 文件，使 `/ff-clarify`、`/ff-work` 等 Flowflow 命令在 OpenCode 的斜杠菜单中出现，并且执行时带有完整 workflow 指导。

## Scope

- 在 `src/harness/` 的 adapter 生成逻辑中，为 OpenCode 新增 `.opencode/commands/<ff-command>.md` 产物。
- 覆盖所有公开 Flowflow workflow 命令，即 `AGENT_COMMANDS` 中的 `ff-*` 命令。
- OpenCode command 文件使用 OpenCode markdown command 格式：frontmatter 写入 `description`，正文写入对应 workflow action 的完整指导，并通过 `$ARGUMENTS` 接收 slash command 后面的用户请求。
- `ff init --harness opencode` 创建这些 command 文件；`ff update --harness opencode` 刷新这些 command 文件。
- `doctor` 需要能发现 OpenCode command 文件缺失或过期；`validate` 保持结构校验职责，不把 generated output stale warning 升级成项目结构错误。
- 更新测试，覆盖 OpenCode command 生成、刷新、旧仓库缺目录检测和 stale 检测。
- 刷新当前仓库的 OpenCode generated outputs，使本仓库里的 `.opencode/commands` 与生成器保持一致。

## Non-goals

- 不改变 Flowflow workflow 命令本身的语义、阶段规则或 task lifecycle。
- 不移除 `.agents/skills`；它仍然作为 Codex、OpenCode、Pi、Cursor 共享的 generated skill surface。
- 不新增旧 `cw-*` 命名、OpenCode 全局命令、OpenCode config JSON `command` 配置，或新的 role agent。
- 不修改 Codex、Claude、Pi、Cursor 的 command surface。
- 不把 OpenCode command 文件做成用户可配置的 role/model 配置载体；role/model 仍然由 `.ff/orchestration.json` 和 role agent 生成逻辑负责。

## Constraints

- `.ff` 是 workflow Repo Truth；generated skill、OpenCode command、role agent、watchdog 都是调用表面。
- 规范事实以 OpenCode 官方 command 文档为准：项目级 markdown command 放在 `.opencode/commands/`，文件名决定 slash command 名称，frontmatter `description` 用于提示展示，`$ARGUMENTS` 接收命令参数。
- canonical 修改点是 `src/harness/adapters.ts` 和相关验证逻辑；不要手工把 generated output 当成源头。
- 生成的 OpenCode command 文件必须足够自包含，不能依赖 OpenCode 一定会把 `.agents/skills` 同步提示给模型。
- 如果 `.opencode/agents` 或 `.opencode/plugins` 已存在，说明仓库已经有 OpenCode harness 产物；此时 `.opencode/commands` 缺失也要作为 generated output drift 被 `doctor` 报告。
- 保持 root entry 文件薄，不把产品逻辑放进 `src/index.ts`、`src/cli.ts` 或 `src/agent-command.ts`。

## Decisions

- 为 OpenCode 生成 `.opencode/commands/ff-work.md`、`.opencode/commands/ff-clarify.md` 等 command 文件；命令名保持 `ff-*`，用户在 OpenCode 中输入 `/ff-clarify`。
- Command 正文直接包含与对应 generated skill 相同的 workflow 指导，并在开头写明“用户通过 slash command 传入的请求是 `$ARGUMENTS`”。这样即使 OpenCode 没有把 `.agents/skills` 作为 slash 提示来源，slash command 执行也能拿到完整行为规则和用户请求。
- `.agents/skills` 继续生成，作为跨 harness 的 skill surface 和当前 Codex 调用入口。
- OpenCode command frontmatter 只写 `description`，避免在 command 文件里锁定 `agent` 或 `model`。
- `doctor` / generated adapter warnings 把 OpenCode command 文件纳入 currentness 检查。

## Acceptance Criteria
- [x] `ff init --harness opencode` 会生成 `.opencode/commands/ff-clarify.md` 以及所有 `AGENT_COMMANDS` 对应的 command 文件。
- [x] 每个 `.opencode/commands/<command>.md` 的 frontmatter 包含 `description`，正文包含对应 workflow action 名称、`.ff` Repo Truth、完整 workflow 指导和 `$ARGUMENTS` 用户参数入口。
- [x] `.opencode/commands/ff-clarify.md` 的正文包含 `ff-clarify` workflow action、`.ff` Repo Truth、Proposed Spec、`validate-clarify` 和 `$ARGUMENTS` 用户参数入口。
- [x] `ff update --harness opencode` 能刷新 stale OpenCode command 文件。
- [x] 当 `.opencode/agents` 或 `.opencode/plugins` 已存在但 `.opencode/commands/<command>.md` 缺失或过期时，`doctor` 会报告具体 command 文件路径。
- [x] 现有 OpenCode role agent、watchdog、`.agents/skills` 生成行为保持可用。
- [x] 通过 `npm run typecheck`、`npm test`、`npm run build`、`node dist/src/cli.js validate --root .`。
