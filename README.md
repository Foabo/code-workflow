# Flowflow 开发调试说明

Flowflow 是给 coding agent 用的工作流内核。正常运行时，入口来自 npm 安装后的二进制命令：

```text
ff
ff-work
ff-clarify
ff-plan
ff-run
ff-check
ff-finish
ff-resume
ff-discard
ff-doctor
ff-understand
```

仓库里的 `.ff/`、`.codex/` 和 `plugins/` 文件用于保存项目状态和 harness 适配器输出。它们的作用是让 agent 知道该如何使用这些 npm 命令，不能替代 npm 安装。

## 本地开发

第一次开发前安装依赖：

```bash
npm install
```

常规验证命令：

```bash
npm run typecheck
npm test
npm run build
node dist/src/cli.js validate --root .
node dist/src/cli.js doctor --root .
```

开发时可以直接调用构建后的 CLI：

```bash
node dist/src/cli.js init --root /path/to/repo --harness codex
node dist/src/cli.js update --root /path/to/repo --harness codex
node dist/src/agent-command.js work --root /path/to/repo --task task-id --title "Task title"
```

如果要模拟用户安装后的使用方式，在本仓库执行：

```bash
npm run build
npm link
ff doctor --root .
ff update --root . --harness codex
```

测试结束后取消全局链接：

```bash
npm unlink -g flowflow
```

## 什么时候 init，什么时候 update

`ff init` 用于一个目标仓库的首次初始化：

```bash
ff init --harness codex
```

它会创建基础 Repo Truth：

```text
.ff/version.json
.ff/enhancements.json
.ff/project/*.md
.ff/templates/*.md
```

选择 Codex、OpenCode 或 Pi harness 时，还会生成 repo-local agent skill：

```text
.agents/skills/ff-*/SKILL.md
```

选择 Claude harness 时，会生成 Claude skill：

```text
.claude/skills/ff-*/SKILL.md
```

日常改代码后通常不用重新 `ff init`。`ff init` 是幂等的，但会保护已有用户文件，适合首次创建结构。已经初始化过的仓库需要刷新生成物时，使用：

```bash
ff update --harness codex
```

改到这些内容时需要运行 `ff update --harness codex`：

- `src/adapters.ts`
- 生成的 Flowflow workflow skill 文案
- agent 执行策略说明

只有在 fresh fixture 仓库或手动测试首次安装流程时，才需要重新跑 `ff init --harness codex`。

## 项目上下文文件

项目级上下文文件位于：

```text
.ff/project/overview.md
.ff/project/architecture.md
.ff/project/rules.md
.ff/project/commands.md
```

这些文件是 Repo Truth。每次实现变更后不需要重新生成。只有当稳定的项目事实发生变化时，才应该更新它们。

现有仓库可以通过 `ff-understand` 或 understand workflow 生成草稿。草稿写到：

```text
.ff/understand-draft/
```

草稿需要人工审阅，确认后再合并进 `.ff/project/*.md`。

任务级上下文位于：

```text
.ff/tasks/<task-id>/
```

agent 应该读取这里的 `task.json`、`trace.jsonl`、`spec.md`、`plan.md` 和 `task.md`，并通过 `ff internal ...` helper 修改结构化状态。

## 如何注入到 coding harness

Codex、OpenCode 和 Pi 都可以读取 repo-local `.agents/skills`。对应 harness adapter 会写：

```text
.agents/skills/ff-*/SKILL.md
```

Claude 使用自己的 repo-local skill 目录：

```text
.claude/skills/ff-*/SKILL.md
```

Plugin、marketplace、custom command 等更重的入口只在将来明确需要分发或命令集成时生成；默认 `ff init` 不创建这些额外目录。

目标仓库首次接入 Codex：

```bash
ff init --harness codex
```

开发本仓库的 Codex adapter 时：

```bash
npm run build
node dist/src/cli.js update --root . --harness codex
```

生成 `.agents/skills` 后，如果当前 agent 线程看不到新的 `ff-*` skill，开一个新线程或重载 workspace。运行中的线程可能沿用启动时加载的 skill 列表。

生成的 skill 会调用 npm 安装后的 `ff`、`ff-work`、`ff-check` 等命令。Codex 所在环境必须能找到这些二进制。开发阶段用 `npm link` 测试最直接：

```bash
npm run build
npm link
which ff
which ff-work
ff doctor --root .
```

## 每次变更后的检查

普通 TypeScript 变更：

```bash
npm run typecheck
npm test
npm run build
```

改到 `.ff` 状态、模板、adapter 或生成的 harness 输出：

```bash
npm run typecheck
npm test
npm run build
node dist/src/cli.js update --root . --harness codex
node dist/src/cli.js validate --root .
node dist/src/cli.js doctor --root .
```

改到 npm bin 或打包行为：

```bash
npm run build
npm link
ff validate --root .
ff doctor --root .
ff update --root . --harness codex
```

## 常见问题

Codex 找不到 `ff-work` 时，先检查：

```bash
ls .agents/skills/ff-work/SKILL.md
node dist/src/cli.js doctor --root .
```

Codex 找到了 skill，但命令执行失败时，检查 npm bin：

```bash
which ff
which ff-work
ff doctor --root .
```

生成文件看起来过期时：

```bash
npm run build
node dist/src/cli.js update --root . --harness codex
node dist/src/cli.js doctor --root .
```
