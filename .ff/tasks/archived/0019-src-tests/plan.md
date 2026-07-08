# Plan

## Approach

本任务只做结构重组和测试归属调整，保持 Flowflow 用户可见行为不变。实现顺序按依赖关系推进：

1. 先建立能力目录和公开入口：`cli/`、`project/`、`workflow/`、`tasks/`、`baseline/`、`harness/`、`enhancements/`、`domain/`、`shared/`，每个产品能力模块通过 `src/<capability>/index.ts` 暴露本能力需要被其他模块使用的接口。
2. 先迁移低层依赖：`domain/` 放共享领域类型、状态枚举、schema validator 和纯规则；`shared/` 放无业务规则的文件、JSON、Git 等基础工具。
3. 再迁移产品能力模块：task 存储与 trace、workflow 编排、baseline delta、harness 生成、enhancement setup、project init/update/validate、CLI 参数解析与分发。
4. 保留根入口薄文件：`src/index.ts`、`src/cli.ts`、`src/agent-command.ts` 仍在根目录；它们只转发产品入口或命令入口，不承载业务规则。
5. 更新 import 路径，跨能力默认只依赖目标能力的 `index.ts`。确实需要内部文件的例外必须进入架构测试 allowlist，并逐项写明原因。
6. 拆分 `tests/kernel.test.ts`：先提取 `tests/support/`，再按产品能力拆成嵌套测试文件，最后新增 `tests/architecture/module-boundaries.test.ts`。
7. 调整测试发现方式，使 `npm test` 能发现 `dist/tests/**/*.test.js` 一类嵌套测试输出，并证明架构测试实际执行。

当前没有 `src/tests/` 目录；现有测试文件是 `tests/kernel.test.ts`。实现时应迁移 `tests/`，不要新建 `src/tests/` 作为测试根。

### Relocation Map

| 当前文件 | 目标位置 | 说明 |
| --- | --- | --- |
| `src/adapters.ts` | `src/harness/adapters.ts`，由 `src/harness/index.ts` 暴露 | harness 生成 skills、role agents、watchdog 的实现归属 `harness/`。 |
| `src/agent-command.ts` | 根目录保留薄入口；分发实现迁入 `src/cli/agent-command.ts` | 根入口只根据真实 bin 名称调用 CLI/Workflow 分发。 |
| `src/baseline.ts` | `src/baseline/index.ts` | baseline delta 预览、合并和同步属于独立能力。 |
| `src/clarify-gate.ts` | `src/workflow/clarify-gate.ts` | clarify gate 是 workflow 阶段推进规则；如有纯 identity 规则可再提取到 `domain/`。 |
| `src/cli.ts` | 根目录保留薄入口；命令解析实现迁入 `src/cli/index.ts` | 根入口只启动 CLI，不保留命令分支实现。 |
| `src/enhancements.ts` | `src/enhancements/index.ts` | provider registry、setup plan、setup apply、metadata 归属 enhancement 能力。 |
| `src/fs.ts` | `src/shared/fs.ts` | 基础文件工具，不 import 产品能力模块。 |
| `src/git.ts` | `src/shared/git.ts` | 基础 Git 状态读取，不 import 产品能力模块。 |
| `src/index.ts` | 根目录保留产品级入口 | 导出面保持不扩大，只改内部 re-export 路径。 |
| `src/init.ts` | `src/project/init.ts`，由 `src/project/index.ts` 暴露 | 初始化 `.ff` 项目结构属于 project 能力。 |
| `src/json.ts` | `src/shared/json.ts` | 基础 JSON 读写工具，不 import 产品能力模块。 |
| `src/orchestration.ts` | `src/domain/orchestration.ts` | role、advisor、harness 配置枚举和默认配置属于共享领域规则。 |
| `src/paths.ts` | `src/project/paths.ts`；task 路径 helper 抽到 `src/tasks/paths.ts` | `.ff` 项目布局归属 project；task id、task.json、trace、archive 路径归属 tasks。 |
| `src/preflight.ts` | `src/workflow/preflight.ts` | preflight 是 workflow action 执行前检查。 |
| `src/schema.ts` | `src/domain/schema.ts` | `.ff` record validator 是共享 schema 规则。 |
| `src/task-storage.ts` | `src/tasks/storage.ts` | task id、archive、legacy migration、reference resolution 归属 tasks。 |
| `src/task-store.ts` | `src/tasks/store.ts` | task listing 和 selection 归属 tasks。 |
| `src/tasks.ts` | `src/tasks/index.ts` | task lifecycle、task.json、trace、resume、finish/discard closure gate 归属 tasks。 |
| `src/templates.ts` | `src/project/templates.ts`；task artifact 模板可抽到 `src/tasks/templates.ts`，agent command 名称可抽到 `src/cli/agent-commands.ts` | 按模板消费者拆分，避免 project、tasks、cli/harness 混在一个内部模块。 |
| `src/types.ts` | `src/domain/types.ts` | 共享领域类型、状态枚举和 record 类型集中到 domain。 |
| `src/update.ts` | `src/harness/update.ts` | `ff update` 的核心行为是刷新 harness 产物。 |
| `src/validate.ts` | `src/project/validate.ts`，由 `src/project/index.ts` 暴露 | 项目结构校验、doctor 汇总归属 project；对 harness 产物的检查通过 `harness/` 公开入口。 |
| `src/workflow.ts` | `src/workflow/index.ts` | clarify/plan/run/check/finish/resume/discard/understand 编排归属 workflow。 |

## Key Decisions

- `package.json` 的 `main`、`types`、`bin` 路径保持不变：`./dist/src/index.js`、`./dist/src/index.d.ts`、`./dist/src/cli.js`、`./dist/src/agent-command.js` 都不能因为本次重组改变。
- `package.json` 只允许为了嵌套测试发现调整 `scripts.test`，例如让 Node test runner 执行 `dist/tests/**/*.test.js` 或等价递归发现方式。
- `src/index.ts` 保持当前产品级导出面。实现可以改 re-export 的内部路径，但不能新增低层 helper 导出。
- 根入口薄文件的判断标准是：只做启动、转发、错误出口和公开 re-export；业务规则、状态转换、文件格式处理、模板生成和 provider 逻辑都迁入能力目录。
- `src/domain/**` 不 import 产品能力模块；`src/shared/**` 不 import 产品能力模块，也不承载 Flowflow 业务规则。
- `src/tasks/**` 独占 task id、task.json、trace、archive、resume、selection 和 task lifecycle 目录规则。
- `src/workflow/**` 编排 workflow action，通过 `tasks/` 公开入口操作任务状态，不直接拼 task 存储路径或写 task 文件。
- `src/harness/**` 独占生成 skills、role agents、watchdog 等 harness 输出；`src/enhancements/**` 独占 enhancement provider 与 setup metadata。
- `ff-*` 分发烟测必须模拟真实 bin 名称，例如在临时目录创建名为 `ff-plan` 或 `ff-check` 的 symlink/copy 指向 `dist/src/agent-command.js` 后执行，触发 `agent-command` 对 `argv[1]` 的识别。不要只用额外参数测试 fallback 路径。

## Risks

- 大规模移动会产生 import 路径噪音，容易掩盖真实行为变化。降低风险的方式是按能力切片移动，每片后运行 `npm run typecheck` 或至少运行构建前的 TypeScript 检查。
- `paths.ts` 和 `templates.ts` 当前混合多个能力的概念，直接整文件移动会违反 spec 中 tasks 独占 task 路径规则的约束。实现时需要有限拆分。
- `tests/kernel.test.ts` 现在覆盖很多产品行为。拆分时如果按文件名机械分割，可能丢失端到端场景中的共享 setup 和断言语义。
- 架构测试本身可能过严，阻塞必要的内部协作。例外必须集中 allowlist，逐项说明原因，避免用宽泛通配绕过边界。
- `scripts.test` 的递归发现写法需要在当前 npm shell 和 Node 20 下验证。不能只假设 glob 会按预期展开。
- `agent-command` 烟测如果通过 `node dist/src/agent-command.js ff-plan` 实现，只覆盖 fallback 参数路径，无法证明真实 `ff-*` bin 分发。

## Validation Strategy

- 结构验证：
  - `src` 根目录只剩 `index.ts`、`cli.ts`、`agent-command.ts` 三个文件。
  - 每个能力目录存在 `index.ts`，跨能力 import 默认指向能力公开入口。
  - `src/index.ts` 导出清单与迁移前等价，没有扩大产品级导出面。
- 架构测试：
  - 覆盖 `domain/`、`shared/` 不依赖产品能力模块。
  - 覆盖跨能力 import 只能走公开入口或 allowlist 中的明确例外。
  - 覆盖根薄入口不承载业务规则。
  - 覆盖 `tests/support/` 只提供测试工具，不反向依赖具体测试文件。
- 行为测试：
  - 拆分后的测试继续覆盖 init/update/harness/enhancements/tasks/workflow/baseline/project validation 等现有行为。
  - 至少一个 `ff-*` agent command 使用真实 bin 名称完成分发烟测。
  - `npm test` 输出或断言能证明嵌套测试与架构边界测试实际执行。
- 最终命令：
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `node dist/src/cli.js validate --root .`
