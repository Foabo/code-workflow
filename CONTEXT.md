# Coding Workflow Kernel

This context defines the language for a repository-scoped coding workflow product that helps development tasks move through shared facts, phases, verification, review, finish, and optional resume notes across coding harnesses.

## Language

**Coding Workflow Kernel**:
A repository-scoped workflow product that turns development requests into recoverable, verifiable task progress. It coordinates task facts and phase transitions across coding harnesses.
_Avoid_: Coding agent, coding harness manager, model router

**Coding Harness**:
An environment that can execute coding-agent work against a repository, such as Claude Code, Codex, Cursor, OpenCode, or Pi. It typically provides repository access, file editing, command execution, tool calling, context handling, and user interaction.
_Avoid_: Platform when referring to the executable coding environment

**Task Progress Quality**:
The degree to which a development task can move from request to implementation, verification, review, and finish without losing context or skipping required decisions.
_Avoid_: Agent capability, model intelligence

**Context Efficiency**:
The degree to which the workflow gives each task phase the relevant project facts, task facts, and code context it needs without repeatedly rebuilding or carrying unrelated history.
_Avoid_: Token budget, cost ledger, usage accounting

**Workflow Action**:
A named operation in the coding workflow, such as starting work, clarifying a request, producing a spec, building context, running implementation, verifying, reviewing, finishing, or writing a resume note. It can be exposed through an agent command, a skill, a prompt template, or a CLI wrapper.
_Avoid_: CLI command when referring to the operation itself

**Invocation Surface**:
The user-facing way a workflow action is invoked, such as an agent command, skill, prompt template, or CLI wrapper.
_Avoid_: Command when the surface could be non-CLI

**Agent Command**:
An invocation surface inside a coding harness that lets the user trigger a workflow action through the agent experience.
_Avoid_: Kernel helper, raw CLI

**Kernel Helper**:
A deterministic script, thin CLI, or library function used by workflow actions to read, validate, and mutate CW files consistently.
_Avoid_: User-facing command, coding agent

**CLI Wrapper**:
A thin command-line surface for initialization, diagnostics, schema validation, adapter generation, and automation around the workflow kernel.
_Avoid_: Primary product interface

**Workflow State Machine**:
The phase model that determines which workflow action can run next for a task and which task facts must exist before progress continues.
_Avoid_: Suggested checklist, loose process

**Compressed Path**:
A shorter approved path through the workflow for small or low-risk tasks. It still records task facts and phase outcomes, but uses fewer artifacts than the full path.
_Avoid_: Skipping the workflow, informal shortcut

**Workflow Override**:
An explicit exception to a workflow rule, recorded with a reason so future sessions can understand why the normal path was bypassed.
_Avoid_: Silent skip, manual workaround

**Workflow Role**:
A responsibility profile in the workflow, such as clarifier, spec writer, planner, context builder, implementer, verifier, reviewer, finisher, or resume writer. A role can be mapped to a dedicated subagent or combined with other roles inside one invocation surface.
_Avoid_: Subagent when the platform does not require a separate agent file

**Execution Strategy**:
The way a coding harness runs workflow actions: inline in the main session, delegated to subagents, or a hybrid of main-session coordination and subagent execution.
_Avoid_: Workflow state, task lifecycle

**Repo Truth**:
The repository-local source of truth for workflow facts, task state, task artifacts, decisions, finish state, and optional resume notes.
_Avoid_: Platform files, external memory, chat history

**Project Baseline**:
The repository-level project understanding that coding harnesses can reuse across tasks, covering overview, architecture, rules, and commands.
_Avoid_: Task spec, generated wiki, full code index

**Baseline Delta**:
A task-local candidate patch describing stable project facts that may be promoted into the project baseline during finish.
_Avoid_: Project baseline, task spec

**Task Spec**:
The current task-level contract for a piece of work, including goal, scope, non-goals, constraints, decisions, and acceptance criteria. It may be updated during a task when clarification, implementation, verification, or review changes the task contract.
_Avoid_: Project baseline, implementation plan

**Task State Record**:
The machine-readable record of a task's identity, current phase, status, artifacts, invalidations, overrides, and recovery information.
_Avoid_: Task document, chat summary

**Task Artifact**:
A human-readable task-local Markdown file that records the task contract, execution plan, checklist, optional baseline delta, or optional resume note.
_Avoid_: Raw log, transcript, scratch note

**Reference Framework**:
An external workflow, spec, skill, memory, or harness-configuration project used as design input for CW. A reference framework can inspire adapters, templates, or heuristics, but it does not define CW's runtime or repository truth.
_Avoid_: Core dependency, source of truth

**Optional Enhancement**:
A non-core tool or integration that can improve project understanding, code search, memory awareness, or workflow ergonomics without becoming required for the task workflow.
_Avoid_: Core dependency, repo truth

**Agent-driven Semi-automation**:
A workflow mode where the coding harness advances deterministic task phases automatically and pauses for user input when requirements, trade-offs, failures, or irreversible decisions need human judgment.
_Avoid_: Fully autonomous execution, manual-only checklist

**Task Hygiene**:
The workflow discipline that keeps every unfinished task in an explicit state with a current phase, next action, progress timestamp, and any blocking or resume condition.
_Avoid_: Single-task lock, informal backlog cleanup

**Task Lifecycle**:
The small set of coarse task states: open, blocked, parked, or closed. Open means the task can start or continue attempting progress, blocked means a necessary condition is missing, parked means the user intentionally paused the task, and closed means the task is finished.
_Avoid_: Phase, health flag, detailed task status

**Finish**:
The workflow action that attempts to close a task by running the closure gate and recording the task's final outcome.
_Avoid_: Archive, handoff

**Discard**:
A maintenance action that abandons a task by removing its task record and handling any related worktree changes according to user choice.
_Avoid_: Finish, closed task result

**Resume Note**:
A short task-local note, written only when the user explicitly wants to pause, switch sessions, switch harnesses, or hand work to another agent. It points to existing task artifacts instead of duplicating them.
_Avoid_: Source of truth, full conversation summary, task completion state

**Open Task**:
An unfinished task that is still relevant to the repository and may continue through the workflow.
_Avoid_: Active task when the task is not currently being executed

**Health Flag**:
A non-lifecycle marker that calls attention to a task condition, such as stale, drift_suspected, dirty_worktree, verification_failed, review_blocked, or missing_next_action.
_Avoid_: Task lifecycle state, phase

**Drift Check**:
A workflow check that compares implementation changes, verification results, and review findings against the current task facts to detect when the spec, plan, context, or code no longer agree.
_Avoid_: General code review, formatting check

**Spec Drift**:
A mismatch where implementation or newly discovered facts change the task's intended behavior, constraints, non-goals, or acceptance criteria.
_Avoid_: Implementation bug, plan change

**Plan Drift**:
A mismatch where the implementation path or required work changes while the task's intended behavior remains the same.
_Avoid_: Spec change, unfinished work

**Out-of-band Change**:
A repository change whose relationship to the current task is unclear during workflow preflight or finish checks. Git remains the source of truth for the actual code change.
_Avoid_: Task implementation when attribution is unknown

**Change Sentinel**:
A lightweight detection role or hook that inspects repository change state during preflight to identify possible out-of-band changes without storing a separate change ledger or performing deep review.
_Avoid_: Reviewer, implementation agent, background orchestrator

**Workflow Preflight**:
A lightweight check that runs before selected workflow actions to inspect task metadata and repository change state before the action proceeds.
_Avoid_: Full review, deep repository scan

**Dirty Worktree Handling**:
The closure-gate decision about whether current uncommitted Git changes are covered by the task's verification and review, unrelated but acknowledged, or too ambiguous for the task to finish.
_Avoid_: Change ledger, touched-file tracking

**Closure Gate**:
The final workflow check that decides whether a task can be responsibly closed after implementation, verification, review, and reconciliation are complete.
_Avoid_: Review, verification, finish command
