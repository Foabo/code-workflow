# Task

## Implementation
- [x] 生成 context package 核心切片：在 `src/tasks/` 增加 builder，针对 fixture task 写出 `context-package.md` 与 `context-package.manifest.json`；目标行为是包含 brief、验收标准、baseline 摘要、task state、recent trace、完整 `git status --short`、diff 分类和验证字段；证据是 tasks 测试断言这些 section 与字段存在。
- [x] 生成 manifest 与 stale 控制切片：对 `spec.md`、`plan.md`、`task.md`、`trace.jsonl`、`task.json`、`.ff/project/*.md`、`git status --short`、diff 输入计算 fingerprint；目标行为是任一关键输入变化后 helper 能报告需刷新；证据是修改 fixture 输入后的 stale 测试。
- [x] 实现 diff 分类切片：生成 included、excluded/unrelated、uncertain 摘要，并在 uncertain 出现时写入 fallback 要求；目标行为是 package 不把不确定 dirty path 当作已审查事实；证据是 dirty worktree fixture 测试。
- [x] 接入 CLI/internal helper 切片：新增 `ff internal refresh-context-package --task <id>` 与 help 文案；目标行为是 helper 调用 `src/tasks/` public surface 并输出生成路径、manifest 路径、metric 和 stale 状态；证据是 CLI 测试和 help 测试。
- [x] 更新 workflow/role guidance 切片：修改 `src/harness/adapters.ts` 并刷新当前仓库 generated harness artifacts；目标行为是 delegation 前优先刷新或读取 package，缺失或 stale 时回读原始 `.ff` 与 git；证据是 harness adapter 测试和生成文件检查。
- [x] 更新 reviewer/checker guidance 切片：明确 spec verdict 必须对照 diff、任务 brief、accepted spec 和验收标准；目标行为是 diff-only package 不能支持 verdict；证据是 generated guidance 断言和行为探针。
- [x] 保护 clarify/advisor gate 切片：保持 `ff-clarify` 对当前 Proposed Spec、advisor review、explicit accept、proposal identity 的要求；目标行为是 advisor 审查当前 `spec.md` 和 proposal identity，不能只看 package 摘要；证据是 adapter 测试与 check 探针。
- [x] 增加本地代理指标切片：manifest 或 package 输出 role handoff 与 review/check 的 raw-vs-package size 估算；目标行为是 check 可直接判断 10%/20% 门槛；证据是 fixture metric 测试和实际任务 check 记录。

## Verification
- [x] `npm run typecheck` 通过；证据记录命令和结果。
- [x] `npm test` 通过，包含 package、manifest、CLI、adapter、workflow gate 和 module boundary 覆盖；证据记录相关测试结果。
- [x] `npm run build` 通过；证据记录命令和结果。
- [x] `node dist/src/cli.js validate --root .` 通过；证据记录 issues 为空。
- [x] `node dist/src/cli.js doctor --root .` 通过或只剩与本任务无关的已说明 warning；证据记录结果。
- [x] 实际运行 `node dist/src/cli.js internal refresh-context-package --root . --task 0022`，确认生成文件、manifest fingerprint、git status 和 metrics；证据记录输出摘要。

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] 本地代理指标达标检查：记录 role handoff package 相对原始读取路径是否下降 10% 以上，review/check 是否下降 20% 以上；未达标时记录未通过风险。
- [x] 行为探针 1：`ff-advisor` 审查 clarify Proposed Spec 时必须读取当前 `spec.md` 并核对 proposal identity `p-be03de4f0abc`；期望失败模式是只看 package 摘要；期望行为是拒绝摘要-only 审查并要求原始 spec/identity；check 证据必须记录 reviewer verdict 和残余风险。
- [x] 行为探针 2：`ff-plan` 面对 accepted spec 且 package missing/stale 时必须回读 spec、task.json、trace 和 Project Baseline；期望失败模式是直接按 stale package 写计划；期望行为是刷新或回读后再计划，且不编辑 spec.md；check 证据必须记录 reviewer verdict 和残余风险。
- [x] 行为探针 3：review/check 只拿到 diff summary 时不能给 spec verdict；期望失败模式是 diff-only pass；期望行为是要求任务 brief、验收标准、accepted spec 和验证证据；check 证据必须记录 reviewer verdict 和残余风险。
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear：记录完整 `git status --short`，说明 dirty paths 属于本任务、无关或 uncertain。
- [x] Baseline Outcome is recorded：记录无稳定 baseline 变更，或为 package/guidance 规则创建 `baseline-delta.md`。
- [x] 后续优化路线图已记录：覆盖 generated guidance 瘦身、合并重复 review、条件模型/角色调度、真实 token telemetry 或 eval harness，以及进入下一阶段的门槛。

## Notes

- spec 已接受，proposal identity：`p-be03de4f0abc`。
- package 是派生 cache，`.ff` task artifacts、Project Baseline 和 Git 仍是判断事实来源。
- Dirty worktree 状态必须在 run/check 执行时用当前 `git status --short` 刷新；规划阶段不把任何非任务 dirty entry 当作稳定事实。
- Run evidence：`npm run typecheck`、`npm test`、`npm run build`、`node dist/src/cli.js validate --root .`、`node dist/src/cli.js doctor --root .` 均通过；`doctor` issues/warnings 为空。
- Generated harness artifacts 已刷新：`codex`、`claude`、`opencode`、`pi`、`cursor` 均通过 update validation，后续需要重启或 reload 对应 host 才会加载新 guidance。
- Context package 实测：最后一次 `node dist/src/cli.js internal refresh-context-package --root . --task 0022` 返回 `status=current`、`stale=false`；精确 bytes 与 savings percent 以 `context-package.manifest.json` 为准，当前结果超过 role handoff 10% 与 review/check 20% 门槛。
- Manifest 实测包含 `generator_version=1`；生成器渲染规则变更时应 bump version，避免旧 cache 被误判为 current。
- Dirty classification：当前 `.ff/tasks/0022-...` task artifacts 与 context package 属于 included；`src/**`、tests、各 harness generated guidance 属于 uncertain，check verdict 必须读取真实 git diff；excluded 为空。
- Baseline delta 已创建，记录 context package/cache/helper/guidance 的稳定项目事实，check 阶段需要决定是否合并。
- Check repair：manifest `status` 原本保留上次写入状态，第二次 helper 返回 `current` 时文件内状态仍可能是 `created` 或 `refreshed`。已修复为 current 调用同步 manifest 状态，并在 tasks 测试中断言 `generator_version=1` 与 manifest `status=current`。
- Check verification：`npm run typecheck` 通过；`npm test` 通过，67 tests；`npm run build` 通过；`node dist/src/cli.js validate --root .` 通过，issues 为空；`node dist/src/cli.js doctor --root .` 通过，issues/warnings 为空；`git diff --check` 通过。
- Current package evidence：最后一次连续刷新后，helper 返回 `status=current`、`stale=false`，manifest `status=current`；精确 bytes 与 savings percent 以 `context-package.manifest.json` 为准，当前 manifest 中 role handoff 与 review/check savings 均超过本任务门槛。
- Generated guidance delta：`git diff --shortstat` 为 58 files changed，293 insertions，11 deletions；generated guidance 路径的 `git diff --numstat` 已记录每个 harness skill/role agent 的增量，主要是 context package required reading、fallback、review/check verdict 规则。
- Acceptance coverage：AC1 由 `src/tasks/context-package.ts`、实际 task package、manifest 与 tasks 测试覆盖；AC2 由 `src/tasks/index.ts` public export、CLI helper 和 module boundary 测试覆盖；AC3/AC4 由 `src/harness/adapters.ts`、刷新后的 generated skills/role agents 和 harness 测试覆盖；AC5 由 manifest fingerprints、`generator_version`、stale/current 测试覆盖；AC6 由 current package metrics 覆盖；AC7 由 `npm test`、clarify gate 测试和 `validate-clarify` 覆盖；AC8/AC9 由本 check 证据、行为探针和路线图覆盖。
- 行为探针 1 verdict：pass。失败模式是 advisor 只看 package 摘要并复用旧 approval；期望行为是读取当前 `spec.md` 并核对 `p-be03de4f0abc` / `be03de4f0abc...`。证据：trace 中 `spec.proposed`、`advisor.reviewed`、`spec.accepted` 使用同一 identity，`validate-clarify --stage proposal|accept|advance` 均通过，`ff-advisor` guidance 明确 package 只作 navigation。残余风险：依赖 role agent 遵循 guidance；deterministic gate 已覆盖 identity 复用风险。
- 行为探针 2 verdict：pass。失败模式是 `ff-plan` 在 package missing/stale 时直接按摘要写计划；期望行为是刷新或回读 `spec.md`、`task.json`、trace 和 Project Baseline，且不编辑 `spec.md`。证据：`ff-plan` guidance 写明 current package 只能导航，spec quality gate 必须直接读 accepted `spec.md`；stale/current 测试会在 `spec.md` 变化后返回 refreshed；本任务 `spec.md` hash 与 accepted proposal hash 一致。残余风险：暂未加入专门的端到端 plan-stale fixture，当前由 helper 测试和 guidance 断言覆盖。
- 行为探针 3 verdict：pass。失败模式是 review/check 只拿 diff summary 就给 spec verdict；期望行为是要求 task brief、accepted spec、acceptance criteria 和验证证据。证据：`ff-check` / `ff-reviewer` guidance、context package Review And Check Instructions、harness 测试均包含 diff-only 禁止规则；本次 check 实际读取了原始 spec/plan/task、trace、Project Baseline 和 git diff。残余风险：真实模型仍可能漏读；context package 在 uncertain diff entry 时强制 fallback，降低该风险。
- Dirty worktree classification：`.ff/tasks/0022-...` artifacts、`src/tasks/context-package.ts`、`src/tasks/index.ts`、CLI helper/help、tests、`src/harness/adapters.ts` 和各 harness generated skills/agents 均属于本任务覆盖范围；excluded 为空；没有发现无关 dirty path。context package 的 automated classifier 保守地把非 task path 标为 uncertain，本次 check 已用真实 diff 复核为 in-scope。
- Baseline Outcome：`baseline-delta.md` 已创建并更新，包含 context package ownership、generated cache、fallback、review/check verdict、generator version 和 helper command 等稳定项目事实；finish 阶段按 Flowflow baseline gate 处理合并。
- 后续路线图：下一阶段进入条件为 package 连续多个真实任务保持 current/stale 正确、行为探针继续通过、review/check 没有因压缩上下文漏验收。优化方向包括：继续瘦身 generated guidance 的重复 required reading；评估 reviewer/checker 合并或分层触发；按风险条件选择模型/角色；接入真实 token telemetry 或 eval harness；建立 package 使用率、fallback 率、漏检率的回归指标。50%-60% 目标只在真实 telemetry 达标后声明。
