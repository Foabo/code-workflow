# Spec

## Goal
让 `cw-clarify` 在真实使用中不会因为 agent 过早相信用户描述、跳过追问、跳过 advisor、或绕过用户确认而直接写入 `spec.md`。0013 要把 clarify correctness 收回到 CW 自己的流程和 gate 中，同时实现本地 watchdog，让遗漏关键 clarify 事件的执行能被发现、提醒或阻断。

## Scope
- 强化 `cw-clarify` 的生成 skill 和运行时语义，使标准路径固定为：Brainstorm Pass -> Grill Loop -> Proposed Spec -> advisor review 当前 Proposed Spec -> 处理 concern/blocker -> explicit accept -> write `spec.md`。
- Brainstorm Pass 必须复述目标和动机、给出最多 3 个可选方向、推荐最小路径、列出假设、风险、验收证据，并产出 Open Decisions。
- Grill Loop 必须针对 Open Decisions 和高风险假设继续追问；复杂、模糊、高风险或工作流语义任务不得因为用户一句描述就进入 spec 写入。
- Proposed Spec 必须在用户接受前经过 advisor review；advisor review 关联当前 proposal attempt，不能复用旧 review。
- advisor 可用时必须调用；advisor 不可用时允许 inline fallback，但必须明确记录为降级执行，写入 `advisor.unavailable` 或等价 trace，包含失败原因，并使用同一套 review checklist 输出结构化审查结果。
- advisor 不可用证据至少记录 attempted advisor invocation、harness、failure reason、timestamp、fallback checklist result。
- advisor 只提供 `nit`、`concern`、`blocker` 审查，不直接问用户、不编辑文件、不接受 spec、不推进 phase。
- `concern` 必须 resolve、defer with rationale，或由用户显式接受风险；`blocker` 必须修正后重新 review，或记录用户显式 override。
- CLI/kernel 层增加 accept gate，防止 `cw clarify --goal ...` 或等价路径在没有 explicit accept 的情况下写入 `spec.md` 或推进 plan。
- explicit accept 必须有可执行接口。实现可以采用 `--confirm`、专用 internal helper、或等价状态 token，但必须保证默认 `cw clarify --goal ...` 只能产生 proposal/blocked 状态，不能直接写入 `spec.md`。
- trace 或等价轻量证据必须记录关键事件，并定义顺序与 freshness：`brainstorm.done`、`spec.proposed`、`advisor.reviewed` 或 `advisor.unavailable`、`spec.accepted` 必须属于同一当前 attempt/proposal；旧事件不能让新 proposal 通过 gate。
- `spec.proposed`、`advisor.reviewed` 或 `advisor.unavailable`、`spec.accepted` 必须共享稳定身份字段，例如 `attempt_id` 加 `proposal_id`，或 proposal content hash。
- 实现 deterministic local validator，检查 clarify attempt 是否满足关键事件顺序、freshness、advisor review/降级证据和 accept gate。
- deterministic local validator 必须是本地纯校验，不调用模型；输入为 task、trace、proposal 状态；失败返回非零退出码和结构化错误，供 hook/watchdog 统一调用。
- 实现本地 hooks/watchdog，监督 clarify 是否缺少关键事件。缺少关键事件时，watchdog 必须提醒或阻断继续推进；阻断条件以 deterministic local validator 为准。
- 在写 `spec.md`、推进 plan、或通过 accept gate 前，validator 失败必须阻断；提醒只用于尚未触发 gate 的中间状态。
- Codex、Cursor、Claude、OpenCode、Pi 均采用本地机制实现最贴近的平台 watchdog；Cursor 只覆盖本地执行路径。
- Codex 采用本地轻量 Stop hook/watchdog 或等价本地校验；不实现 app-server watcher、常驻 watcher、线程事件订阅器或完整 OMP runtime。
- 更新 `.cw/orchestration.json`、`DESIGN.md`、adapter 渲染、生成的 harness artifacts、测试和必要 fixtures，使本地 watchdog 与 clarify gate 一致。

## Non-goals
- 不重做 0011 已完成的通用角色体系、模型配置体系或 role-agent 文件生成体系。
- 不新增 `clarify.md` 或其他长期澄清 artifact。
- 不实现完整 OMP advisor watchdog runtime、后台 scheduler、常驻进程、非本地 watcher、非本地 agent 或 worktree lane。
- 不允许任何 harness 绕过 CW 的 accept gate 来写 `spec.md`。
- 不把 advisor 输出作为 repo truth；它只是审查证据和暂停依据。
- 不把 hook/watchdog 设计成唯一 correctness 来源。

## Constraints
- 全部 watchdog 和 harness 集成必须是本地执行。
- `.cw` 仍是 workflow truth；Git 仍是代码变更 truth；generated skills 和 harness artifacts 只是 invocation surface。
- `spec.md` 是 clarify 的唯一长期产物；brainstorm、advisor、grill 过程只保留轻量 trace 或执行证据。
- hook/watchdog 能力因 harness 不同而不同，但 0013 必须为每个支持 harness 给出可执行的本地策略或明确降级路径。
- Codex 实现必须保持简单，不引入常驻服务或 app-server watcher。
- 既有 active task `0012` 不属于本任务范围。

## Decisions
- 0013 必须实现 hooks/watchdog，不停留在设计说明。
- `skill` 定义 agent 正常流程，`kernel/CLI gate` 保证数据正确性，`hooks/watchdog` 监督本地执行是否漏步。
- advisor 是 clarify 的必经 review gate；可用时必须调用，失败时才允许显式降级。
- 当前 Proposed Spec 必须在用户接受前经过 advisor review；有 `blocker` 时必须修正并重新审查或由用户显式 override。
- `concern` 可以通过修正、带理由延后，或用户显式接受风险来处理。
- Codex 的本地实现选择轻量 Stop hook/watchdog；未来如需更像 OMP 的 watcher，另开任务评估。
- Cursor 只覆盖本地执行路径。
- Pi 通过本地 extension、yaml hook、subagent 能力实现 watchdog；若用户环境没有对应扩展，必须走显式降级。

## Acceptance Criteria
- [x] `cw-clarify` 生成 skill 明确 Brainstorm Pass -> Grill Loop -> Proposed Spec -> advisor review 当前 Proposed Spec -> 处理 concern/blocker -> explicit accept -> write `spec.md` 的顺序，并禁止提前写入。
- [x] Brainstorm Pass 输出要求覆盖目标/动机、最多 3 个方向、推荐最小路径、假设、风险、验收证据和 Open Decisions。
- [x] Grill Loop guidance 能让复杂、模糊、高风险或工作流语义任务继续追问，而不是直接进入 spec。
- [x] advisor 可用时必须调用；不可用时必须显示“降级执行”，记录失败原因，并执行同等 inline review checklist。
- [x] advisor 权限边界明确：不问用户、不编辑文件、不接受 spec、不推进 phase。
- [x] `concern` 和 `blocker` 的处理规则明确，且 blocker 不能被静默忽略。
- [x] explicit accept 有可执行接口；默认 `cw clarify --goal ...` 不能直接写 `spec.md` 或推进 plan。
- [x] CLI/kernel gate 阻止没有 explicit accept 的 clarify 路径写 `spec.md` 或推进 plan。
- [x] trace 或等价轻量证据记录关键事件，并校验同一 attempt/proposal 的顺序、稳定身份和 freshness。
- [x] deterministic local validator 已实现，能检查 clarify attempt 的关键事件、advisor review/降级证据、freshness 和 accept gate。
- [x] deterministic local validator 是本地纯校验，不调用模型，失败时返回非零退出码和结构化错误。
- [x] 本地 hooks/watchdog 已实现，并调用 deterministic local validator 检查缺少关键事件的 clarify 执行。
- [x] 写 `spec.md`、推进 plan、或通过 accept gate 前，validator 失败会阻断；中间状态可以只提醒。
- [x] Codex 本地 watchdog 采用轻量 Stop hook/watchdog 或等价本地校验，不引入 app-server watcher 或常驻 watcher。
- [x] Cursor、Claude、OpenCode、Pi 的本地 watchdog 策略和生成 artifacts 与各自本地能力匹配。
- [x] 文档、spec、测试、生成 artifact 中只描述本地 Cursor 执行路径。
- [x] 不新增 `clarify.md`。
- [x] 0011 已完成的通用 orchestration contract 不被重复重写，只补充 clarify-specific correctness 和 local watchdog。
- [x] 测试覆盖生成 skill、CLI/kernel accept gate、advisor 必调/降级、deterministic validator、local watchdog artifact 生成或校验、Codex 简化边界、Cursor 本地限定文案。
- [x] Regenerate relevant harness artifacts.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `node dist/src/cli.js validate --root .`.
