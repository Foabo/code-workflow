# Spec

## Goal
让 Codex 侧 CW role agents 不再全部使用同一个 `gpt-5.5` / `xhigh` 配置，并让生成的 CW 流程 guidance 在 plan、run、check、finish 等阶段明确说明应调用哪些 `cw-<role>` subagent、何时调用、何时回退 inline。

## Scope
- 调整 `.cw/orchestration.json` 的 Codex harness role overrides，使 `.codex/agents/cw-*.toml` 生成出角色化的 `model` 和 `model_reasoning_effort`。
- 直接刷新 `.codex/agents/` 中六个 Codex subagent 文件，使当前工作区立即可用。
- 更新 `src/adapters.ts` 的生成 guidance，让 `cw-work`、`cw-plan`、`cw-run`、`cw-check`、`cw-finish` 把 role agent 用在具体流程点。
- 保持 role agent 权限边界：advisor/reviewer 只读，planner 只写计划/任务 artifact，implementer/checker 可做受限代码与任务进度更新，baseline-writer 只起草 baseline 当前状态更新。
- 更新测试，证明 Codex role agent 渲染使用角色化模型配置，流程 guidance 包含具体 delegation routing。
- 刷新相关 generated artifacts。

## Non-goals
- 不实现一个新的 subagent runtime、scheduler、常驻 watcher 或后台队列。
- 不让 CLI/kernel 直接调用 LLM。
- 不移除 inline 执行能力。
- 不改变 0013 的 clarify gate/watchdog 设计。

## Constraints
- `.cw/orchestration.json` 是 role model contract 的源头；`.codex/agents/` 是生成结果。
- Codex 自定义 agent 文件可包含 `model` 和 `model_reasoning_effort`；省略字段时会继承父会话，但本任务要显式区分角色配置。
- Codex subagent 只有在主会话明确要求时才会生成，所以 CW guidance 必须明确写出触发点和目标 role。
- 任务推进、需求漂移、finish closure、baseline promotion 仍由主会话负责。

## Decisions
- Codex role model mapping:
  - `cw-advisor`: `gpt-5.5`, `xhigh`，用于阻断级审查和高风险 workflow 判断。
  - `cw-planner`: `gpt-5.5`, `high`，用于 spec 到 plan/task 的结构化拆解。
  - `cw-reviewer`: `gpt-5.5`, `high`，用于 artifact alignment、回归和测试缺口审查。
  - `cw-implementer`: `gpt-5.5`, `medium`，用于受限实现 slice。
  - `cw-checker`: `gpt-5.4-mini`, `medium`，用于验证、证据整理和小范围修复。
  - `cw-baseline-writer`: `gpt-5.4-mini`, `low`，用于低成本 Project Baseline 当前状态草稿。
- `cw-work` 作为路由器，应在 phase 层面选择角色：clarify 用 advisor review；plan 用 planner 后接 reviewer；run 用 implementer；check 用 checker 后接 reviewer；finish 有 baseline delta 时用 baseline-writer。
- Delegation 仍受 harness、工具、权限和任务粒度约束；不可用时必须 inline 完成同一职责。

## Acceptance Criteria
- [x] `.cw/orchestration.json` 的 Codex overrides 不再把所有角色设为同一模型和同一 reasoning effort。
- [x] `.codex/agents/cw-*.toml` 中六个 role agent 的 `model` / `model_reasoning_effort` 与 Decisions 中的 mapping 一致。
- [x] `cw-work` guidance 明确按 phase 路由到 advisor、planner、implementer、checker、reviewer、baseline-writer。
- [x] `cw-plan` guidance 明确 planner subagent 可起草 plan/task，reviewer subagent 做 post-plan cross-review。
- [x] `cw-run` guidance 明确 implementer subagent 用于独立 implementation slice，并说明主会话负责 drift 判断。
- [x] `cw-check` guidance 明确 checker subagent 跑验证与小修，reviewer subagent 做最终广义审查。
- [x] `cw-finish` guidance 明确 baseline-writer subagent 可起草 baseline merge 候选，主会话仍负责确认和 closure。
- [x] 测试覆盖 role-specific Codex model rendering 和 generated workflow guidance 中的 delegation routing。
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
