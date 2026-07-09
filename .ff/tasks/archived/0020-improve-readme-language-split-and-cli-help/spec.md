# Spec

## Goal

让 Flowflow 的公开入口更容易自助理解：默认 README 使用英文，保留独立中文版；所有公开 CLI 命令都支持一致的 `--help`，用户查看帮助时不会触发实际工作流或修改仓库状态。

## Scope

- 将默认 `README.md` 调整为英文版，并新增中文版 README 文件。
- 中英文 README 互相链接，内容覆盖安装、初始化、常用工作流、公开命令、生成 harness 输出、验证和故障排查。
- 为所有公开命令提供可发现的帮助文本：
  - `ff --help`
  - `ff <command> --help`
  - `ff-<workflow> --help`
  - `ff internal <helper> --help`
- 公开命令范围包括 `init`、`validate`、`doctor`、`update`、`tasks`、`preflight`、`internal`，以及 workflow wrapper `work`、`clarify`、`plan`、`run`、`check`、`finish`、`resume`、`discard`、`doctor`、`understand`。
- 公开 internal helper 帮助范围包括 `create-task`、`select-task`、`append-trace`、`validate-clarify`、`set-state`、`finish-task`、`discard-task`、`create-resume`、`ensure-baseline-delta`、`sync-baseline-delta`、`consume-resume`、`migrate-task-ids`、`propose-spec`、`accept-spec`。
- 帮助文本应说明命令用途、基本用法和关键参数，保持简短一致，不对单个命令做额外深度展开。
- 相关测试覆盖顶层帮助、子命令帮助、workflow wrapper 帮助，以及帮助请求不执行实际 workflow 的行为。
- 如 CLI 帮助实现影响 npm bin 或生成 skill 文案，更新相应代码并刷新必要生成物。

## Non-goals

- 不改变 workflow 语义、任务生命周期、resume note 消费边界、doctor 检查逻辑或 `.ff` 数据结构。
- 不新增交互式帮助系统、man page、网站文档或完整参考手册。
- 不重新设计命令名称、参数名称或 npm bin 映射。
- 不把 `.codex/prompts/` 当作 Flowflow 的仓库级命令入口。

## Constraints

- `.ff/` 仍是 Repo Truth；Git 仍是代码变更来源。
- 不直接手改生成的 Flowflow skill 作为事实来源；若生成输出需要变化，更新渲染源并重新生成。
- CLI 帮助应集中维护命令元数据，减少 README、usage 文案和 wrapper 文案之间的漂移。
- `--help` 请求应退出码为 0，并且不得创建任务、选择任务、执行 doctor 检查、消费 resume note 或写入仓库状态。
- 本任务只要求 `--help` 形式；`ff help` 和 `ff help <command>` 不纳入本次范围。
- README 默认英文，中文版本保留完整可读内容。
- Repo-facing 任务文档保持中文。

## Decisions

- 一次补齐所有公开命令的帮助。
- 不对 `doctor` 或 `resume` 做特殊加深；所有命令保持同等简洁说明。
- README 分成默认英文版和独立中文版。

## Acceptance Criteria
- [x] `README.md` 是英文默认版，新增中文版 README，二者互相链接。
- [x] README 准确描述当前 Flowflow 名称、npm bin、`.ff` Repo Truth、repo-local skill 生成路径和 `ff update --harness codex` 刷新方式。
- [x] `ff --help` 列出所有公开顶层命令和 workflow wrapper，并返回退出码 0。
- [x] `ff <command> --help` 对所有公开顶层命令返回该命令帮助，且不执行命令本身。
- [x] `ff-<workflow> --help` 对所有 workflow wrapper 返回该 workflow 帮助，且不执行 workflow 本身。
- [x] `ff internal <helper> --help` 对所有公开 internal helper 返回该 helper 帮助，且不执行 helper 本身。
- [x] 帮助文本包含用途、基本用法和关键参数，风格简短一致。
- [x] 自动化测试覆盖帮助输出和帮助请求无副作用。
- [x] 验证通过：`npm run typecheck`、`npm test`、`npm run build`、`node dist/src/cli.js validate --root .`，并在相关生成物变化时运行 `node dist/src/cli.js doctor --root .`。
