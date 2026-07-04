# Learnings

## [LRN-20260703-001] correction

**Logged**: 2026-07-03T23:48:01+08:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
When the user provides a design handoff and says to continue the goal, verify whether they expect implementation before editing design documents.

### Details
The user wanted implementation according to `DESIGN.md`; continuing the design discussion caused unwanted document edits that then had to be reverted.

### Suggested Action
For handoff-driven work, derive the concrete requested mode from the user's latest message before choosing design, planning, or implementation.

### Metadata
- Source: user_feedback
- Related Files: DESIGN.md

---

## [LRN-20260704-001] correction

**Logged**: 2026-07-04T10:51:31+08:00
**Priority**: high
**Status**: pending
**Area**: config

### Summary
Do not claim repository-local `.codex/prompts/` files are Codex command injection.

### Details
The Codex manual documents custom prompts under the local Codex home directory, such as `~/.codex/prompts`, and marks custom prompts deprecated in favor of skills. Repository-shared Codex extension should use `AGENTS.md`, skills, or repo marketplace plugins. The previous Codex adapter generated `.codex/prompts/` without evidence Codex would load it.

### Suggested Action
For Codex adapters, generate a repository marketplace plugin with skills, or project `AGENTS.md` guidance. Treat global custom prompts as an optional user-installed surface only.

### Metadata
- Source: user_feedback
- Related Files: src/adapters.ts, docs/prd/codex-self-evolution.md

---
