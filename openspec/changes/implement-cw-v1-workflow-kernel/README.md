# implement-cw-v1-workflow-kernel

这个 OpenSpec change 的目的，是把目前已经讨论并沉淀下来的 CW v1 设计统一成一套可执行的 OpenSpec 产物。

## 背景

CW 是一个面向 coding harness 的 workflow tool。它不替代 Claude Code、Codex、Cursor、OpenCode、Pi 等 coding harness，而是为这些 harness 提供同一套仓库内任务事实、工作流动作、任务状态、项目背景和完成检查机制。

在创建这个 change 之前，项目里已经有几类设计材料：

- `DESIGN.md`：当前 CW v1 的整体设计。
- `CONTEXT.md`：项目术语和领域语言。
- `docs/adr/`：已经确认的架构决策。
- `docs/prd/cw-version-1-workflow-kernel.md`：CW v1 PRD。
- `docs/issues/0001..0014`：从 PRD 拆出来的 14 个 vertical slice issues。

这些材料已经比较完整，但它们分散在不同文件中。这个 change 要做的事情，就是把它们同步成 OpenSpec 的正式工作产物：`proposal.md`、`design.md`、`specs/*/spec.md` 和 `tasks.md`。

## 这个 change 要解决什么

这个 change 的主要职责，是为后续实现 CW v1 workflow kernel 建立清晰、可验证、可跟踪的规格入口。

它要回答：

- CW v1 为什么需要实现？
- 第一版要包含哪些用户可见能力？
- 哪些行为属于规范要求，哪些属于实现细节？
- 14 个 issues 如何映射到 OpenSpec tasks？
- 后续 agent 或人工实现时，应该按什么边界推进？

## 范围

本 change 覆盖 CW v1 的核心工作流能力：

- 初始化 `.cw` Repo Truth。
- 生成 `cw-*` agent commands 和 harness-native entry files。
- 创建、澄清、计划、运行、检查、完成、恢复、丢弃任务。
- 维护 `task.json`、`trace.jsonl`、`spec.md`、`plan.md`、`task.md`。
- 通过 `baseline-delta.md` 在 finish 时同步 Project Baseline。
- 支持 `cw-understand` 生成 existing repo 的 Project Baseline draft。
- 支持 preflight、doctor、dirty worktree handling、Closure Gate。
- 描述 inline / subagent / hybrid 三种 agent execution strategy。
- 明确 optional enhancements，比如 code intelligence、external memory/context detection，只能作为增强，不能成为 Repo Truth。

## 当前产物

本 change 目前包含：

- `proposal.md`：说明为什么要做 CW v1 workflow kernel，以及新增哪些 capability。
- `design.md`：说明实现边界、关键设计决策、风险和取舍。
- `specs/repository-setup/spec.md`：初始化、Project Baseline 模板、增强项配置。
- `specs/task-workflow/spec.md`：任务生命周期、`cw-work`、`cw-clarify`、`cw-plan`、`cw-run`、`cw-check`、`cw-finish`、`cw-resume`、`cw-discard`。
- `specs/project-baseline/spec.md`：Project Baseline、`cw-understand`、`baseline-delta.md`、finish-time sync。
- `specs/harness-invocation/spec.md`：`cw-*` command generation、adapter、public CLI、internal helpers。
- `specs/workflow-health/spec.md`：preflight、doctor、dirty worktree、execution strategy、optional enhancements。
- `tasks.md`：把 14 个 issues 映射成 OpenSpec 可执行任务。

## 为什么目前只有一个 change

目前先使用一个 umbrella change，暂不拆成 14 个 OpenSpec changes。

原因是 14 个 issues 共享同一套核心边界：

- Repo Truth
- task state machine
- task artifacts
- kernel helpers
- command generation
- finish / Closure Gate
- Project Baseline sync
- end-to-end proof

如果现在就拆成很多 change，会增加上下文同步成本。后续如果某一块变大，例如 agent 编排、optional enhancements、isolated worktree、更多 harness adapter，可以再单独拆出新的 OpenSpec change。

## 排除范围

本 change 不直接实现代码。

它也不做：

- 模型路由。
- token / cost 统计。
- provider usage accounting。
- 全局 change inbox。
- touched-file ledger。
- 外部 memory 作为事实源。
- 强制 subagent。
- 强制 codebase index。
- 完整替代 Git 的代码变更记录。

## 验证状态

当前 OpenSpec 产物已经通过 strict validation：

```text
openspec-cn validate implement-cw-v1-workflow-kernel --strict --json
valid: true
failed: 0
```

## 下一步

下一步从 `tasks.md` 的第一组任务开始实现。

推荐推进顺序：

1. 实现 repository setup。
2. 实现 harness command generation。
3. 实现 task creation / clarify / plan。
4. 实现 run / check / finish。
5. 实现 baseline sync、resume、discard、understand、doctor。
6. 最后补完整 v1 end-to-end proof。
