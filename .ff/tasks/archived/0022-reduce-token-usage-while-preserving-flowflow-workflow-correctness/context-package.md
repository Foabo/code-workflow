# Context Package

## Task Brief

- Task: 0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness
- Title: Reduce token usage while preserving Flowflow workflow correctness
- Lifecycle: open
- Phase: finish
- Next action: Run ff-finish: review dirty worktree coverage, baseline delta handling, and close the task.
- Proposal identity: p-be03de4f0abc / be03de4f0abc62b90f16feb0e10553e9f3ceaaf763150c626db5c258f254ba07

## Contract Summary

### Goal

在不削弱 Flowflow 现有工作流正确性的前提下，交付一套完整可用的任务上下文交接能力，减少 advisor、planner、implementer、checker、reviewer 等角色重复读取任务材料、重复整理 git 状态和重复生成审核上下文的 token 消耗。
本任务的第一层目标是让真实 workflow 运行具备可量化的省 token 基础设施：任务上下文包和 review package。预期收益目标采用保守区间：整体 token 消耗在使用角色交接的任务中下降 10%-25%，review/check 相关阶段下降 20%-40%。本任务必须用本地代理指标证明第一层优化确实降低上下文体积：代表性 role handoff 场景的 package 输入估算至少比原始读取路径低 10%，review/check 场景至少低 20%；达不到门槛时不能声称第一层收益已经达成，只能记录为基线数据和未通过风险。同时记录继续逼近 Superpowers 6 文章中 50%-60% 级别优化所需的后续阶段、测量门槛和风险控制。

### Scope

- 增加确定性的任务上下文包生成能力，用于把当前任务的关键材料整理成短、可复用、可检查的 handoff/review package。canonical Markdown 路径为 `.ff/tasks/<task-id>/context-package.md`，输入指纹与生成元数据路径为 `.ff/tasks/<task-id>/context-package.manifest.json`。
- 任务上下文包必须至少覆盖：任务 brief、accepted spec 或当前 Proposed Spec 摘要、验收标准、scope/non-goals/constraints/decisions、相关 Project Baseline 摘要、task state、recent trace 摘要、git status、任务相关 diff 摘要、已运行或待运行验证证据。
- 为不同使用目的提供清晰边界，例如 advisor/planner/implementer/checker/reviewer 可以获得同一事实来源下的不同重点，但不能获得互相矛盾的任务事实。
- 生成逻辑归属 `src/tasks/` 能力，作为任务材料的派生视图；CLI/internal helper 和 workflow guidance 可以调用它，`src/harness/` 只负责在生成 skill 和 role guidance 中消费该能力。
- package 作为 task-local generated cache 通过 canonical path 发现；不强制把它登记为 `task.json.artifacts` 的 core authored artifact，除非实现阶段明确扩展 schema 并更新 validate/doctor 规则。
- 更新生成的 workflow skill 和 role guidance，使角色交接优先使用任务上下文包；当包缺少必要证据时，再按需读取原始 `.ff` 文件、Project Baseline 文件或 git 信息。
- 明确 reviewer/checker 不能只依赖 diff package 作 spec verdict；package 必须包含任务 brief 和验收标准，review 指导必须要求把 diff 与 accepted spec 对照。
- package 必须总是包含完整 `git status --short`。diff 摘要要区分 included、excluded/unrelated、uncertain；出现 uncertain 时，角色必须回到原始 git 信息并在结果中说明不确定性。
- 增加本地量化证据：生成 skill/role guidance 体积、任务上下文包体积、被 package
...

### Non-goals

- 本任务不实现默认模型档位调整、条件模型调度或自动选择更便宜模型。
- 本任务不合并现有 advisor、reviewer、checker 角色职责；后续可以在测量证据充分后单独设计。
- 本任务不接入真实 API billing 或跨 harness 的 token telemetry。
- 本任务不削弱 `ff-clarify` 的 Brainstorm Pass、Grill Loop、advisor review、explicit accept、proposal identity 或 clarify gate。
- 本任务不把 Superpowers 的术语、流程或架构直接搬进 Flowflow；外部经验只作为优化线索。

### Constraints

- `.ff` 仍是 Repo Truth；任务上下文包是派生材料，不能取代 `spec.md`、`plan.md`、`task.md`、`trace.jsonl` 和 Project Baseline。
- 任务上下文包必须由确定性 helper 生成或刷新，不能依赖 agent 手写整理事实。
- 生成 skill 和 role agent 仍由 adapter 渲染；不要把生成产物当成 canonical source 手工修改。
- 任何省 token 指导都不能允许 agent 跳过需求澄清、advisor review、验收标准映射、验证证据或 baseline outcome。
- package 内容要有过期风险控制。manifest/fingerprint 至少覆盖 `spec.md`、`plan.md`、`task.md`、`trace.jsonl`、`task.json`、`.ff/project/overview.md`、`.ff/project/architecture.md`、`.ff/project/rules.md`、`.ff/project/commands.md`、`git status --short` 和 package 使用到的 diff 输入。实现必须能让 agent 判断包是否需要刷新，或在关键输入变化后重新生成。
- 输出应保持简洁、专业、中文优先；用户可见文档避免空泛口号和没有证据的收益承诺。

### Decisions

- 第一阶段实现完整的 context/review package 能力，并把继续逼近 50%-60% 的优化路线图和测量门槛写入验收证据；暂不实现模型调度和合并 reviewer。
- 收益目标采用本地可验证的代理指标和行为探针，不承诺立即达到 Superpowers 6 提到的 50%-60% 总体下降。第一层收益通过本地上下文体积代理指标判断，真实 token telemetry 留给后续阶段。
- role 交接优先使用 package，但 package 不能成为唯一事实来源；缺少 spec brief、验收标准、diff、验证证据或 baseline 摘要时，角色必须回到原始文件读取。
- reviewer/checker 的优化重点是减少重复上下文准备，不降低 verdict 质量。review verdict 必须同时对照任务 contract 和代码/证据。
- 后续路线图必须包含进入下一阶段的条件：第一阶段 package 能稳定生成、行为探针通过、review/check 没有因压缩上下文漏掉需求或证据。

### Acceptance Criteria

- 存在确定性的任务上下文包生成能力，能针对指定 task 生成或刷新 `.ff/tasks/<task-id>/context-package.md` 和 `.ff/tasks/<task-id>/context-package.manifest.json`，并包含任务 brief、验收标准、baseline 摘要、task state、recent trace、完整 `git status --short`、按 included/excluded/uncertain 分类的 diff 摘要和验证证据字段。
- package 生成逻辑有明确能力归属：核心生成在 `src/tasks/`，CLI/internal helper 调用该能力，`src/harness/` 只更新 generated guidance；相关 module boundary 测试或现有架构测试仍通过。
- 生成的 workflow skill 和 role guidance 会指导 agent 在委派或 review/check 前优先读取任务上下文包，并在包缺少关键信息时回退到原始 `.ff` 文件和 git 信息。
- reviewer/checker 指导明确禁止只看 diff 就给出 spec verdict，必须把 diff、任务 brief 和验收标准一起对照。
- 实现包含过期或刷新控制，能避免 package 在 `spec.md`、`plan.md`、`task.md`、`trace.jsonl`、`task.json`、`.ff/project/*.md`、`git status --short` 或 package 使用到的 diff 输入变化后被误当成当前事实。
- 本地代理指标有通过门槛：至少一个代表性 role handoff 场景相对原始读取路径降低 10% 以上，至少一个 review/check 场景降低 20% 以上；如未达成，check 必须记录未通过风险并不得声称第一层收益已达成。
- 测试覆盖 package 生成内容、adapter 输出、关键 helper 或 CLI 行为，以及 clarify/plan/run/check/finish gate 不被新路径绕过。
- Check 阶段记录本地量化证据：相关生成文件体积变化、package 体积、被减少的重复读取路径，以及至少 2-3 个行为探针的期望失败模式、期望行为、review verdict 和残余风险。
- 任务记录中包含后续优化路线图和门槛，覆盖 generated guidance 瘦身、合并重复 review、条件模型/角色调度、真实 token telemetry 或 eval harness。

## Implementation State

### Plan Summary

- 在 `src/tasks/` 增加确定性的 context package 生成能力，读取 task state、`spec.md`、`plan.md`、`task.md`、`trace.jsonl`、Project Baseline、`git status --short` 和 diff 输入，生成 `.ff/tasks/<task-id>/context-package.md` 与 `.ff/tasks/<task-id>/context-package.manifest.json`。
- 从 `src/tasks/index.ts` 暴露 public surface。CLI internal helper 调用这个 surface；`src/harness/` 只更新 generated workflow skill 与 role guidance，不拥有 package 事实生成。
- package 使用同一组任务事实，按用途组织 role handoff 与 review/check 重点；review/check 仍必须对照任务 brief、accepted spec、验收标准、diff 和验证证据。
- manifest 记录输入文件 hash、`git status --short`、diff 输入 hash、生成时间、package 字节数、本地上下文体积代理指标和 stale 判定所需字段。
- 新增 `ff internal refresh-context-package --task <id>` 并更新 `src/cli/help.ts`。helper 应输出生成路径、manifest 路径、stale/refresh 状态和指标摘要。
- 更新 `src/harness/adapters.ts` 后刷新当前仓库的 generated harness artifacts，使角色交接优先刷新或读取 context package；当 package 缺失、stale、关键信息缺失或 diff 存在 uncertain 分类时，指导 agent 回到原始 `.ff` 文件和 git 信息。
- 在测试与 check 阶段分别验证确定性输出、adapter 文案、CLI 行为、模块边界、clarify/advisor/workflow gates，以及本地代理指标门槛。

### Remaining Task Items

- No unchecked task items found.

## Project Baseline Summary

### overview.md

- Flowflow is a repository-scoped workflow kernel for coding agents. It turns development requests into recoverable, verifiable task progress across clarify, plan, run, check, finish, resume, discard, doctor, and understand actions.
- The project is named Flowflow. Its npm package name is `flowflow`, and its GitHub repository is `Foabo/flowflow`.
- The project is named Flowflow. Its npm package name is `flowflow`, and its GitHub repository is `Foabo/flowflow`.
- Flowflow is a repository-scoped workflow kernel for coding agents. It turns development requests into recoverable, verifiable task progress across clarify, plan, run, check, finish, resume, discard, doctor, and understand actions.
- Default repository documentation uses `README.md` in English and `README.zh-CN.md` in Chinese, with links between the two versions.

### architecture.md

- `src/index.ts`, `src/cli.ts`, and `src/agent-command.ts` are root thin entries. Product implementation lives under capability directories.
- Source modules are organized by product capability: `src/cli/`, `src/project/`, `src/workflow/`, `src/tasks/`, `src/baseline/`, `src/harness/`, `src/enhancements/`, `src/domain/`, and `src/shared/`.
- Each product capability exposes its cross-module surface through `src/<capability>/index.ts`.
- `src/domain/` contains shared Flowflow domain types, schema validators, orchestration constants, and pure shared rules.
- `src/shared/` contains business-neutral utilities such as filesystem, JSON, and Git helpers.
- `src/tasks/` owns task ids, task state files, traces, archive layout, resume notes, task selection, and task artifact templates.
- `src/harness/` owns generated skills, role agents, watchdog artifacts, and harness update behavior.
- `src/enhancements/` owns enhancement provider registry, setup planning, setup execution, and setup metadata.
- Cross-capability imports should use the target capability public entry by default. Required deep-import exceptions belong in `tests/architecture/module-boundaries.test.ts` with a narrow allowlist and
...

### rules.md

- Keep root source entries thin. Do not add product logic to `src/index.ts`, `src/cli.ts`, or `src/agent-command.ts`.
- Do not add business rules to `src/shared/`.
- Do not let `src/domain/` import product capability modules.
- Tests are organized by product capability under `tests/<capability>/`.
- Shared test helpers live under `tests/support/` and should not import concrete test suites.
- Module boundary rules are enforced by `tests/architecture/module-boundaries.test.ts`.
- Every task must record a Baseline Outcome before finish. The outcome is either a task-local `baseline-delta.md`, a note that no reusable project facts were found, or a note that candidate facts are not stable enough yet.
- Clarify and plan may capture reusable project facts as task-local candidates, but check owns the final Baseline Outcome before finish.
- Generated workflow skill trigger text describes the Flowflow workflow action and accepted invocation forms. It must not bind the trigger condition to a host name such as Codex, Claude, OpenCode, Pi, or Cursor.
- Finish actively consumes an ordinary `baseline-delta.md` by default. Accepted merges all delta sections into existing Project Baseline files, sel
...

### commands.md

- `npm test` clears `dist`, builds the project, then runs every compiled nested test file under `dist/tests`.
- Generate or refresh Codex repo-local skills with `ff update --harness codex`.
- Verify adapter behavior with `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, and `node dist/src/cli.js doctor --root .`.
- `ff internal validate-clarify --stage proposal|accept|advance` validates clarify event order, proposal identity, advisor review or degraded execution evidence, and explicit accept.
- `ff internal propose-spec --task <id> --spec-file <path>` — hashes the spec file, appends `brainstorm.done` + `spec.proposed` with identity, returns the identity.
- `ff internal accept-spec --task <id> (--verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>)` — auto-binds the latest proposal identity, appends `advisor.reviewed`|`advisor.unavailable` + `spec.accepted(explicit:true)`.
- `ff update --harness <codex|claude|opencode|pi|cursor>` refreshes generated skil
...

## Recent Trace

- 2026-07-09T12:51:47.547Z plan.reviewed: Post-plan artifact cross-review concerns resolved: behavior probes require verdict and residual risk; dirty worktree facts refresh at run/check.
- 2026-07-09T12:51:51.434Z task.state.updated: phase plan -> run; next action updated
- 2026-07-09T13:03:37.482Z baseline_delta.created: Baseline delta created.
- 2026-07-09T13:05:11.900Z run.updated: Implemented context package generation, refresh helper, generated guidance updates, metrics, tests, and baseline delta; ready for check.
- 2026-07-09T13:05:11.931Z task.state.updated: phase run -> check; next action updated
- 2026-07-09T13:14:18.453Z check.passed: Check passed: acceptance criteria covered, metrics thresholds exceeded, behavior probes passed, baseline delta recorded, and dirty worktree classified as in-scope.
- 2026-07-09T13:14:18.483Z task.state.updated: phase check -> finish; next action updated
- 2026-07-09T13:20:50.033Z baseline_delta.synced: Baseline delta synced to .ff/project/architecture.md, .ff/project/rules.md, .ff/project/commands.md.

## Git Status

```text
 M .agents/skills/ff-check/SKILL.md
 M .agents/skills/ff-clarify/SKILL.md
 M .agents/skills/ff-discard/SKILL.md
 M .agents/skills/ff-doctor/SKILL.md
 M .agents/skills/ff-finish/SKILL.md
 M .agents/skills/ff-plan/SKILL.md
 M .agents/skills/ff-resume/SKILL.md
 M .agents/skills/ff-run/SKILL.md
 M .agents/skills/ff-understand/SKILL.md
 M .agents/skills/ff-work/SKILL.md
 M .claude/agents/ff-advisor.md
 M .claude/agents/ff-baseline-writer.md
 M .claude/agents/ff-checker.md
 M .claude/agents/ff-implementer.md
 M .claude/agents/ff-planner.md
 M .claude/agents/ff-reviewer.md
 M .claude/skills/ff-check/SKILL.md
 M .claude/skills/ff-clarify/SKILL.md
 M .claude/skills/ff-discard/SKILL.md
 M .claude/skills/ff-doctor/SKILL.md
 M .claude/skills/ff-finish/SKILL.md
 M .claude/skills/ff-plan/SKILL.md
 M .claude/skills/ff-resume/SKILL.md
 M .claude/skills/ff-run/SKILL.md
 M .claude/skills/ff-understand/SKILL.md
 M .claude/skills/ff-work/SKILL.md
 M .codex/agents/ff-advisor.toml
 M .codex/agents/ff-baseline-writer.toml
 M .codex/agents/ff-checker.toml
 M .codex/agents/ff-implementer.toml
 M .codex/agents/ff-planner.toml
 M .codex/agents/ff-reviewer.toml
 M .cursor/agents/ff-advisor.md
 M .cursor/agents/ff-baseline-writer.md
 M .cursor/agents/ff-checker.md
 M .cursor/agents/ff-implementer.md
 M .cursor/agents/ff-planner.md
 M .cursor/agents/ff-reviewer.md
 M .ff/project/architecture.md
 M .ff/project/commands.md
 M .ff/project/rules.md
?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/baseline-delta.md
?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/context-package.manifest.json
?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/context-package.md
?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/plan.md
?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/spec.md
?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/task.json
?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/task.md
?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/trace.jsonl
 M .opencode/agents/ff-advisor.md
 M .opencode/agents/ff-baseline-writer.md
 M .opencode/agents/ff-checker.md
 M .opencode/agents/ff-implementer.md
 M .opencode/agents/ff-planner.md
 M .opencode/agents/ff-reviewer.md
 M .pi/agents/ff-advisor.md
 M .pi/agents/ff-baseline-writer.md
 M .pi/agents/ff-checker.md
 M .pi/agents/ff-implementer.md
 M .pi/agents/ff-planner.md
 M .pi/agents/ff-reviewer.md
 M src/cli/help.ts
 M src/cli/index.ts
 M src/harness/adapters.ts
?? src/tasks/context-package.ts
 M src/tasks/index.ts
 M tests/cli/help.test.ts
 M tests/harness/harness.test.ts
 M tests/support/kernel.ts
 M tests/tasks/tasks.test.ts
```

## Diff Classification

### Included

- Rule: current task artifact or generated package
- ?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/baseline-delta.md
- ?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/context-package.manifest.json
- ?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/context-package.md
- ?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/plan.md
- ?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/spec.md
- ?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/task.json
- ?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/task.md
- ?? .ff/tasks/0022-reduce-token-usage-while-preserving-flowflow-workflow-correctness/trace.jsonl

### Excluded Or Unrelated

- None.

### Uncertain

- Rule: outside the current task path; read original git diff before verdict
- M .agents/skills/ff-check/SKILL.md
- M .agents/skills/ff-clarify/SKILL.md
- M .agents/skills/ff-discard/SKILL.md
- M .agents/skills/ff-doctor/SKILL.md
- M .agents/skills/ff-finish/SKILL.md
- M .agents/skills/ff-plan/SKILL.md
- M .agents/skills/ff-resume/SKILL.md
- M .agents/skills/ff-run/SKILL.md
- M .agents/skills/ff-understand/SKILL.md
- M .agents/skills/ff-work/SKILL.md
- M .claude/agents/ff-advisor.md
- M .claude/agents/ff-baseline-writer.md
- M .claude/agents/ff-checker.md
- M .claude/agents/ff-implementer.md
- M .claude/agents/ff-planner.md
- M .claude/agents/ff-reviewer.md
- M .claude/skills/ff-check/SKILL.md
- M .claude/skills/ff-clarify/SKILL.md
- M .claude/skills/ff-discard/SKILL.md
- M .claude/skills/ff-doctor/SKILL.md
- M .claude/skills/ff-finish/SKILL.md
- M .claude/skills/ff-plan/SKILL.md
- M .claude/skills/ff-resume/SKILL.md
- M .claude/skills/ff-run/SKILL.md
- M .claude/skills/ff-understand/SKILL.md
- M .claude/skills/ff-work/SKILL.md
- M .codex/agents/ff-advisor.toml
- M .codex/agents/ff-baseline-writer.toml
- M .codex/agents/ff-checker.toml
- M .codex/agents/ff-implementer.toml
- M .codex/agents/ff-planner.toml
- M .codex/agents/ff-reviewer.toml
- M .cursor/agents/ff-advisor.md
- M .cursor/agents/ff-baseline-writer.md
- M .cursor/agents/ff-checker.md
- M .cursor/agents/ff-implementer.md
- M .cursor/agents/ff-planner.md
- M .cursor/agents/ff-reviewer.md
- M .ff/project/architecture.md
- M .ff/project/commands.md
- M .ff/project/rules.md
- M .opencode/agents/ff-advisor.md
- M .opencode/agents/ff-baseline-writer.md
- M .opencode/agents/ff-checker.md
- M .opencode/agents/ff-implementer.md
- M .opencode/agents/ff-planner.md
- M .opencode/agents/ff-reviewer.md
- M .pi/agents/ff-advisor.md
- M .pi/agents/ff-baseline-writer.md
- M .pi/agents/ff-checker.md
- M .pi/agents/ff-implementer.md
- M .pi/agents/ff-planner.md
- M .pi/agents/ff-reviewer.md
- M src/cli/help.ts
- M src/cli/index.ts
- M src/harness/adapters.ts
- ?? src/tasks/context-package.ts
- M src/tasks/index.ts
- M tests/cli/help.test.ts
- M tests/harness/harness.test.ts
- M tests/support/kernel.ts
- M tests/tasks/tasks.test.ts

Uncertain entries require reading the original git status and diff before making a verdict.

## Review And Check Instructions

- Do not give a spec verdict from diff summary alone.
- Compare diff, task brief, accepted spec, acceptance criteria, and verification evidence together.
- If this package is missing required sections, stale, or has uncertain diff entries, read the original .ff files and git information before deciding.
- Clarify/advisor review must use the current spec.md and proposal identity; this package is only navigation material.

## Metrics

- Package bytes: 22158
- Role handoff raw bytes: 42191
- Role handoff savings percent: 47.48
- Review/check raw bytes: 48222
- Review/check savings percent: 54.05
