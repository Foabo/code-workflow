# Spec

## Goal
让生成的 `cw-clarify` guidance 把 Brainstorm Pass 和 Grill Loop 定义成同一份 `SKILL.md` 内的明确、可执行协议，使 agent 不需要靠隐含 bullet 推断，也不需要跳转到独立 skill 才能理解这两个阶段。

## Scope
- 修改 `src/adapters.ts` 中 adapter 渲染出的 `cw-clarify` guidance。
- 在生成的 `cw-clarify` skill 中加入清晰的 Brainstorm Pass 和 Grill Loop 协议小节。
- Brainstorm Pass 小节必须说明 purpose、required output、Open Decisions 产出，以及 brainstorm 阶段禁止写 `spec.md`。
- Grill Loop 小节必须说明 input、一次一个具体问题、推荐答案和 trade-off、高风险场景、停止条件。
- 保持固定 clarify 顺序：Brainstorm Pass -> Grill Loop -> Proposed Spec -> advisor review -> concern/blocker handling -> explicit accept -> write `spec.md`。
- 不生成独立的 `cw-brainstorm` 或 `cw-grill` skill。
- 从 adapter source 重生成相关 harness artifacts。
- 添加或更新测试，确保生成结果不会丢失 Brainstorm Pass 和 Grill Loop 协议定义。
- check 阶段必须做行为审查：确认文案不会让 agent 跳过 brainstorm、跳过 grill、依赖跨 skill 查找、提前写 `spec.md`、接受模糊证据。

## Non-goals
- 不扩展 0013 已覆盖的 runtime clarify gate 或 watchdog 行为。
- 不创建 `clarify.md` 或任何长期 brainstorm/grill artifact。
- clarify 阶段不更新 Project Baseline。

## Constraints
- Generated skills 是 invocation surface；`src/adapters.ts` 是这类 wording 的 canonical source。
- Repo-facing task artifacts 使用中文；生成 skill 文案可以保持现有英文风格，除非周边生成 surface 一起改。
- 改动保持小而直接，兼容现有 harness output。

## Decisions
- Brainstorm Pass 和 Grill Loop 保留为 `cw-clarify` 内部协议小节。
- 不生成独立的 `cw-brainstorm` 或 `cw-grill` skill。
- 最短充分修复是 adapter wording、测试、重生成 artifacts，以及 check 阶段行为审查。

## Acceptance Criteria
- [x] 生成的 `cw-clarify` skill 在同一文件内包含明确的 Brainstorm Pass 和 Grill Loop 小节，或等价的显式标题。
- [x] Brainstorm Pass guidance 覆盖目标/动机复述、最多三个方向、推荐最小路径、假设、风险、验收证据、Open Decisions、禁止写 `spec.md`。
- [x] Grill Loop guidance 覆盖 Open Decisions/高风险假设输入、一次一个具体问题、推荐答案和取舍、高风险场景、停止条件。
- [x] 生成 guidance 不新增 `cw-brainstorm` 或 `cw-grill` skill，也不要求跨 skill 查找。
- [x] 生成 guidance 保留 Proposed Spec、advisor review、concern/blocker handling、explicit accept、write `spec.md` 的顺序。
- [x] 测试会在 Brainstorm/Grill 协议定义丢失时失败。
- [x] check 阶段行为审查确认文案不会导致跳过 brainstorm、跳过 grill、依赖跨 skill 查找、提前写 `spec.md`、接受模糊证据。
- [x] 相关 harness artifacts 已重生成。
- [x] 运行 `npm run typecheck`。
- [x] 运行 `npm test`。
- [x] 运行 `npm run build`。
- [x] 运行 `node dist/src/cli.js validate --root .`。
