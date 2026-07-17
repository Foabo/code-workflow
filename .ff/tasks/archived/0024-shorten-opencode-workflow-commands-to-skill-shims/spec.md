# Spec

## Goal

把 OpenCode workflow command 文件从完整复制 skill 指导改成薄 shim，减少 prompt 长度和重复内容，同时保持 `/ff-*` slash command 可发现、可执行，并把实际 workflow 规则交给对应 `.agents/skills/<command>/SKILL.md`。

## Scope

- 修改 OpenCode command renderer，使 `.opencode/commands/<command>.md` 只包含 `description` frontmatter、对应 skill 文件引用、`$ARGUMENTS` 用户参数入口和缺失 skill 时的停止说明。
- 保持 `.opencode/commands/<command>.md` 路径、doctor missing/stale 检查、init/update 生成行为不变。
- 更新 tests，断言 command 是薄 shim，不再包含完整 workflow 指导正文。
- 刷新当前仓库 `.opencode/commands/` generated outputs。
- 更新 Project Baseline 中 OpenCode command surface 的表述。

## Non-goals

- 不改变 `.agents/skills/<command>/SKILL.md` 的内容或生成规则。
- 不改变 Flowflow workflow semantics、role agents、watchdog、Codex/Claude/Pi/Cursor surfaces。
- 不删除 OpenCode command 文件。

## Constraints

- `.agents/skills/<command>/SKILL.md` 仍是 workflow 指导的 canonical generated skill surface。
- OpenCode command 只负责 slash menu discovery、参数传递和引用对应 skill。
- 如果 skill 文件不能通过 command template 引用加载，command 必须要求停止并报告缺失，而不是凭空继续。

## Decisions

- Command 正文使用 OpenCode `@.agents/skills/<command>/SKILL.md` 文件引用。
- Command 正文保留 `$ARGUMENTS`，让 slash command 后面的用户输入进入模型上下文。
- Doctor 仍按生成器输出逐字比较 OpenCode command currentness。

## Acceptance Criteria
- [x] 每个 `.opencode/commands/<command>.md` 是薄 shim：frontmatter 只有 `description`，正文引用 `@.agents/skills/<command>/SKILL.md` 并包含 `$ARGUMENTS`。
- [x] `.opencode/commands/ff-clarify.md` 不再复制 `## Clarify Protocol`、`## Workflow Steps`、`## Phase Guidance` 等完整 skill 指导正文。
- [x] OpenCode command missing/stale doctor 检查和 update 刷新行为保持通过。
- [x] `.agents/skills`、OpenCode role agents、watchdog 生成行为保持不变。
- [x] 通过 `npm run typecheck`、`npm test`、`npm run build`、`node dist/src/cli.js validate --root .`、`node dist/src/cli.js doctor --root .`、`git diff --check`。
