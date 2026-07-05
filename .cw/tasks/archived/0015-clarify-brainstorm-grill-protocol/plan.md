# Plan

## Approach
- 在 `src/adapters.ts` 的生成源头里改 `cw-clarify` guidance，不直接手改生成出的 `SKILL.md` 作为 canonical truth。
- 保持现有 `Workflow Steps` 和 clarify gate 语义，只把 Brainstorm Pass 和 Grill Loop 从普通 bullet 提升为同一 `cw-clarify` skill 内的显式协议小节。
- 优先使用小改动：为 `cw-clarify` 增加命令专属的 protocol markdown 小节；只有在局部改动更少时，才调整现有 guidance 渲染函数。不要引入新的通用 DSL 或改变所有命令的生成模型。
- 更新 `tests/kernel.test.ts` 中现有 `clarifySkill` 断言，覆盖协议标题、Brainstorm 必备输出、Grill 追问规则、禁止跨 skill 查找、保持 accept/write 顺序。
- 运行生成命令刷新已检入且受影响的 harness artifacts，至少覆盖 `.agents/skills/cw-clarify/SKILL.md` 和 `.claude/skills/cw-clarify/SKILL.md`；不新增未在 spec 中确认的 harness surface。
- 在 check 阶段补行为审查，专门评估新文案是否仍会让 agent 跳过 brainstorm、跳过 grill、依赖跨 skill 查找、提前写 `spec.md`，或接受模糊证据。

## Key Decisions
- Brainstorm Pass 和 Grill Loop 是 `cw-clarify` 的内部协议阶段，不是独立工作流动作。
- 不新增 `cw-brainstorm` 或 `cw-grill` skill，不要求 agent 做跨 skill 查找。
- deterministic tests 只证明生成文本和 artifacts；行为审查单独证明 wording 对真实 agent 执行足够清楚。
- 0015 不扩展 0013 已覆盖的 runtime clarify gate/watchdog。

## Risks
- 如果只在 bullet 中增加文字，agent 仍可能看不到 Brainstorm/Grill 的操作边界。
- 如果渲染逻辑改得过大，可能影响其它命令的生成格式，造成无关 artifact churn。
- 如果测试只断言关键词存在，无法防止文案以后退化成隐含定义。
- 当前任务只处理生成指导；运行时 gate 的强制行为仍以 0013 的实现为边界。

## Validation Strategy
- 用 targeted tests 验证生成的 `cw-clarify` skill 包含明确 Brainstorm Pass 和 Grill Loop 小节及必备协议内容。
- 用 negative assertions 验证没有生成或引用 `cw-brainstorm`、`cw-grill` 这类独立 skill。
- 重新生成相关 harness artifacts 后，运行 `node dist/src/cli.js validate --root .` 检查 generated-skill freshness 和 `.cw` 结构。
- 运行 `npm run typecheck`、`npm test`、`npm run build`。
- check 阶段执行人工行为审查，把每条验收标准映射到测试、生成文件或审查证据。

## Baseline Candidates
- 生成 workflow guidance 时，内部阶段应在所属 workflow skill 内定义为可执行协议；只有用户会独立调用的工作流动作才应成为独立 skill。
