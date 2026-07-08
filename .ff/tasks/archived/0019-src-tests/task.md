# Task

## Implementation
- [x] 记录迁移前基线
  - 确认 `package.json` 的 `main`、`types`、`bin` 当前值，并在后续 diff 中保持不变。
  - 记录 `src/index.ts` 当前导出清单，后续只允许等价路径调整。
  - 确认当前测试根是 `tests/kernel.test.ts`，没有 `src/tests/` 目录。
- [x] 建立能力目录和公开入口
  - 创建 `src/cli/`、`src/project/`、`src/workflow/`、`src/tasks/`、`src/baseline/`、`src/harness/`、`src/enhancements/`、`src/domain/`、`src/shared/`。
  - 为产品能力目录建立 `index.ts`，公开其他能力需要调用的最小接口。
  - 保留根 `src/index.ts`、`src/cli.ts`、`src/agent-command.ts`，只做 re-export 或命令启动转发。
- [x] 迁移低层共享模块
  - 将共享类型、状态枚举、schema validator、orchestration 配置规则迁入 `src/domain/`。
  - 将文件、JSON、Git 等无业务规则工具迁入 `src/shared/`。
  - 拆分原 `paths.ts` 中 task 专属路径 helper，放入 `src/tasks/`。
- [x] 迁移核心产品能力模块
  - 按 `plan.md` relocation map 迁移 project、tasks、workflow、baseline、harness、enhancements、cli 能力实现。
  - 更新所有 import，使跨能力引用默认通过目标能力 `index.ts`。
  - 对必须引用内部文件的情况加入集中 allowlist，并写明原因。
- [x] 保持 package 和根入口稳定
  - 确认 `package.json` 的 `main`、`types`、`bin` 没有变化。
  - 确认 `src/index.ts` 产品级导出面没有扩大。
  - 确认根 `src/cli.ts`、`src/agent-command.ts` 不再承载命令分支和 workflow 规则。
- [x] 提取测试 support
  - 将 CLI 运行、JSON 解析、临时项目、trace 读取、fixture 写入、常用断言等共享 helper 移入 `tests/support/`。
  - 保持 support helper 面向测试行为，避免依赖具体测试文件。
- [x] 按能力拆分测试
  - 将 `tests/kernel.test.ts` 拆为嵌套测试文件，覆盖 project init/validate、harness/update、enhancements、tasks、workflow、baseline、CLI/internal command 等能力。
  - 保留现有行为断言，不因拆分降低覆盖。
  - 删除原单体测试文件，避免重复执行同一批断言；只有存在明确兼容原因时才保留入口文件并说明原因。
- [x] 增加架构边界测试
  - 新增 `tests/architecture/module-boundaries.test.ts` 或等价文件。
  - 覆盖 `domain/`、`shared/`、跨能力 import、根薄入口、测试 support 边界。
  - 使用集中 allowlist；每个例外必须说明原因，不能使用宽泛通配。
- [x] 更新测试发现
  - 仅在需要发现嵌套测试时调整 `package.json` 的 `scripts.test`。
  - 验证 `npm test` 会执行嵌套测试文件和架构测试。
- [x] 增加 `ff-*` 分发烟测
  - 通过临时 symlink/copy 名称或等价方式，把 `dist/src/agent-command.js` 以真实 `ff-plan`、`ff-check` 等 bin 名称执行。
  - 断言该测试触发 `agent-command` 的 `argv[1]` 识别路径。
  - 避免只用 `node dist/src/agent-command.js ff-plan` 这种 fallback 参数路径。

## Verification
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `node dist/src/cli.js validate --root .`
- [x] 人工检查 `git diff -- package.json`：除 `scripts.test` 外没有 `main`、`types`、`bin` 改动。
- [x] 人工检查 `src` 根目录：只剩 `index.ts`、`cli.ts`、`agent-command.ts`。
- [x] 人工检查 `src/index.ts` 导出清单：迁移前后产品级导出面等价。
- [x] 人工检查测试输出或断言：架构边界测试和嵌套测试实际执行。

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded.

## Notes

- `plan.md` 的 Relocation Map 是本任务的文件迁移依据；不要把每个文件移动拆成主 checklist 的独立任务。
- 当前任务目录在 run 阶段是未跟踪文件，属于本任务范围。
- 本轮实现没有修改 `spec.md`，已按 `plan.md` 迁移 `src`、拆分 `tests`，并仅为嵌套测试发现调整 `package.json` 的 `scripts.test`。
- Check evidence 2026-07-08：`npm run typecheck`、`npm test`、`npm run build`、`node dist/src/cli.js validate --root .`、`node dist/src/cli.js doctor --root .`、`git diff --check` 全部通过；`npm test` 实际执行 8 个 suite、59 个 test。
- Dirty worktree 范围已核对：当前改动均属于本任务的 `src`/`tests` 重组、`package.json` 测试发现调整和 `.ff/tasks/0019-src-tests/` 任务产物。
- Baseline Outcome：`baseline-delta.md` 已记录本次可复用的架构边界、测试布局和命令事实，留给 `ff-finish` 做 baseline 合并决策。
- 独立 `ff-checker` 结论为 pass；独立 `ff-reviewer` 的 concern 已由主会话完整验证和本文件 check 更新覆盖。
