# Plan

## Approach
1. 在生成源头调整 `ff-clarify` 和 `ff-plan` 的 workflow guidance。
   - 入口是 `src/harness/adapters.ts` 中的 `commandGuidance`、必要时包含 `commandProtocolSections`。
   - 新增的规则要写进生成文本本身，不能依赖用户本机的 `~/.agents/skills`。
   - 规则重点放在用户可见输出：跟随用户语言、解释必要术语、按“目标/动机 -> 范围/取舍 -> 证据/下一步”的顺序表达，避免空泛术语和跳跃式结论。

2. 分别加强 `ff-clarify` 和 `ff-plan`。
   - `ff-clarify`：要求 Brainstorm、追问、Proposed Spec 用用户能判断的语言说明目标、动机、取舍、风险和验收证据。
   - `ff-plan`：要求 `plan.md` 和 `task.md` 写成可执行动作、具体取舍和验证证据，避免只有抽象标签。
   - 保留现有 clarify gate、proposal identity、advisor review、spec quality gate、phase movement 规则。

3. 更新 deterministic tests。
   - 在 `tests/harness/harness.test.ts` 增加断言，确保生成的 `ff-clarify` 和 `ff-plan` skill 包含新规则。
   - 断言要覆盖语言跟随、术语解释、反黑话、连续推理、计划/任务可执行化、行为审查要求。

4. 刷新生成产物。
   - 修改源代码并构建后，用 Flowflow 更新当前仓库的 Codex 和 Claude skill surface。
   - 检查 `.agents/skills/ff-clarify/SKILL.md`、`.agents/skills/ff-plan/SKILL.md`、`.claude/skills/ff-clarify/SKILL.md`、`.claude/skills/ff-plan/SKILL.md` 是否来自生成源。

5. 在 check 阶段做行为审查。
   - 在任务记录里留下两个场景的检查说明：一个 `ff-clarify` 场景，一个 `ff-plan` 场景。
   - 审查重点是新 prompt 是否会减少黑话、空泛 spec、跳跃方案、缺少证据的验收标准。

## Key Decisions
- 本任务只覆盖 `ff-clarify` 和 `ff-plan` 生成 prompt。
- 本任务不修改 role-agent prompt，也不新增独立 humanizer / brainstorm / grill skill。
- 本任务不改变 Flowflow 的运行时 gate 和 helper 语义。
- 本任务把本地 plain-language skills 当作设计参考，不把它们变成运行依赖。
- 用户用中文时，生成技能应要求用户可见输出优先中文；命令、路径、API、代码标识和产品名保持原样。

## Risks
- 只加字符串断言不能证明模型行为会改善；需要在 check 阶段补行为审查记录。
- 规则如果写得过硬，可能让必要流程术语消失，导致 helper 语义变模糊；实现时要保留必要术语，并解释它们的用途。
- 规则如果只放在 `ff-clarify`，计划阶段仍可能产出抽象 `plan.md` / `task.md`；两个 command 都要覆盖。
- 生成产物可能涉及多 harness 输出；实现时要确认测试和仓库里的生成 surface 没有漂移。
- 如果 update 命令改动 role-agent 配置，必须停下来检查，因为本任务不覆盖 role-agent prompt。

## Validation Strategy
- `npm run typecheck`
- `npm test`
- `npm run build`
- `node dist/src/cli.js validate --root .`
- 生成产物检查：确认 affected generated skills 来自 `src/harness/adapters.ts`，没有手写漂移。
- 行为审查：在 `task.md` Notes 中记录 `ff-clarify` 和 `ff-plan` 两个场景，逐条对照新规则。

## Baseline Candidate
- Generated `ff-clarify` and `ff-plan` guidance should include portable plain-language rules for user-visible output: follow the user's language, explain required workflow terms, connect motivation/scope/trade-offs/evidence, and avoid vague jargon or formulaic AI prose.
