# Spec

## Goal

在不削弱 Flowflow 现有工作流正确性的前提下，交付一套完整可用的任务上下文交接能力，减少 advisor、planner、implementer、checker、reviewer 等角色重复读取任务材料、重复整理 git 状态和重复生成审核上下文的 token 消耗。

本任务的第一层目标是让真实 workflow 运行具备可量化的省 token 基础设施：任务上下文包和 review package。预期收益目标采用保守区间：整体 token 消耗在使用角色交接的任务中下降 10%-25%，review/check 相关阶段下降 20%-40%。本任务必须用本地代理指标证明第一层优化确实降低上下文体积：代表性 role handoff 场景的 package 输入估算至少比原始读取路径低 10%，review/check 场景至少低 20%；达不到门槛时不能声称第一层收益已经达成，只能记录为基线数据和未通过风险。同时记录继续逼近 Superpowers 6 文章中 50%-60% 级别优化所需的后续阶段、测量门槛和风险控制。

## Scope

- 增加确定性的任务上下文包生成能力，用于把当前任务的关键材料整理成短、可复用、可检查的 handoff/review package。canonical Markdown 路径为 `.ff/tasks/<task-id>/context-package.md`，输入指纹与生成元数据路径为 `.ff/tasks/<task-id>/context-package.manifest.json`。
- 任务上下文包必须至少覆盖：任务 brief、accepted spec 或当前 Proposed Spec 摘要、验收标准、scope/non-goals/constraints/decisions、相关 Project Baseline 摘要、task state、recent trace 摘要、git status、任务相关 diff 摘要、已运行或待运行验证证据。
- 为不同使用目的提供清晰边界，例如 advisor/planner/implementer/checker/reviewer 可以获得同一事实来源下的不同重点，但不能获得互相矛盾的任务事实。
- 生成逻辑归属 `src/tasks/` 能力，作为任务材料的派生视图；CLI/internal helper 和 workflow guidance 可以调用它，`src/harness/` 只负责在生成 skill 和 role guidance 中消费该能力。
- package 作为 task-local generated cache 通过 canonical path 发现；不强制把它登记为 `task.json.artifacts` 的 core authored artifact，除非实现阶段明确扩展 schema 并更新 validate/doctor 规则。
- 更新生成的 workflow skill 和 role guidance，使角色交接优先使用任务上下文包；当包缺少必要证据时，再按需读取原始 `.ff` 文件、Project Baseline 文件或 git 信息。
- 明确 reviewer/checker 不能只依赖 diff package 作 spec verdict；package 必须包含任务 brief 和验收标准，review 指导必须要求把 diff 与 accepted spec 对照。
- package 必须总是包含完整 `git status --short`。diff 摘要要区分 included、excluded/unrelated、uncertain；出现 uncertain 时，角色必须回到原始 git 信息并在结果中说明不确定性。
- 增加本地量化证据：生成 skill/role guidance 体积、任务上下文包体积、被 package 替代的常见读取路径、至少 2-3 个行为探针。
- 记录继续逼近 50%-60% token 优化的路线图和进入下一阶段的门槛，包括但不限于 generated guidance 瘦身、合并重复 review、条件模型/角色调度、真实 token telemetry 或 eval harness。

## Non-goals

- 本任务不实现默认模型档位调整、条件模型调度或自动选择更便宜模型。
- 本任务不合并现有 advisor、reviewer、checker 角色职责；后续可以在测量证据充分后单独设计。
- 本任务不接入真实 API billing 或跨 harness 的 token telemetry。
- 本任务不削弱 `ff-clarify` 的 Brainstorm Pass、Grill Loop、advisor review、explicit accept、proposal identity 或 clarify gate。
- 本任务不把 Superpowers 的术语、流程或架构直接搬进 Flowflow；外部经验只作为优化线索。

## Constraints

- `.ff` 仍是 Repo Truth；任务上下文包是派生材料，不能取代 `spec.md`、`plan.md`、`task.md`、`trace.jsonl` 和 Project Baseline。
- 任务上下文包必须由确定性 helper 生成或刷新，不能依赖 agent 手写整理事实。
- 生成 skill 和 role agent 仍由 adapter 渲染；不要把生成产物当成 canonical source 手工修改。
- 任何省 token 指导都不能允许 agent 跳过需求澄清、advisor review、验收标准映射、验证证据或 baseline outcome。
- package 内容要有过期风险控制。manifest/fingerprint 至少覆盖 `spec.md`、`plan.md`、`task.md`、`trace.jsonl`、`task.json`、`.ff/project/overview.md`、`.ff/project/architecture.md`、`.ff/project/rules.md`、`.ff/project/commands.md`、`git status --short` 和 package 使用到的 diff 输入。实现必须能让 agent 判断包是否需要刷新，或在关键输入变化后重新生成。
- 输出应保持简洁、专业、中文优先；用户可见文档避免空泛口号和没有证据的收益承诺。

## Decisions

- 第一阶段实现完整的 context/review package 能力，并把继续逼近 50%-60% 的优化路线图和测量门槛写入验收证据；暂不实现模型调度和合并 reviewer。
- 收益目标采用本地可验证的代理指标和行为探针，不承诺立即达到 Superpowers 6 提到的 50%-60% 总体下降。第一层收益通过本地上下文体积代理指标判断，真实 token telemetry 留给后续阶段。
- role 交接优先使用 package，但 package 不能成为唯一事实来源；缺少 spec brief、验收标准、diff、验证证据或 baseline 摘要时，角色必须回到原始文件读取。
- reviewer/checker 的优化重点是减少重复上下文准备，不降低 verdict 质量。review verdict 必须同时对照任务 contract 和代码/证据。
- 后续路线图必须包含进入下一阶段的条件：第一阶段 package 能稳定生成、行为探针通过、review/check 没有因压缩上下文漏掉需求或证据。

## Acceptance Criteria
- [x] 存在确定性的任务上下文包生成能力，能针对指定 task 生成或刷新 `.ff/tasks/<task-id>/context-package.md` 和 `.ff/tasks/<task-id>/context-package.manifest.json`，并包含任务 brief、验收标准、baseline 摘要、task state、recent trace、完整 `git status --short`、按 included/excluded/uncertain 分类的 diff 摘要和验证证据字段。
- [x] package 生成逻辑有明确能力归属：核心生成在 `src/tasks/`，CLI/internal helper 调用该能力，`src/harness/` 只更新 generated guidance；相关 module boundary 测试或现有架构测试仍通过。
- [x] 生成的 workflow skill 和 role guidance 会指导 agent 在委派或 review/check 前优先读取任务上下文包，并在包缺少关键信息时回退到原始 `.ff` 文件和 git 信息。
- [x] reviewer/checker 指导明确禁止只看 diff 就给出 spec verdict，必须把 diff、任务 brief 和验收标准一起对照。
- [x] 实现包含过期或刷新控制，能避免 package 在 `spec.md`、`plan.md`、`task.md`、`trace.jsonl`、`task.json`、`.ff/project/*.md`、`git status --short` 或 package 使用到的 diff 输入变化后被误当成当前事实。
- [x] 本地代理指标有通过门槛：至少一个代表性 role handoff 场景相对原始读取路径降低 10% 以上，至少一个 review/check 场景降低 20% 以上；如未达成，check 必须记录未通过风险并不得声称第一层收益已达成。
- [x] 测试覆盖 package 生成内容、adapter 输出、关键 helper 或 CLI 行为，以及 clarify/plan/run/check/finish gate 不被新路径绕过。
- [x] Check 阶段记录本地量化证据：相关生成文件体积变化、package 体积、被减少的重复读取路径，以及至少 2-3 个行为探针的期望失败模式、期望行为、review verdict 和残余风险。
- [x] 任务记录中包含后续优化路线图和门槛，覆盖 generated guidance 瘦身、合并重复 review、条件模型/角色调度、真实 token telemetry 或 eval harness。
