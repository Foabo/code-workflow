## 1. Repository Setup

- [x] 1.1 Implement issue 0001: initialize a usable CW repository with version state, baseline templates, task templates, validation, doctor health, idempotency, and skippable enhancement prompts.
- [x] 1.2 Implement issue 0002: generate harness-native `cw-*` command entries through init and update, including generic and supported native harness outputs.
- [x] 1.3 Implement issue 0012: support optional code intelligence and external memory/context enhancement configuration without making enhancements required.

## 2. Core Task Workflow

- [x] 2.1 Implement issue 0003: create and clarify a task into `spec.md`, with task state, trace events, accepted spec progression, and blocked-state handling.
- [x] 2.1a Enforce lifecycle/schema hygiene: multiple unfinished tasks, open/blocked/parked/closed lifecycle, no ready state, no result field, next action, timestamps, health flags, and blocking/parking metadata.
- [x] 2.2 Implement issue 0004: plan a task into `plan.md` and `task.md`, with implementation, verification, and check checklist sections.
- [x] 2.3 Implement issue 0005: run and check a task through the checklist loop, including verification command recording, review against spec and plan, and drift handling.
- [x] 2.4 Implement issue 0006: finish a task through Closure Gate, including rejection of direct close, checklist completeness, dirty worktree handling, resume cleanup, and lifecycle closure.
- [x] 2.5 Ensure `cw-work` can create/select, preflight, clarify, plan, run, check, and stop before finish.

## 3. Baseline And Recovery

- [x] 3.1 Implement issue 0007: promote Project Baseline updates from `baseline-delta.md` during finish with preview, confirmation, sync decision tracing, accepted and skipped paths.
- [x] 3.1a Support baseline delta select and edit outcomes in addition to accept and skip.
- [x] 3.2 Implement issue 0008: resume a task from a user-triggered `resume.md`, enforce at-most-one note, consume it, and clear state.
- [x] 3.3 Implement issue 0009: discard an abandoned task safely with explicit confirmation and selected worktree handling.
- [x] 3.4 Implement issue 0011: draft existing-repo Project Baseline files with `cw-understand` without directly overwriting baseline files.

## 4. Health And Orchestration

- [x] 4.1 Implement issue 0010: run action-local preflight and repository doctor, including task state, lifecycle, artifacts, stale resume, dirty worktree, schema, and adapter drift checks.
- [x] 4.2 Implement issue 0013: encode inline, subagent, and hybrid execution strategy guidance in generated command entries.
- [x] 4.3 Verify generated execution strategy guidance covers hybrid recommendation, implementer no-close rule, checker drift escalation, and constrained subagent context.

## 5. End-to-End Proof

- [x] 5.1 Implement issue 0014: prove the full v1 workflow end to end from an empty temporary repository through init, work, clarify, plan, run, check, baseline sync, finish, resume, discard, understand, and doctor.
