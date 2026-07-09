# Plan

## Approach

本任务按三个纵向切片推进：文档语言拆分、CLI 帮助分派、无副作用验证。

先处理 README 的信息结构。现有中文 README 已覆盖开发调试、`init` 与 `update` 的区别、npm bin、`.ff` Repo Truth 和 Codex 生成 skill 的发现方式。实现时应保留这些事实，把默认 `README.md` 改写为英文版，并新增完整中文版 `README.zh-CN.md`。两份 README 开头互链，内容结构保持接近，便于后续维护。英文版需要准确描述 package 名称 `flowflow`、公开 `ff` / `ff-*` bin、`.agents/skills/ff-*` 与 `.claude/skills/ff-*` 的生成路径，以及 `ff update --harness codex` 的刷新流程。若 npm package `files` 白名单会影响中文版 README 发布，需要同步纳入。

CLI 帮助应由 CLI capability 内的共享命令元数据驱动。实现时优先建立一个小型 help catalog 和渲染函数，覆盖顶层命令、workflow wrapper 和公开 internal helper。`src/cli/index.ts` 在执行任何命令逻辑前识别 `--help`：`ff --help` 打印全局帮助，`ff <command> --help` 打印对应顶层命令帮助，`ff internal --help` 打印 internal 总览，`ff internal <helper> --help` 打印 helper 帮助。帮助路径必须在 `initProject`、`doctorProject`、`preflight`、`runInternal` helper 执行、任务选择和 trace 写入之前返回。

workflow wrapper 的帮助也要在执行 workflow 前处理。`src/cli/agent-command.ts` 需要先解析当前 action 来源：真实 `ff-*` bin 名、`agent-command.js <workflow>` fallback，或无法识别 action 的 wrapper 总览场景。只要参数包含 `--help`，就打印对应 workflow 帮助或 workflow 列表并返回 0，不能调用 `runWorkflowAction`。已有 workflow 参数解析保持原行为。

测试从用户可见入口验证行为，而不是只测字符串函数。使用 `tests/support/kernel.ts` 里的 `runCli` / `cliJson` 作为顶层 CLI 测试基础；workflow wrapper 继续用真实 symlink bin 的方式验证 `ff-<workflow> --help`。无副作用断言需要覆盖至少三类高风险路径：`doctor` / `preflight` 不执行项目检查，workflow wrapper 不推进任务，internal helper 不创建任务、不写 trace、不消费 resume。

## Key Decisions

- 中文版 README 使用 `README.zh-CN.md`，默认 `README.md` 使用英文。
- 帮助文本放在 CLI capability 的源码中集中维护，由顶层 CLI 和 workflow wrapper 共享；README 只描述公开用法，不复制完整帮助清单。
- `--help` 只支持 flag 形式。本任务不增加 `ff help` 或 `ff help <command>`。
- 帮助输出走 stdout，退出码为 0；未知命令仍保留现有错误/usage 行为。
- internal helper 帮助只覆盖 spec 列出的公开 helper。未公开或未来新增 helper 需要显式加入 catalog 后才算公开帮助面。
- 生成的 Flowflow skill 若受帮助文案或 npm bin 说明影响，必须从 adapter 渲染源刷新，不能直接手改生成 skill。

## Risks

- `--help` 判断如果放在现有 switch 或 workflow 执行之后，会触发 doctor、preflight、任务选择、trace 写入或 resume 消费。
- `agent-command.js` fallback 和真实 `ff-*` symlink 的 action 推断路径不同，测试需要覆盖两种入口。
- internal helper 的参数差异较大，帮助元数据容易遗漏必填参数；catalog 应显式列出用途、用法和关键参数。
- README 默认语言切换可能造成 npm 包发布时中文版文件遗漏，需要检查 `package.json` 的 `files` 配置。
- 若更新 help 文案同时修改生成 skill 提示，生成物和源码可能漂移；实现阶段要按项目规则从源头重新生成。

## Validation Strategy

- 自动化测试覆盖：
  - `ff --help` 返回 0，列出顶层命令和 workflow wrapper。
  - `ff <command> --help` 对 `init`、`validate`、`doctor`、`update`、`tasks`、`preflight`、`internal` 返回 0，并输出用途、用法和关键参数。
  - `ff internal <helper> --help` 对所有公开 helper 返回 0，不要求 `--task` 等业务参数。
  - `ff-<workflow> --help` 对所有 workflow wrapper 返回 0，并且不调用 workflow。
  - 帮助请求不会创建任务、改写 `task.json`、追加 `trace.jsonl`、消费 resume note 或执行 doctor 检查。
- 文档检查覆盖中英文 README 互链、命令名称、npm bin、`.ff` Repo Truth、repo-local skill 生成路径和 `ff update --harness codex` 刷新说明。
- 完整验证命令：
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `node dist/src/cli.js validate --root .`
  - 如生成 harness 输出发生变化，追加 `node dist/src/cli.js doctor --root .`
- check 阶段需要对照 spec 验收条件做 artifact cross-review，并记录 Baseline Outcome：若本任务只改变 README 和 CLI help 行为且没有稳定项目事实新增，记录“无可复用 Project Baseline 变更”；若公开命令约定或验证命令说明需要长期保留，写入 task-local `baseline-delta.md` 候选。
