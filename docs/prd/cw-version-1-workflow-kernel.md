# PRD: CW Version 1 Workflow Kernel

Label: `ready-for-agent`

## Problem Statement

Developers using coding harnesses often lose task state across sessions, repeat context building, let implementation drift away from the task spec, and finish tasks without a clear contract, checklist, verification, or project knowledge update. Existing spec-driven and workflow tools contain useful ideas, but adopting any one framework directly would force CW into someone else's runtime, file model, or harness assumptions.

The user wants CW to be a finished, agent-native workflow tool for coding harnesses: light enough to use by default, strict enough to prevent task rot and false finish, and structured enough to let different coding harnesses share the same repository-local task truth.

## Solution

Build CW version 1 as a TypeScript/Node.js workflow kernel for coding harnesses. CW provides `cw-*` agent commands, deterministic kernel helpers, a minimal Repo Truth, small task artifacts, Project Baseline files, preflight checks, finish closure checks, user-triggered resume notes, discard handling, optional existing-repo understanding, and skippable enhancement configuration.

Users work primarily through agent commands such as `cw-work`, `cw-clarify`, `cw-plan`, `cw-run`, `cw-check`, and `cw-finish`. The CLI remains a thin setup and maintenance surface. CW keeps task truth in small repository-local files, relies on Git for code changes, and promotes stable task learnings into Project Baseline files only when a task finishes.

## User Stories

1. As a developer, I want to initialize CW in a repository, so that coding harnesses can share one task workflow.
2. As a developer, I want init to create a small Repo Truth structure, so that setup is immediate and not a documentation project.
3. As a developer, I want init to generate selected coding harness entries, so that I can use CW from the harness I already work in.
4. As a developer, I want CW commands to use a `cw-` prefix, so that they do not collide with harness or plugin commands.
5. As a developer, I want optional code intelligence prompts during init, so that I can configure useful enhancements without making them required.
6. As a developer, I want optional external memory/context detection during init, so that CW can warn me about memory tools without treating them as truth.
7. As a developer, I want to skip every enhancement during init, so that the core workflow still works in a plain repository.
8. As a developer starting a new project, I want to go from init directly to work, so that I do not need to invent a full project architecture upfront.
9. As a developer onboarding an existing project, I want an understand action, so that CW can draft project background from current repository facts.
10. As a developer, I want understand to create drafts before changing baseline knowledge, so that automatic scans do not pollute project truth.
11. As a developer, I want sparse Project Baseline templates, so that agents have stable locations for reusable project knowledge.
12. As a developer, I want Project Baseline files for overview, architecture, rules, and commands, so that agents can reuse stable context across tasks.
13. As a developer, I want glossary support to be optional, so that simple projects do not carry an empty terminology document.
14. As a developer, I want to start or continue a task with `cw-work`, so that one command can advance routine work.
15. As a developer, I want `cw-work` to stop after check and ask before finish, so that task closure and baseline updates remain intentional.
16. As a developer, I want `cw-clarify` to question unclear requirements, so that the task spec is accepted before implementation.
17. As a developer, I want `cw-clarify` to update only the task spec, so that clarification does not accidentally write code or project baseline files.
18. As a developer, I want `cw-plan` to create the implementation approach and checklist, so that implementation has an executable path.
19. As a developer, I want `cw-run` to execute the next checklist items, so that coding work stays tied to the task plan.
20. As a developer, I want `cw-check` to combine verification and review, so that I do not maintain separate verification and review documents for every task.
21. As a developer, I want `cw-check` to update the task checklist, so that finish can rely on one clear execution record.
22. As a developer, I want `cw-check` to detect spec or plan drift, so that implementation changes do not silently invalidate the task.
23. As a developer, I want `cw-finish` to be the only normal way to close a task, so that completed tasks pass a consistent Closure Gate.
24. As a developer, I want no separate close or archive action, so that the end of a task is not split across overlapping concepts.
25. As a developer, I want `cw-discard` to abandon unwanted tasks, so that unfinished work can be removed without pretending it was completed.
26. As a developer, I want discard to ask how to handle shared-worktree changes, so that code is not accidentally lost or retained.
27. As a developer using isolated worktrees, I want discard to delete a task worktree after confirmation, so that abandoned experiments are easy to clean up.
28. As a developer, I want `cw-resume` to consume a user-created resume note, so that I can intentionally continue from a short handoff point.
29. As a developer, I want resume notes to be optional, so that normal recovery depends on task state and artifacts instead of another required file.
30. As a developer, I want a consumed resume note to be deleted after progress, so that stale resume text does not pollute later sessions.
31. As a developer, I want `cw-doctor` to inspect workflow health, so that stale tasks, malformed state, and adapter drift are visible.
32. As a developer, I want action-local preflight checks, so that common issues are caught before work, run, check, finish, resume, or discard.
33. As a developer, I want doctor to remain a manual repo-level health check, so that normal actions do not feel like a full audit every time.
34. As a developer, I want each task to have a small machine-readable state record, so that agents and helpers can recover phase, lifecycle, next action, and artifact paths.
35. As a developer, I want each task to have append-only trace events, so that sessions can recover what happened without reading chat history.
36. As a developer, I want trace events to be JSONL, so that helpers can append and parse them reliably.
37. As a developer, I want task artifacts to be limited to spec, plan, and task checklist, so that the workflow stays lightweight.
38. As a developer, I want a task spec to evolve during the task, so that clarified requirements and drift corrections are captured before finish.
39. As a developer, I want a plan to describe approach rather than become a checklist, so that implementation rationale stays separate from done/not-done status.
40. As a developer, I want the task checklist to cover implementation, verification, and check items, so that finish can inspect one concise record.
41. As a developer, I want optional baseline deltas, so that candidate project knowledge can be collected without changing Project Baseline mid-task.
42. As a developer, I want baseline updates only through understand or finish, so that active task phases do not pollute stable project knowledge.
43. As a developer, I want finish to preview baseline deltas, so that I can confirm which facts become project-level knowledge.
44. As a developer, I want to accept, select, edit, or skip baseline delta sync, so that I control long-lived project knowledge.
45. As a developer, I want high-impact baseline changes to require explicit confirmation, so that architecture and product facts are not changed casually.
46. As a developer, I want Git to remain the source of truth for code changes, so that CW does not maintain a second diff ledger.
47. As a developer, I want finish to inspect dirty worktree state, so that a task is not closed with ambiguous code changes.
48. As a developer, I want unrelated dirty worktree changes to be acknowledged rather than recorded in a change inbox, so that CW stays simple.
49. As a developer, I want ambiguous dirty worktree state to block finish, so that task closure does not hide unclear code changes.
50. As a developer, I want multiple open tasks, so that real work can interleave implementation, blocked work, parked ideas, and review.
51. As a developer, I want each unfinished task to have lifecycle, phase, next action, and progress metadata, so that open work does not rot.
52. As a developer, I want blocked tasks to record why progress cannot continue, so that later sessions know what decision or condition is missing.
53. As a developer, I want parked tasks to be intentionally paused without being treated as broken, so that backlog-like work does not constantly nag me.
54. As a developer, I want no ready lifecycle state, so that readiness is expressed by lifecycle, phase, and next action instead of another ambiguous status.
55. As a developer, I want closed to mean finished, so that task lifecycle stays simple.
56. As a developer, I want agent commands to use helpers for structured state changes, so that agents do not hand-edit state files.
57. As a developer, I want agents to semantically edit Markdown artifacts, so that task and baseline text remains natural and useful.
58. As a developer, I want helper validation after agent edits, so that broken state or malformed artifacts are caught.
59. As a developer, I want inline execution to be fully supported, so that CW works even when a harness has no subagent support.
60. As a developer, I want hybrid execution to be the recommended default, so that coordination stays in the main session while implementation and checking can use subagents.
61. As a developer, I want subagents to receive constructed context rather than full chat history, so that context remains efficient.
62. As a developer, I want implementer subagents to run code work but not close tasks, so that task closure remains controlled.
63. As a developer, I want checker subagents to return drift or product behavior changes to the main session, so that user decisions are not hidden inside delegation.
64. As a harness adapter author, I want native generated files per harness, so that CW does not force one cross-platform frontmatter format.
65. As a harness adapter author, I want generated files to point back to Repo Truth, so that platform files do not become canonical state.
66. As a harness adapter author, I want adapter generation to share command semantics, so that harnesses do not drift in behavior.
67. As a CW maintainer, I want TypeScript and Node.js implementation, so that file workflow, CLI, adapters, and tests can be built quickly with type safety.
68. As a CW maintainer, I want public CLI setup and maintenance commands only, so that daily workflow remains agent-native.
69. As a CW maintainer, I want internal helper commands, so that state mutation can be tested independently of natural language behavior.
70. As a CW maintainer, I want schema validation for version and task state records, so that malformed Repo Truth is caught early.
71. As a CW maintainer, I want project validation to be callable from tests and CLI, so that generated structures are externally observable.
72. As a CW maintainer, I want adapter generation tests at the highest seam, so that generated harness files are verified by user-visible outputs.
73. As a CW maintainer, I want workflow action tests at the dispatcher seam, so that a complete task path is verified as behavior.
74. As a CW maintainer, I want finish tests to exercise Closure Gate failure and success, so that tasks cannot be closed by bypassing the workflow.
75. As a CW maintainer, I want discard tests to require confirmation, so that abandoned work is not removed accidentally.
76. As a CW maintainer, I want understand tests to verify drafts, so that existing-repo analysis does not directly overwrite baseline files.
77. As a CW maintainer, I want baseline sync tests to verify accepted delta application, so that stable facts are promoted intentionally.
78. As a CW maintainer, I want self-use artifacts in this repository, so that CW can evolve through the workflow it defines.
79. As a future plugin integrator, I want skills, MCP tools, memory tools, and codebase index tools treated as optional enhancements, so that they improve workflow without becoming Repo Truth.
80. As a future plugin integrator, I want a dedicated later design for orchestration and ecosystem integration, so that v1 remains focused while leaving an extension path.

## Implementation Decisions

- Build CW version 1 in TypeScript on Node.js, distributed as an npm package with a public CLI and generated agent-command surfaces.
- Use agent-native `cw-*` commands as the daily invocation surface and keep the public CLI focused on setup, validation, update, and diagnostics.
- Implement deterministic kernel helpers for structured state mutation, trace appends, schema validation, resume consumption, and lifecycle transitions.
- Keep Repo Truth repository-local, with machine-readable version and task state records, append-only JSONL trace events, concise Project Baseline files, and small task artifacts.
- Keep first-version task artifacts to task spec, implementation plan, and executable checklist, with optional baseline delta and optional resume note.
- Use lifecycle values open, blocked, parked, and closed. Do not add ready or result states.
- Model discard as task removal with explicit worktree handling, not as a closed task result.
- Make task spec the evolving task-level contract. Clarification writes it, and drift may require updating it before finish.
- Make plan the approach document and task checklist the executable progress record.
- Combine verification and review in the `check` workflow action and update the task checklist rather than creating separate verification/review artifacts.
- Make `work` semi-automatic: it can clarify, plan, run, and check, but it stops before finish.
- Make finish the only normal path to closed. Finish runs Closure Gate, handles dirty worktree state, optionally syncs baseline deltas, consumes resume notes, and closes the task.
- Keep resume user-triggered and task-local. Delete the current resume note after the first successful subsequent workflow action records progress.
- Keep Project Baseline to four default files for overview, architecture, rules, and commands. Optional glossary support can be added only when terminology needs are confirmed.
- Update Project Baseline only through understand or finish. Active task phases may update baseline deltas, but not baseline files.
- Use a task-local baseline delta as the candidate project knowledge patch. During finish, preview it, require confirmation, and have the agent semantically edit baseline files while helpers validate and record events.
- Do not maintain a global change inbox, changeset attribution ledger, mandatory touched-file list, token ledger, or provider cost record.
- Rely on Git as the source of truth for actual code changes. Preflight and finish may inspect dirty worktree state when relevant.
- Support multiple open tasks while requiring each unfinished task to have lifecycle, phase, next action, timestamps, and any blocking or resume metadata.
- Treat preflight as action-local automatic checking and doctor as manual repository-level health checking.
- Implement init as a lightweight setup that creates sparse baseline templates, task templates, version state, task storage, and selected harness entries.
- Let init ask only about selected harnesses, optional code intelligence, and optional external memory/context detection; all enhancements are skippable.
- Implement understand as draft-first existing-repo analysis. Drafts must be reviewed before semantic merge into Project Baseline.
- Treat agent orchestration as an execution strategy layer with inline, subagent, and hybrid strategies. Inline must fully work; hybrid is recommended where available.
- Generate native harness files per selected coding harness. Generated platform files are entry points and never canonical truth.
- Keep external frameworks, skills, MCP tools, memory tools, and codebase indexes as reference or optional enhancement layers, not core runtime dependencies.

## Testing Decisions

- Use the workflow dispatcher as the main behavioral test seam. A good test invokes workflow actions as a user-visible sequence and asserts observable repository outputs rather than internal helper details.
- Use init/update/adapter generation as the adapter seam. Tests should assert generated harness entry files, plugin manifests, command files, and skill content exist and point back to Repo Truth.
- Use finish as the closure seam. Tests should prove direct lifecycle closure is rejected, incomplete tasks fail the Closure Gate, and complete tasks close only through finish.
- Use project validation and doctor as repository health seams. Tests should verify initialized projects are valid and doctor reports healthy structure.
- Use task creation and state update as state-record seams. Tests should verify generated artifacts, lifecycle, phase, next action, and append-only trace events.
- Use resume creation and consumption as the resume seam. Tests should verify resume notes are task-local, recorded in state, and removed when consumed.
- Use baseline delta sync as the Project Baseline seam. Tests should verify accepted deltas update baseline files and skipped/edited paths are observable.
- Use discard as the abandoned-work seam. Tests should require explicit confirmation and verify task records are removed only after the selected handling path.
- Use understand as the existing-repo understanding seam. Tests should verify drafts are created and baseline files are not overwritten without a merge step.
- Use Git worktree handling through observable command outcomes and dirty-worktree checks, not by maintaining an internal touched-file ledger.
- Tests should check external behavior: files created, state transitions, trace events, generated command content, validation errors, and returned workflow results.
- Avoid testing private function internals unless they encode schema or transition rules that cannot be observed at a higher seam.
- Existing Node test coverage in the repository already exercises the highest useful seam through kernel API calls and an end-to-end completion path; new tests should extend that style.

## Out of Scope

- Replacing Claude Code, Codex, Cursor, OpenCode, Pi, or any other coding harness.
- Building a universal harness manager.
- Model routing as a core feature.
- Token usage, provider usage, cost accounting, or budget ledgers.
- A global change inbox or code-change ledger.
- Mandatory touched-file tracking.
- Raw chat history storage.
- Full terminal log storage.
- External memory as Repo Truth.
- Mandatory code intelligence or codebase index tools.
- Mandatory subagent support.
- A required bootstrap task for new projects.
- Auto-generating complete Project Baseline content during init.
- Auto-applying baseline deltas without user confirmation in v1.
- Publishing marketplace packages or installing global harness state.
- Issue tracker integration itself, except where later work chooses to add publishing adapters.

## Further Notes

The current repository already contains a TypeScript implementation skeleton, generated Codex plugin skills, kernel tests, ADRs, Project Baseline decisions, and a prior narrower PRD for Codex self-evolution. This PRD is the broader v1 product PRD and should supersede ad hoc conversation context when planning implementation work.

The primary test seam should remain the workflow kernel API and CLI-observable repository outputs. The ideal number of major seams is one: invoke CW at the workflow/action level and assert the resulting Repo Truth, generated files, and user-visible command behavior.

The issue tracker target and label vocabulary are not configured in this repository. This PRD is marked locally with `ready-for-agent`; publishing to an external tracker is blocked until a remote issue tracker or publishing adapter is configured.
