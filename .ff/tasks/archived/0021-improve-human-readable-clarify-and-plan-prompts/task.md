# Task

## Implementation
- [x] 在 `src/harness/adapters.ts` 中为 `ff-clarify` 增加 plain-language guidance：跟随用户语言、解释必要术语、按目标/动机/范围/取舍/证据组织输出，避免黑话、空泛抽象、模板化 AI 句式和跳跃式结论。
- [x] 在 `src/harness/adapters.ts` 中为 `ff-plan` 增加 plain-language guidance：`plan.md` 和 `task.md` 必须写成可执行动作、具体取舍和验证证据，保留 spec quality gate 和不修改 `spec.md` 的规则。
- [x] 保持现有 clarify gate、proposal identity、advisor review、accept-spec、validate-clarify、phase movement 和 spec quality gate 语义不变。
- [x] 更新 `tests/harness/harness.test.ts`，断言生成的 `ff-clarify` skill 包含语言跟随、术语解释、反黑话、连续推理和行为审查相关指导。
- [x] 更新 `tests/harness/harness.test.ts`，断言生成的 `ff-plan` skill 包含计划/任务可执行化、证据导向验证、语言跟随和反抽象标签指导。
- [x] 构建后运行生成刷新命令，更新当前仓库的 Codex 和 Claude affected skill artifacts。
- [x] 检查生成刷新没有改动本任务范围外的 role-agent prompt 或受保护模型配置；如发生此类改动，暂停并确认处理方式。

## Verification
- [x] 运行 `npm run typecheck`。
- [x] 运行 `npm test`。
- [x] 运行 `npm run build`。
- [x] 运行 `node dist/src/cli.js validate --root .`。
- [x] 运行 `node dist/src/cli.js doctor --root .`。
- [x] 运行 `git diff --check`。
- [x] 检查 `.agents/skills/ff-clarify/SKILL.md` 和 `.agents/skills/ff-plan/SKILL.md` 包含新生成指导。
- [x] 检查 `.claude/skills/ff-clarify/SKILL.md` 和 `.claude/skills/ff-plan/SKILL.md` 包含新生成指导。
- [x] 第二轮 subagent 验证确认 `ff-clarify` 和 `ff-plan` 的行为级 concern 已解决。

## Check
- [x] Acceptance criteria in spec.md are covered.
- [x] No unresolved drift between implementation and spec.
- [x] Dirty worktree handling is clear.
- [x] Baseline Outcome is recorded.
- [x] 行为审查记录 `ff-clarify` 场景：中文用户抱怨 clarify/plan 黑话多、spec 跳跃时，新指导是否会促使代理先解释目标/动机/范围/取舍/验收证据，并避免无法判断的术语。
- [x] 行为审查记录 `ff-plan` 场景：已接受 spec 转为 plan/task 时，新指导是否会促使代理写出可执行动作、明确验证证据，并避免抽象标签堆叠。
- [x] 行为审查包含具体输入、预期失败模式、期望行为、reviewer verdict 和剩余风险。

## Notes
- Spec quality gate passed during planning: Goal concrete, Scope bounded to `ff-clarify`/`ff-plan`, Acceptance Criteria checkable, Decisions cover the relevant trade-offs.
- Planning used inline execution because subagent spawning requires explicit user authorization in this environment.
- Baseline candidate: generated `ff-clarify` and `ff-plan` guidance should include portable plain-language rules for user-visible output: follow the user's language, explain required workflow terms, connect motivation/scope/trade-offs/evidence, and avoid vague jargon or formulaic AI prose.
- Run updated adapter guidance, deterministic harness tests, Codex and Claude generated skill artifacts, and task-local baseline-delta.md. Check phase still owns formal acceptance coverage and behavior review.
- Check verification passed on 2026-07-09: `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, `node dist/src/cli.js doctor --root .`, and `git diff --check`.
- Artifact alignment review passed: `spec.md`, `plan.md`, and `task.md` cover the same scope, limited to `ff-clarify` / `ff-plan` generated prompt guidance. No runtime gate, helper semantics, role-agent prompt, or template redesign drift found.
- Acceptance evidence:
  - `ff-clarify` user-language and plain-term guidance is in `src/harness/adapters.ts`, `.agents/skills/ff-clarify/SKILL.md`, and `.claude/skills/ff-clarify/SKILL.md`.
  - `ff-clarify` anti-jargon and continuous-reasoning guidance is in `src/harness/adapters.ts`, `.agents/skills/ff-clarify/SKILL.md`, and `.claude/skills/ff-clarify/SKILL.md`.
  - `ff-plan` executable-action and evidence guidance is in `src/harness/adapters.ts`, `.agents/skills/ff-plan/SKILL.md`, and `.claude/skills/ff-plan/SKILL.md`.
  - `ff-plan` still preserves the existing spec quality gate and `spec.md` write boundary.
  - `tests/harness/harness.test.ts` now fails if the new generated `ff-clarify` / `ff-plan` plain-language guidance disappears.
  - Generated artifact refresh touched the affected Codex and Claude `ff-clarify` / `ff-plan` skill files from adapter source; role-agent prompt/config files have no diff.
- Behavior review, `ff-clarify` scenario: a Chinese user reports that clarify/plan output is full of jargon and produces jumpy specs. The new guidance tells the agent to match Chinese for visible clarify output, explain terms such as Proposed Spec, proposal identity, advisor review, and acceptance criteria by their decision purpose, and connect goal/motivation to scope/trade-offs/risks/evidence before asking for acceptance. This directly addresses vague specs, skipped rationale, unexplained terms, and acceptance criteria without evidence.
- Behavior review, `ff-plan` scenario: an accepted Chinese spec needs plan.md and task.md. The new guidance tells the agent to write planning text in Chinese, express plan.md/task.md as executable actions, concrete trade-offs, and verification evidence, and say what changes, why it stays inside the accepted spec, and how check can prove it. This reduces abstract labels and makes verification evidence part of the planning output.
- Behavior probe details are recorded in `behavior-review.md`, including concrete input, expected failure mode, desired behavior, reviewer verdict, and remaining risk for one `ff-clarify` sample request and one `ff-plan` accepted-spec scenario.
- Multi-agent validation:
  - First-round `ff-reviewer` found a `ff-clarify` concern: "Proposed Spec summaries" could leave the actual Proposed Spec unclear. Patch: require "Proposed Spec content and summaries", stronger term explanation, and a before-acceptance checklist. Second-round `ff-reviewer` verdict: pass.
  - First-round `ff-reviewer` found a `ff-plan` concern: plan/task output could still be topic labels. Patch: require accepted-criterion mapping to concrete action, target artifact or behavior, observable result, and verification evidence. Second-round `ff-reviewer` verdict: pass.
  - First-round `ff-advisor` found a blocker: task-local evidence lacked concrete behavior probes. Patch: require behavior probes in generated guidance and add `behavior-review.md` with structured probes. Third-round `ff-advisor` verdict: pass.
- Remaining non-blocking risk from advisor: `behavior-review.md` records structured reviewer outcomes rather than raw subagent transcripts, and the review is prompt-level behavior evidence rather than a live GLM/Qwen/DeepSeek execution transcript. The file states this limitation explicitly.
- Baseline Outcome: `baseline-delta.md` exists and records one stable reusable rule candidate under `rules.md`.
- Dirty worktree handling: all dirty entries are task-related source/test/generated/task artifacts for this change.
