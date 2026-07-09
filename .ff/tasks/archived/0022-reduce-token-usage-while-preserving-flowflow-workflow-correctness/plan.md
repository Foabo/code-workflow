# Plan

## Approach

- 在 `src/tasks/` 增加确定性的 context package 生成能力，读取 task state、`spec.md`、`plan.md`、`task.md`、`trace.jsonl`、Project Baseline、`git status --short` 和 diff 输入，生成 `.ff/tasks/<task-id>/context-package.md` 与 `.ff/tasks/<task-id>/context-package.manifest.json`。
- 从 `src/tasks/index.ts` 暴露 public surface。CLI internal helper 调用这个 surface；`src/harness/` 只更新 generated workflow skill 与 role guidance，不拥有 package 事实生成。
- package 使用同一组任务事实，按用途组织 role handoff 与 review/check 重点；review/check 仍必须对照任务 brief、accepted spec、验收标准、diff 和验证证据。
- manifest 记录输入文件 hash、`git status --short`、diff 输入 hash、生成时间、package 字节数、本地上下文体积代理指标和 stale 判定所需字段。
- 新增 `ff internal refresh-context-package --task <id>` 并更新 `src/cli/help.ts`。helper 应输出生成路径、manifest 路径、stale/refresh 状态和指标摘要。
- 更新 `src/harness/adapters.ts` 后刷新当前仓库的 generated harness artifacts，使角色交接优先刷新或读取 context package；当 package 缺失、stale、关键信息缺失或 diff 存在 uncertain 分类时，指导 agent 回到原始 `.ff` 文件和 git 信息。
- 在测试与 check 阶段分别验证确定性输出、adapter 文案、CLI 行为、模块边界、clarify/advisor/workflow gates，以及本地代理指标门槛。

## Key Decisions

- 只增加一个 canonical package 文件和一个 manifest 文件；review package 作为 `context-package.md` 内的 review/check section 与 manifest metric profile 表达，避免引入第二个任务事实来源。
- 不扩展 `task.json.artifacts` schema；package 是 task-local generated cache，通过固定路径发现。
- diff 分类采用保守规则：明确相关内容进入 included，明确其他任务或无关路径进入 excluded，无法可靠归因的内容进入 uncertain；uncertain 会触发原始 git 回读要求。
- package 可以摘要 task truth，但不能批准 spec、替代 proposal identity 或降低 advisor/reviewer/checker verdict 标准。
- advisor 的 clarify 行为探针必须要求 `ff-advisor` 对照当前 `spec.md` 和 proposal identity `p-be03de4f0abc`；context package 摘要只能作为导航材料。

## Risks

- 摘要遗漏验收条件：测试检查 required sections，review/check guidance 要求回读 accepted spec 和验收标准。
- 过期 package 被误用：manifest 覆盖 spec、plan、task、trace、task.json、Project Baseline、git status 和 diff 输入，helper 报告 stale 并要求刷新。
- diff 归因过度自信：uncertain 分类和 reviewer/checker fallback 探针暴露该风险。
- 生成指导变长抵消收益：check 记录 generated guidance 体积变化，并把后续 guidance 瘦身写入路线图。
- 模块边界漂移：核心能力留在 `src/tasks/`，CLI/internal helper 调用 public surface，harness 只消费；由 `tests/architecture/module-boundaries.test.ts` 验证。
- Dirty worktree 处理必须在 run/check/finish 阶段用当前 `git status --short` 刷新并明确分类；规划阶段不把任何非任务 dirty entry 当作稳定事实。

## Validation Strategy

- 单元/集成测试覆盖 package 内容、manifest fingerprint/stale、git status/diff 分类、CLI/internal helper、adapter 输出和 module boundary。
- 回归测试确认 clarify proposal identity、advisor review、`accept-spec`、plan/run/check/finish gates 没有被 package 路径绕过。
- 运行 `npm run typecheck`、`npm test`、`npm run build`、`node dist/src/cli.js validate --root .`、`node dist/src/cli.js doctor --root .`。
- Check 阶段记录本地代理指标：package 体积、被替代读取路径体积、generated guidance 体积变化；role handoff 至少下降 10%，review/check 至少下降 20%。未达标时记录风险，不声明第一层收益达成。
- Check 阶段记录 3 个行为探针：clarify/advisor proposal identity、plan accepted-spec fallback、review/check diff-only verdict refusal；每个探针都要记录期望失败模式、期望行为、reviewer verdict 和残余风险。
