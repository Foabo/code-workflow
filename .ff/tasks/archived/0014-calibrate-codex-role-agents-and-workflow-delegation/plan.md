# Plan

## Approach
1. 调整 Codex role model contract。
   - 修改 `.cw/orchestration.json` 的 `harness_overrides.codex`，按 spec mapping 设置六个角色。
   - 保持 `src/orchestration.ts` 的通用默认不变，让默认仍可继承平台模型。

2. 强化 generated workflow guidance。
   - 在 `src/adapters.ts` 中扩展 Execution Strategy Guidance，使它包含明确的 role routing。
   - 为 `cw-work`、`cw-plan`、`cw-run`、`cw-check`、`cw-finish` 补充具体调用点。
   - 保持 support commands 没有泛化 delegation 段落。

3. 刷新 generated artifacts。
   - 运行 `cw update --harness codex`。
   - 检查 `.codex/agents` 和 `.agents/skills` 的输出。

4. 更新测试。
   - 覆盖 Codex role-specific rendering。
   - 覆盖 generated guidance 中的 planner/reviewer/implementer/checker/baseline-writer routing。

## Key Decisions
- 使用 `gpt-5.5` 承担高风险和主实现角色，使用 `gpt-5.4-mini` 承担验证整理和 baseline 草稿等更轻任务。
- `xhigh` 只保留给 advisor，因为它的 blocker 会影响流程推进；planner/reviewer 用 `high`，implementer/checker 用 `medium`，baseline-writer 用 `low`。
- CW guidance 要明确“调用哪个 role agent”，同时保留 inline fallback。

## Risks
- 当前工作区已有 0013 的未提交改动，可能影响全量测试结果；本任务不能覆盖那些文件的已有内容。
- 如果只改 `.codex/agents`，下一次 `cw update` 会覆盖结果；必须同步 `.cw/orchestration.json`。
- 如果 guidance 写得过于强制，可能让简单任务产生不必要的 subagent 开销；需要把 delegation 条件限制在有明确收益的流程点。

## Validation Strategy
- 检查 `.codex/agents/cw-*.toml` 的模型字段。
- 使用 tests 覆盖 generated Codex artifacts。
- 运行 typecheck、test、build、validate。
