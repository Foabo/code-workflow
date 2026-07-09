# Baseline Delta

## overview.md

## architecture.md

- `src/tasks/` 负责确定性任务上下文包及其 manifest。它们是 task-local generated view，输入来自 task artifacts、trace、Project Baseline、git status 和 diff 输入。
- `src/harness/` 只在渲染 workflow skills 和 role agents 时消费 context package guidance；context package 的事实生成不归 `src/harness/` 所有。

## rules.md

- `.ff/tasks/<task-id>/context-package.md` 与 `.ff/tasks/<task-id>/context-package.manifest.json` 是 generated cache。Repo Truth 仍是 authored `.ff` task artifacts、Project Baseline、trace 和 Git。
- workflow 和 role guidance 可以使用 current context package 来减少重复读取。package 缺失、stale、不完整或包含 uncertain diff entry 时，必须读取原始 `.ff` 文件和 git 信息后再判断。
- reviewer/checker 不能只根据 diff summary 给出 spec verdict；必须同时对照 diff、task brief、accepted spec、acceptance criteria 和 verification evidence。
- context package manifest 包含 generator version 和输入 fingerprints。package 渲染语义变化时要 bump generator version，使旧 cache 自动刷新。

## commands.md

- `ff internal refresh-context-package --task <id>` 生成或刷新 `.ff/tasks/<task-id>/context-package.md` 与 `.ff/tasks/<task-id>/context-package.manifest.json`，并返回 status、stale flag、paths、metrics 和 diff classification。
