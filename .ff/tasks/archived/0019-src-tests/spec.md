# Spec

## Goal
将 Flowflow 的 `src` 与 `tests` 从平铺结构重组为按产品能力划分的模块结构，建立明确的模块边界和测试归属规则，同时保持现有产品行为不变。

## Scope
- 重组 `src` 目录：
  - `src/index.ts`、`src/cli.ts`、`src/agent-command.ts` 保留为根目录薄入口。
  - 其余实现迁入按产品能力命名的目录。
  - 第一阶段目标目录包括 `cli/`、`project/`、`workflow/`、`tasks/`、`baseline/`、`harness/`、`enhancements/`、`domain/`、`shared/`。
- 独立 `src/domain/`：
  - 放置跨模块共享的领域类型、状态枚举、schema validator 和纯规则。
  - 仅服务单一产品能力的类型留在对应能力目录内。
- 重组 `tests` 目录：
  - 将 `tests/kernel.test.ts` 拆分为按产品能力归属的测试文件。
  - 将 CLI fixture、临时项目、trace 读取、断言 helper 等共享测试工具迁入 `tests/support/`。
- 增加轻量架构测试：
  - 验证 `shared/`、`domain/`、跨模块 import、根薄入口和测试 support 的边界规则。
- 更新测试发现方式：
  - 确保 `npm test` 会执行嵌套测试文件，包括架构边界测试。
- 更新 import 路径和必要的测试运行配置，确保现有命令继续通过。

## Non-goals
- 不改变 `ff` CLI、`ff-*` agent command、`ff internal` 的用户可见行为。
- 不改变 `.ff` task、trace、baseline、orchestration、enhancement 等文件格式。
- 不扩大 `src/index.ts` 的产品级导出面。
- 不新增兼容性包装层来保留旧的内部模块路径。
- 不在第一阶段重写 workflow 状态机、adapter 渲染规则、enhancement provider 行为或 task 存储语义。
- 不将外部 TypeScript 项目的目录结构作为硬性模板；外部项目只作为参考。

## Constraints
- 第一阶段是完整结构重组，但行为保持不变。
- 根目录仅保留 `src/index.ts`、`src/cli.ts`、`src/agent-command.ts` 三个薄入口。
- 每个产品能力模块的公开入口是 `src/<capability>/index.ts`。
- 跨产品能力的 import 默认只能依赖目标模块公开入口。
- 架构测试中的例外必须使用集中 allowlist，逐项说明原因；不得使用宽泛通配来绕开边界规则。
- `src/shared/**` 只能包含无业务规则的基础工具，不得 import 产品能力模块。
- `src/domain/**` 只能包含共享领域模型、schema、状态枚举和纯规则，不得 import 产品能力模块。
- `src/cli/**` 负责参数解析、交互提示、输出格式和命令分发，不直接实现 `.ff` 持久化规则。
- `src/tasks/**` 独占 task id、task.json、trace、archive、resume 和 task selection 的目录与状态规则。
- `src/workflow/**` 编排 workflow action，不直接手写 task 存储细节。
- `src/harness/**` 独占生成 skills、role agents、watchdog 等 harness 输出。
- `src/enhancements/**` 独占 enhancement provider registry、setup plan、setup apply 和 setup metadata。
- plan 阶段必须产出现有 `src/*.ts` 到目标产品能力目录的 relocation map。
- 实现阶段以移动文件、建立模块入口、更新 import、拆分测试和补架构测试为主，避免重写行为逻辑。
- `package.json` 的 `main`、`types`、`bin` 路径保持不变，除非只为保证等价测试发现而调整 `scripts.test`。
- 测试优先验证产品行为；只有深模块的纯规则和边界规则使用模块级测试。

## Decisions
- 按产品能力重组，而不是按技术层或单个热点文件逐步重组。
- 独立 `domain/`，但限制为跨模块共享内容。
- 第一阶段完整迁移 `src` 和 `tests` 的物理结构，保持行为不变。
- 保留根入口薄文件以维持 package main 与 bin 路径。
- 增加 `tests/architecture/module-boundaries.test.ts` 一类轻量架构测试，防止模块边界快速退化。
- 以当前产品级接口和 CLI 行为为稳定面；内部 TypeScript 模块路径可在本次迁移中改变。

## Acceptance Criteria
- [x] `src` 根目录除 `index.ts`、`cli.ts`、`agent-command.ts` 外，不再保留产品实现文件。
- [x] `src` 实现文件被迁入 `cli/`、`project/`、`workflow/`、`tasks/`、`baseline/`、`harness/`、`enhancements/`、`domain/`、`shared/` 或经任务说明确认的等价产品能力目录。
- [x] `src/domain/` 存放跨模块共享的类型、schema、状态枚举和纯规则；单一能力专用类型留在对应能力目录。
- [x] `src/shared/` 不依赖产品能力模块。
- [x] 跨能力 import 通过模块公开入口或架构测试允许的明确例外。
- [x] 根薄入口文件只做产品入口或命令入口转发，不承载业务规则。
- [x] `tests/kernel.test.ts` 被拆分为多个按能力归属的测试文件。
- [x] 共享测试工具位于 `tests/support/`。
- [x] 存在轻量架构测试覆盖模块边界规则。
- [x] `npm test` 会发现并执行嵌套测试文件，且架构边界测试实际执行。
- [x] 架构测试中的边界例外使用集中 allowlist，并逐项说明原因。
- [x] `plan.md` 包含现有 `src/*.ts` 到目标产品能力目录的 relocation map。
- [x] `src/index.ts` 的产品级导出面没有扩大。
- [x] `package.json` 的 `main`、`types`、`bin` 路径保持不变。
- [x] 至少一个 `ff-*` agent command 通过 `dist/src/agent-command.js` 完成分发烟测。
- [x] `npm run typecheck` 通过。
- [x] `npm test` 通过。
- [x] `npm run build` 通过。
- [x] `node dist/src/cli.js validate --root .` 通过。
