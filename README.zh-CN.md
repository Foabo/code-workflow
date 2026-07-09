# Flowflow

[English](README.md)

Flowflow 是一个面向 coding agent 的仓库级工作流内核。它把开发请求组织成可恢复、可验证的任务进展，覆盖 clarify、plan、run、check、finish、resume、discard、doctor 和 understand 等动作。

npm 包名是 `flowflow`。安装后公开命令入口包括：

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

需要查看命令用途时，使用 `ff --help`、`ff <command> --help`、`ff internal <helper> --help` 或 `ff-<workflow> --help`。

## Repo Truth

Flowflow 把工作流状态保存在 `.ff/`。这些文件是 agent 共享的工作流事实来源：

```text
.ff/version.json
.ff/enhancements.json
.ff/project/*.md
.ff/templates/*.md
.ff/tasks/<task-id>/
```

任务目录包含小型任务工件，例如 `spec.md`、`plan.md`、`task.md`、可选的 `baseline-delta.md`、可选的 `resume.md`、`task.json` 和 `trace.jsonl`。

Git 仍然是代码变更的事实来源。

## 本地开发

安装依赖：

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

本地模拟安装后的使用方式：

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

## 初始化仓库

在目标仓库首次接入时运行：

```bash
ff init --harness codex
```

省略 `--root` 时，Flowflow 使用当前目录。省略关键设置项时，Flowflow 会进入交互式询问；传入 `--yes` 时使用默认选择。

`ff init` 会创建 `.ff/` Repo Truth 文件，并为选定 harness 生成 agent 可读的入口文件。

## 刷新生成的 harness 输出

修改 Flowflow adapter 渲染或生成的 workflow guidance 后，刷新生成文件：

```bash
ff update --harness codex
```

Codex、OpenCode 和 Pi 使用 repo-local skills：

```text
.agents/skills/ff-*/SKILL.md
```

Claude 使用：

```text
.claude/skills/ff-*/SKILL.md
```

Flowflow 不把仓库内 `.codex/prompts/` 作为命令入口。

如果当前 agent 线程看不到新生成的 skill，重载 workspace 或开启新线程。

## 日常工作流

极简流程：

```text
work -> clarify -> plan -> run -> check -> finish
          ^                         |
          |_________________________|
```

`clarify -> plan -> run -> check` 可以按需反复执行。后续节点发现目标、方案或实现需要调整时，可以回到前面的节点继续补齐。`check` 确认任务可关闭后，再进入 `finish`。

可以通过生成的 skill 调用，也可以直接在 shell 中运行：

```bash
ff-work --root .
ff-clarify --root . --task <task-id>
ff-plan --root . --task <task-id>
ff-run --root . --task <task-id>
ff-check --root . --task <task-id>
ff-finish --root . --task <task-id> --summary "Finished the task"
```

支持命令：

```bash
ff-resume --root . --task <task-id>
ff-discard --root . --task <task-id> --confirm --worktree keep
ff-doctor --root .
ff-understand --root .
```

## Project Baseline

项目级上下文文件位于：

```text
.ff/project/overview.md
.ff/project/architecture.md
.ff/project/rules.md
.ff/project/commands.md
```

这些文件只应在稳定项目事实变化时更新。`ff-understand` 可以把草稿写到 `.ff/understand-draft/`；草稿需要人工审阅，再合并进 `.ff/project/*.md`。

## 常见问题

coding agent 找不到 `ff-work` 时，检查生成 skill 和 npm bin：

```bash
ls .agents/skills/ff-work/SKILL.md
which ff-work
ff doctor --root .
```

生成文件看起来过期时：

```bash
npm run build
node dist/src/cli.js update --root . --harness codex
node dist/src/cli.js doctor --root .
```

忘记命令用途或参数时：

```bash
ff --help
ff doctor --help
ff-resume --help
ff internal accept-spec --help
```
