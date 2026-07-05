# CW 设计说明

CW 是面向 coding harness 的工作流工具。它给一个仓库提供共享的任务事实、agent 原生工作流动作、简洁的项目基线文件，以及可预测的 helper 操作，让 Claude Code、Codex、Cursor、OpenCode、Pi 等工具可以沿用同一套开发流程。CW 不试图把这些工具统一成一个大型 harness 管理器。

## 目标

CW 帮助 coding agent 把一个模糊请求推进到可负责地完成任务，中间不丢失任务约定、实现计划、验证状态和可复用的项目知识。

产品重点放在两件事上：任务推进质量和上下文效率。

- 任务事实需要能跨会话、跨 coding harness 恢复。
- 用户日常应主要通过 agent 命令工作，CLI 保持轻量。
- 文件要足够小，便于 agent 读取，也便于人维护。
- 任务 spec 可以在真实开发过程中演进。
- 稳定的任务经验只在 finish 阶段提升到项目基线。
- 代码改动仍然以 Git 为准。

## 非目标

CW 不承担这些职责：

- 替代 Claude Code、Codex、Cursor、OpenCode、Pi 等 coding harness。
- 把模型路由做成核心功能。
- 记录 token、费用或 provider 账本。
- 在 Git 之外维护另一套代码改动账本。
- 保存原始聊天记录或完整终端日志。
- 强依赖外部记忆、代码智能工具或 spec 框架。
- 要求每个任务都写很多大型文档。

Trellis、OpenSpec、Superpowers、GSD、Gentle-AI、Oh My OpenCode Slim 等框架可以作为参考，影响 adapter 或启发式规则，但不能定义 CW 的运行时和 `.cw` 标准格式。

## 调用模型

日常使用发生在 coding harness 原生的 agent 命令里。生成的 agent 命令统一使用 `cw-` 前缀，避免和其他插件或命令冲突：

```text
cw-work
cw-clarify
cw-plan
cw-run
cw-check
cw-finish
cw-resume
cw-discard
cw-doctor
cw-understand
```

公开 CLI 聚焦初始化、诊断、更新和校验：

```text
cw init
cw doctor
cw update
cw validate
```

确定性的状态修改放在 internal helper 后面：

```text
cw internal ...
```

agent 命令负责判断意图和编辑 Markdown。kernel helper 负责校验结构、追加 trace、更新 task state、消费 resume note，并在可行时提供更稳的状态变更边界。

## 仓库结构

```text
.cw/
  version.json

  project/
    overview.md
    architecture.md
    rules.md
    commands.md

  tasks/
    <task-id>/
      task.json
      trace.jsonl
      spec.md
      plan.md
      task.md
      baseline-delta.md  # 可选
      resume.md          # 可选，由用户触发，使用后消费

  templates/
    spec.md
    plan.md
    task.md
    baseline-delta.md
    resume.md
```

Git 仍然是代码改动的事实来源。CW 只保存工作流状态、任务意图、计划、清单进度和项目基线知识。

## Project Baseline

Project Baseline 是仓库级的稳定知识，供多个任务复用：

- `overview.md`：项目目的、当前形态、主要能力、重要非目标。
- `architecture.md`：技术栈、模块、数据流、集成点、架构约束。
- `rules.md`：编码规则、测试规则、review 规则、agent 规则、禁止事项。
- `commands.md`：安装、运行、测试、lint、typecheck、build、排障命令。

`cw init` 只创建简短模板，不会在初始化时尝试完整理解一个新项目。

新项目的常见路径：

```text
cw init -> cw-work
```

已有项目的常见路径：

```text
cw init -> cw-understand -> cw-work
```

`cw-understand` 先写草稿，再由用户确认哪些内容合并进 `.cw/project/*`。自动扫描结果不能直接覆盖 Project Baseline。

## Task State

每个任务都有一个机器可读的 `task.json` 和一个只追加的 `trace.jsonl`。

`task.json` 的最小形态：

```json
{
  "id": "task-auth-rate-limit",
  "title": "Add auth rate limiting",
  "lifecycle": "open",
  "phase": "clarify",
  "next_action": "Clarify rate-limit identity and acceptance criteria",
  "health_flags": [],
  "artifacts": {
    "spec": "spec.md",
    "plan": "plan.md",
    "task": "task.md",
    "baseline_delta": null,
    "resume": null
  },
  "invalidated_artifacts": [],
  "blocked_reason": null,
  "parked_reason": null,
  "resume_condition": null,
  "created_at": "2026-07-03T10:00:00+08:00",
  "updated_at": "2026-07-03T10:00:00+08:00",
  "schema_version": 1
}
```

任务没有 `ready` 状态，也没有 `result` 字段。

Lifecycle 取值：

- `open`：任务可以开始或继续推进。
- `blocked`：缺少必要条件，继续推进会不负责任。
- `parked`：用户有意暂停，doctor 不应把它当作异常。
- `closed`：任务已经完成。

`discard` 不是 lifecycle。它是维护动作，用于在处理 worktree 后删除废弃任务记录。

`trace.jsonl` 是按时间追加的事件历史：

```jsonl
{"ts":"2026-07-03T10:15:00+08:00","type":"spec.accepted","summary":"Task spec accepted by user."}
{"ts":"2026-07-03T10:32:00+08:00","type":"plan.updated","summary":"Plan and checklist created from accepted spec."}
{"ts":"2026-07-03T11:10:00+08:00","type":"check.passed","summary":"Tests passed and checklist review completed."}
```

helper 负责追加 trace event。trace 写错时，追加一个修正事件，不回写旧历史。

## Task Artifacts

v1 的任务文档刻意保持简短。

### `spec.md`

任务约定。澄清、实现、检查或漂移处理改变任务约定时，它可以更新。

建议结构：

```md
# Spec

## Goal

## Scope

## Non-goals

## Constraints

## Decisions

## Acceptance Criteria
- [ ] ...
```

### `plan.md`

实现思路，不承担 checklist 的职责。

建议结构：

```md
# Plan

## Approach

## Key Decisions

## Risks

## Validation Strategy
```

### `task.md`

可执行清单。finish 是否可以通过，依赖这个文件是否准确。

建议结构：

```md
# Task

## Implementation
- [ ] ...

## Verification
- [ ] ...

## Check
- [ ] Acceptance criteria in spec.md are covered.
- [ ] No unresolved drift between implementation and spec.
- [ ] Dirty worktree handling is clear.

## Notes
```

### `baseline-delta.md`

任务级的候选 Project Baseline 更新。finish 同步前，它还不是项目事实。

建议结构：

```md
# Baseline Delta

## overview.md

## architecture.md

## rules.md

## commands.md
```

### `resume.md`

由用户触发的继续工作笔记。每个任务最多有一个当前 `resume.md`。只有用户运行 `cw-resume` 或明确要求从 resume 继续时才读取。后续第一个成功记录进展的工作流动作会删除它。

## 工作流动作

### `cw-work`

默认的任务推进动作。

它可以：

- 创建或选择任务。
- 运行 preflight。
- 澄清需求并更新 `spec.md`。
- 更新 `plan.md` 和 `task.md`。
- 执行下一个 checklist 项。
- 运行 `cw-check`。

check 通过后，`cw-work` 会停下来，询问是否运行 `cw-finish`。

### `cw-clarify`

澄清任务并更新 `spec.md`。它不写代码，不更新 Project Baseline，也不创建实现 checklist。用户接受当前任务 spec 后，clarify 完成。必要信息缺失时，任务进入 `blocked`，并写清楚 `blocked_reason` 和 `next_action`。

### `cw-plan`

读取 `spec.md` 和相关 Project Baseline，然后更新：

- `plan.md`
- `task.md`

它不写实现代码。spec 还不清楚时，回到 `cw-clarify` 或阻塞任务。

### `cw-run`

执行 `task.md` 里合适的下一个 checklist 项。它读取 `spec.md`、`plan.md` 和 `task.md`，修改代码，更新 checklist 状态，并追加 trace event。

### `cw-check`

把验证和 review 放在同一个动作里。它可以运行测试、lint、typecheck 或手工检查，同时确认：

- 实现满足 `spec.md`。
- 代码路径仍然符合当前有效的 `plan.md`。
- `task.md` 准确反映实现、验证和检查进度。
- 没有未处理的漂移。

发现漂移时，需要先更新或请求更新 `spec.md`、`plan.md`、`task.md`，然后才能 finish。

### `cw-finish`

完成任务。它运行 Closure Gate，处理 dirty worktree，同步已确认的 baseline delta，删除已消费的 `resume.md`，最后把 `lifecycle` 设为 `closed`。

CW 没有单独的 close 或 archive 动作。

### `cw-resume`

当用户明确要求从 `resume.md` 继续时，读取任务级 resume note。resume note 不是主要恢复机制；正常恢复依赖 `task.json`、`trace.jsonl` 和任务文档。

### `cw-discard`

放弃任务，删除任务记录，并处理代码改动：

- 任务使用独立 Git worktree 时，可以在确认后删除该 worktree。
- 任务共享当前 worktree 时，需要询问未提交改动是保留、回滚还是 stash。

discard 不会产生 closed task。

### `cw-doctor`

手动运行的仓库级工作流健康检查。

它检查的问题包括：

- `.cw` 文件格式错误
- 过期或阻塞的任务
- 缺少 `next_action`
- closed 任务仍有 `resume.md`
- schema version 不匹配
- 缺少 Project Baseline 文件
- dirty worktree 风险
- 生成的 harness 入口文件过期

action-local 自动检查由 preflight 负责。`cw-doctor` 用于更宽的人工诊断。

### `cw-understand`

可选的已有仓库理解动作。它先写草稿，再由用户确认哪些内容合并进 Project Baseline。新项目不需要先运行它。

## Agent 编排

Agent 编排属于执行策略层。它可以改善分工、复核和长任务推进，但工作流语义仍由 `cw-*` 命令、`.cw` 文件和 kernel helper 决定。agent 编排不得直接写入 task state；状态变化必须经过现有 helper。

CW 支持三种执行策略：

- `inline`：主会话完成所有工作流动作。
- `subagent`：某些动作交给角色化 agent。
- `hybrid`：主会话负责协调，支持时把实现、复核或检查交给角色化 agent。

默认推荐 `hybrid`。`inline` 必须完整可用，因为有些 coding harness 没有稳定的 subagent、hook 或 watcher 能力。

默认角色集：

- `advisor`：默认启用的只读审查者。它观察主会话的近期变化、任务文档和必要代码，输出 `nit`、`concern` 或 `blocker` 级别建议。它不能直接询问用户，不能接受 spec，不能移动 phase，不能改文件，不能关闭任务。
- `planner`：把已接受的 `spec.md` 转成 `plan.md` 和 `task.md`，并做计划后交叉检查。它不能修改 spec。
- `implementer`：执行 `task.md` 的实现 checklist，可以改代码和测试，可以更新 task.md 进度，但不能判定需求漂移或关闭任务。
- `reviewer`：独立检查 artifact alignment、实现证据、回归风险和测试缺口。默认只读。
- `checker`：运行验证、修复不改变 spec 的小问题，并把证据记录到 `task.md`。
- `baseline-writer`：在 finish 阶段为已接受的 `baseline-delta.md` 起草 Project Baseline 当前状态更新。它不能绕过用户确认。

`clarifier` 不作为默认独立角色。澄清需要主会话直接和用户交互；advisor 可以参与 `cw-clarify`，但职责是从旁审查 Proposed Spec 是否遗漏动机、边界、验收标准、风险或更短路径。advisor 的发现回到主会话，由主会话决定是否继续询问用户。

Advisor 采用 OMP 风格：

- 默认启用，配置位于 `.cw/orchestration.json`。
- 支持 `off`、`manual`、`gate`、`high-risk`、`always-on` 模式，默认 `always-on`。
- 支持 bounded backlog，默认只同步最近 2 个主会话变化片段。
- 输出 severity：`nit` 表示小改进，`concern` 表示需要主会话判断，`blocker` 表示继续前必须处理。
- 有 emission guard：相同问题应合并，低价值建议应降噪。
- advisor 只给主会话建议，不拥有用户交互权和状态推进权。

`cw-clarify` 额外有确定性 gate。标准顺序是：

1. Brainstorm Pass：复述目标和动机，给出最多 3 个方向，推荐最小路径，列出假设、风险、验收证据，并产出 Open Decisions。
2. Grill Loop：围绕 Open Decisions 和高风险假设继续追问，直到用户确认关键取舍。
3. Proposed Spec：主会话生成当前 proposal，并用 `attempt_id`、`proposal_id` 和 proposal hash 写入 trace。
4. advisor review：advisor 审查当前 Proposed Spec。旧 proposal 的 review 不可复用。
5. concern/blocker handling：concern 必须修正、带理由延后，或由用户明确接受风险；blocker 必须修正后复审，或记录用户明确 override。
6. explicit accept：用户接受当前 proposal 后，trace 写入 `spec.accepted`。
7. write `spec.md`：只有 deterministic clarify gate 通过后，才写入 `spec.md` 并推进 plan。

clarify gate 是本地纯校验，不调用模型。它读取 task state、`trace.jsonl` 和 proposal identity，检查 `brainstorm.done`、`spec.proposed`、`advisor.reviewed` 或 `advisor.unavailable`、`spec.accepted` 的顺序、freshness 和身份一致性。`advisor.unavailable` 是降级执行，必须记录 attempted invocation、harness、failure reason、timestamp 和 fallback checklist result。

支持本地 hook 的 harness 会生成 local watchdog artifact。watchdog 只调用 `cw internal validate-clarify --watchdog`，不复制 gate 逻辑。write `spec.md`、推进 plan、或通过 accept gate 前，validator 失败必须阻断；中间 clarify 状态可以只提醒。

编排配置：

```json
{
  "schema_version": 1,
  "advisor": {
    "enabled_by_default": true,
    "mode": "always-on",
    "sync_backlog": 2,
    "severity_levels": ["nit", "concern", "blocker"]
  },
  "roles": {
    "advisor": { "capability_tier": "high-reasoning", "model": null, "reasoning_effort": "high", "temperature": 0.1, "notes": [] },
    "planner": { "capability_tier": "high-reasoning", "model": null, "reasoning_effort": "high", "temperature": 0.1, "notes": [] },
    "implementer": { "capability_tier": "balanced", "model": null, "reasoning_effort": "medium", "temperature": 0.2, "notes": [] },
    "reviewer": { "capability_tier": "review", "model": null, "reasoning_effort": "high", "temperature": 0.1, "notes": [] },
    "checker": { "capability_tier": "balanced", "model": null, "reasoning_effort": "medium", "temperature": 0.2, "notes": [] },
    "baseline-writer": { "capability_tier": "fast", "model": null, "reasoning_effort": "low", "temperature": 0.1, "notes": [] }
  },
  "harness_overrides": {
    "codex": {},
    "claude": {},
    "opencode": {},
    "pi": {},
    "cursor": {}
  },
  "updated_at": "2026-07-05T00:00:00.000Z"
}
```

模型选择规则：

- 角色先声明能力需求：`capability_tier`、`reasoning_effort`、可选 `model`。
- `reasoning_effort` 的 CW 标准值为 `none`、`low`、`medium`、`high`、`xhigh`、`auto`，也可以为 `null` 表示继承平台默认值。`minimal` 当前不进入 CW 标准 schema。
- 平台 adapter 生成的 agent 文件默认继承平台模型，除非 `.cw/orchestration.json` 提供角色默认值或平台覆盖值。
- 用户可以在 `.cw/orchestration.json` 的 `roles.<role>.model` 设置跨平台默认模型。
- `temperature` 采用 OpenCode/OMO-slim 风格，合法范围为 `0` 到 `2`，也可以为 `null` 表示继承平台默认值。默认值保持保守：advisor、planner、reviewer、baseline-writer 为 `0.1`，implementer、checker 为 `0.2`。
- 用户可以在 `harness_overrides.<harness>.<role>.model`、`harness_overrides.<harness>.<role>.reasoning_effort` 和 `harness_overrides.<harness>.<role>.temperature` 设置平台级覆盖。最终渲染时按内置角色默认、`roles.<role>`、`harness_overrides.<harness>.<role>` 的顺序合并。
- 平台自身配置优先级仍由平台负责。CW 只生成角色契约和建议默认值。
- advisor、planner、reviewer 默认需要更强推理；implementer、checker 默认需要可靠工具使用；baseline-writer 默认需要低成本、精确改写能力。

支持 harness：

- Claude Code：生成 `.claude/skills/<cw-command>/SKILL.md` 和 `.claude/agents/cw-<role>.md`。
- Codex：生成 `.agents/skills/<cw-command>/SKILL.md` 和 `.codex/agents/cw-<role>.toml`。Codex role agent 使用多行 TOML `developer_instructions`，并在解析后模型非空时写入 `model`，推理 effort 非空时写入 `model_reasoning_effort`。
- OpenCode：生成 `.agents/skills/<cw-command>/SKILL.md` 和 `.opencode/agents/cw-<role>.md`。OpenCode agent 使用项目级 Markdown agent frontmatter：`description`、`mode: subagent`、`model`、可选 `temperature`，以及 `tools.write/edit/bash` 权限。
- Pi：生成 `.agents/skills/<cw-command>/SKILL.md` 和 `.pi/agents/cw-<role>.md`。`cw init --harness pi` 默认执行 `pi install npm:pi-subagents`；用户可以用 `--pi-subagents skipped` 显式跳过。`cw update --harness pi` 只刷新生成文件，不执行安装。
- Cursor：生成 `.agents/skills/<cw-command>/SKILL.md` 和 `.cursor/agents/cw-<role>.md`。

通用规则：

- subagent 接收构造好的上下文，包含 task artifacts、相关 Project Baseline、必要代码和明确角色边界。
- subagent 不接收完整聊天历史。
- 外部记忆和平台记忆不能作为 Repo Truth。
- spec 漂移、产品行为变化、破坏性 worktree 处理、Baseline sync 都必须回到主会话并经过用户确认。
- subagent 不可用、失败、权限不足或配置关闭时，命令继续 inline 执行。

## Preflight

Preflight 是动作本地的快速检查，不是完整 doctor。

它在这些关键动作前运行：

- `cw-work`
- `cw-run`
- `cw-check`
- `cw-finish`
- `cw-resume`
- `cw-discard`

它可以检查：

- task state
- 缺失或无效的 artifact
- 过期的 `resume.md`
- lifecycle 和 phase 是否一致
- dirty Git worktree
- 明显的漂移风险

支持 hook 的 harness 可以通过 hook 提高新鲜度。跨 harness 的可靠机制仍然是 preflight。

## Finish 和 Closure Gate

`cw-finish` 是正常关闭任务的唯一路径。

Closure Gate 检查：

- 任务 lifecycle 和 phase 可 finish。
- `spec.md` 的 acceptance criteria 已覆盖。
- `task.md` 的实现、验证和检查项足够完整。
- 没有未解决的漂移。
- dirty worktree 状态已经处理。
- baseline delta 已接受、编辑或跳过。

Dirty worktree 处理：

- dirty worktree 属于当前任务实现时，只有 check 覆盖当前 diff 后才可以 finish。
- dirty worktree 属于无关改动时，finish 流程需要明确承认它不属于当前任务。
- 关系不清楚时，finish 阻塞，直到用户或 agent 清理、提交、stash，或解释清楚 worktree 状态。

## Baseline Sync

Project Baseline 只通过两个动作更新：

- `cw-understand`
- `cw-finish`

任务进行中，候选项目事实写入 `baseline-delta.md`。finish 阶段的流程：

1. CW 预览 baseline delta。
2. 用户确认、选择、编辑或跳过。
3. agent 语义编辑 `.cw/project/*`。
4. helper 校验并追加 trace event。
5. 任务关闭。

v1 不自动应用 baseline delta。架构变化、产品能力变化、冲突、删除或低置信度编辑等高影响更新，需要明确确认。

## Init

`cw init` 创建：

- `.cw/version.json`
- 简短的 Project Baseline 模板
- `.cw/tasks/`
- `.cw/templates/`
- 选定 coding harness 的入口文件和 agent commands

它会询问：

1. 要生成哪些 coding harness 入口。
2. 是否配置代码智能增强。
3. 是否检测外部记忆或上下文工具。

增强项都可以跳过。没有这些增强，CW 仍然完整可用。

`cw init` 不会：

- 生成完整 Project Baseline
- 自动运行 `cw-understand`
- 询问模型路由
- 询问 token 账本
- 要求用户选择 subagent pack
- 创建必需的 bootstrap task

## Platform Adapters

CW 会为选定的 coding harness 生成原生文件，不强制所有 harness 共用同一种 frontmatter 格式。

adapter 必须表达这些事实：

- `.cw` 是 repo truth。
- `cw-*` 命令是工作流入口。
- agent 命令应通过 kernel helper 做确定性的状态修改。
- 实现前需要读取 Project Baseline 和任务文档。
- 外部记忆不能作为 repo truth。

生成的 platform 文件是入口，不是事实来源。

## Optional Enhancements

可选代码智能工具可以辅助项目理解和任务规划，例如 codebase-memory-mcp、CodeGraph、LSP 或 harness 自带搜索。

可选记忆和上下文工具可以被检测并提示。它们可以为一次会话提供参考，但不能覆盖 Project Baseline、task state 或 task artifacts。

## 实现技术栈

CW v1 使用 TypeScript 和 Node.js 实现。

推荐技术栈：

- TypeScript：workflow kernel、CLI、adapter generation、schema 和 helper。
- Node.js runtime 和 npm package distribution。
- 公开 `cw` CLI，以及用于确定性状态修改的 `cw internal ...` helper。
- Vitest 或等价的 TypeScript test runner。
- Zod 或 JSON Schema，用于校验 `.cw/version.json` 和 task state。
- 保守的 Markdown 编辑 helper，用于模板、任务文档和 Project Baseline。
- 通过 shell 调用 Git；代码改动仍以 Git 为事实来源。

## v1 完成标准

用户应当可以完成这些动作：

1. 运行 `cw init`，生成至少一个 harness 入口。
2. 用 `cw-work` 开始新任务。
3. 用 `cw-clarify` 生成已接受的 `spec.md`。
4. 用 `cw-plan` 创建 `plan.md` 和 `task.md`。
5. 用 `cw-run` 实现 checklist 项。
6. 用 `cw-check` 按任务约定验证和 review。
7. 用 `cw-finish` 通过 Closure Gate 关闭任务。
8. 用 `cw-resume` 处理用户触发的继续工作笔记。
9. 用 `cw-discard` 安全放弃任务。
10. 用 `cw-understand` 为已有仓库生成 Project Baseline 草稿。
11. 用 `cw-doctor` 检查仓库工作流健康状态。
12. 在 finish 阶段通过 `baseline-delta.md` 提升稳定任务经验。

没有外部代码智能、外部记忆、hook、独立 worktree 或 subagent 支持时，工作流仍然应当可用。
