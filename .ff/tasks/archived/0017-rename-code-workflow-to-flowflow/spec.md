# Spec

## Goal

将项目从 `code-workflow` / `CW` / `cw` 完整改名为 `flowflow` / `Flowflow` / `ff`，使代码仓库、包名、公开 CLI、agent command、generated skill、role agent、Repo Truth 目录、文档、测试和生成产物使用同一套新命名。

## Scope

- `package.json` 和 `package-lock.json` 的包名、描述和 bin 入口改为 Flowflow 命名：主命令为 `ff`，agent command 为 `ff-work`、`ff-clarify`、`ff-plan`、`ff-run`、`ff-check`、`ff-finish`、`ff-resume`、`ff-discard`、`ff-doctor`、`ff-understand`。
- CLI 文案、agent-command 派发、adapter 生成逻辑、watchdog 生成逻辑、role agent 生成逻辑和验证逻辑统一输出 `ff` / `ff-*`。
- Repo Truth 目录从 `.cw/` 迁移为 `.ff/`，包括项目基线、任务、模板、增强配置、编排配置、任务 archive、watchdog 配置引用和校验路径。
- 生成产物目录和文件名同步改名，包括 `.agents/skills/ff-*`、`.claude/skills/ff-*`、`.codex/agents/ff-*`、`.claude/agents/ff-*`、`.opencode/agents/ff-*`、`.pi/agents/ff-*`、`.cursor/agents/ff-*` 以及对应 watchdog artifact。
- README、DESIGN、CONTEXT、AGENTS、ADR、PRD、issue 文档、根级说明文件和项目基线中面向当前产品事实的命名更新为 Flowflow / `ff` / `.ff`。
- 测试和 fixture 更新到新命名，并覆盖 init、update、validate、doctor、生成 skill、生成 role agent、任务存储、clarify gate、watchdog 引用和 agent-command bin 入口。
- 本地 git remote 目标从 `git@github.com:Foabo/code-workflow.git` 更新为 `git@github.com:Foabo/flowflow.git`。如 GitHub CLI 已认证且当前用户有权限，执行 GitHub 仓库 rename；否则记录明确的人工步骤和验证命令。

## Non-goals

- 本次不增加 `aa`、`pp`、`rr`、`vv`、`ff` 之外的高频短命令别名。
- 本次不保留 `cw` / `cw-*` 作为正式公开入口，除非迁移过程需要极短期的本地兼容代码来完成现有任务状态迁移。
- 本次不改变 Flowflow 的工作流语义、phase gate、advisor 策略、task lifecycle 或 baseline promotion 规则。
- 本次不发布 npm 包，也不要求创建 GitHub release。

## Constraints

- `.ff/` 是新的 Repo Truth 目录；迁移完成后当前仓库不应继续依赖 `.cw/`。
- Git 仍是代码变更 truth；Flowflow task artifacts 是工作流事实来源。
- 生成 skill 和 generated agent 不是规范源头；需要先改 adapter / runtime，再重新生成产物。
- 历史归档任务中的旧文本可以作为历史记录保留，但当前运行路径、当前文档、当前生成产物和测试断言不得继续要求 `cw` / `.cw`。
- 仓库已经有未提交的 generated skill 修改，实施时不得回滚用户或既有工作区变更；需要用当前 worktree 状态继续迁移。
- GitHub 仓库改名属于外部状态变更；执行前必须确认远端和权限，失败时不能伪造成功。
- 根级 agent 指令和上下文文件属于当前运行合同，不能把它们当作普通历史文档跳过。

## Decisions

- 产品名：`Flowflow`。
- npm/package 名：`flowflow`。
- 主 CLI：`ff`。
- agent command / generated skill / role agent 前缀：`ff-*`。
- Repo Truth 目录：`.ff/`。
- GitHub 仓库目标名：`Foabo/flowflow`。
- 不做高频短别名。

## Acceptance Criteria
- [x] `package.json`、`package-lock.json`、构建输出和 agent-command 派发使用 `flowflow`、`ff`、`ff-*`，不再声明 `code-workflow`、`cw` 或 `cw-*` 作为当前公开入口。
- [x] `ff init` 在新仓库创建 `.ff/`、`.agents/skills/ff-*` 和对应 harness role agents；不会创建 `.cw/` 或 `cw-*` 生成产物。
- [x] 当前仓库任务和项目基线从 `.cw/` 迁移到 `.ff/`，`ff tasks`、`ff preflight`、`ff validate`、`ff doctor`、`ff update --harness codex` 能基于 `.ff/` 正常工作。
- [x] Codex、Claude、OpenCode、Pi、Cursor 的 generated skill 和 role agent 文件名、frontmatter、触发说明、helper command 文案统一为 `ff` / `ff-*` / `.ff`。
- [x] clarify watchdog hook 和生成 artifact 调用 `ff internal validate-clarify --watchdog`，且路径命名使用 `ff`。
- [x] README、DESIGN、CONTEXT、AGENTS、当前 ADR/PRD/issue 文档、根级说明文件和 `.ff/project/*` 描述 Flowflow 当前事实；旧命名只允许出现在历史上下文、迁移说明或归档任务记录中。
- [x] 自动化验证通过：`npm run typecheck`、`npm test`、`npm run build`、`node dist/src/cli.js validate --root .`、`node dist/src/cli.js doctor --root .`。
- [x] GitHub 仓库已重命名为 `Foabo/flowflow` 并且本地 `origin` 指向 `git@github.com:Foabo/flowflow.git`；如无法自动改名，任务记录中包含阻塞原因、人工 rename 步骤和验证命令。
