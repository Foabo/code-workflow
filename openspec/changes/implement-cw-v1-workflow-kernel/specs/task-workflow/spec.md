## ADDED Requirements

### Requirement: Create Task Truth
The system SHALL create task-local truth containing machine state, append-only trace events, and core task artifacts.

#### Scenario: Creating a task
- **WHEN** the user starts a new task through CW
- **THEN** the system creates task state, trace history, `spec.md`, `plan.md`, and `task.md`

#### Scenario: Recording task creation
- **WHEN** a task is created
- **THEN** the system appends a chronological trace event

### Requirement: Maintain Task Lifecycle And Hygiene
The system SHALL maintain explicit lifecycle, phase, next action, progress timestamp, health flags, artifact paths, invalidation state, and blocking or parking metadata for unfinished tasks.

#### Scenario: Multiple unfinished tasks exist
- **WHEN** a repository has multiple unfinished tasks
- **THEN** the system keeps each task distinguishable by lifecycle, phase, next action, and updated timestamp

#### Scenario: No ready state or result field
- **WHEN** task state is stored
- **THEN** the system uses lifecycle values open, blocked, parked, and closed without a ready lifecycle or closed result field

#### Scenario: Task cannot continue responsibly
- **WHEN** a necessary condition is missing
- **THEN** the system records blocked lifecycle, blocked reason, and next action

#### Scenario: User intentionally pauses work
- **WHEN** the user parks a task
- **THEN** the system records parked lifecycle and a resume condition without treating the task as an active failure

### Requirement: Advance Work Through Default Work Action
The system SHALL provide a default work action that semi-automatically advances task progress until user judgment or finish is needed.

#### Scenario: Work advances routine task progress
- **WHEN** the user invokes work for a task that can continue
- **THEN** the system may select or create the task, run preflight, clarify and update `spec.md`, update `plan.md` and `task.md`, run executable checklist work, and run check

#### Scenario: Work stops before finish
- **WHEN** check passes during work
- **THEN** the system stops and asks whether to finish instead of closing the task automatically

#### Scenario: Work encounters missing judgment
- **WHEN** work needs user input, a material trade-off decision, or a workflow override
- **THEN** the system pauses progress and records the required next action

### Requirement: Clarify Task Spec
The system SHALL clarify a task into an accepted task-local spec before implementation proceeds.

#### Scenario: Spec accepted
- **WHEN** the user accepts the clarified goal, scope, constraints, decisions, and acceptance criteria
- **THEN** the system updates `spec.md` and advances the task toward planning

#### Scenario: Missing required information
- **WHEN** clarification cannot responsibly continue without user input
- **THEN** the system marks the task blocked with a blocked reason and next action

### Requirement: Plan Task Work
The system SHALL convert an accepted task spec into an implementation plan and executable checklist.

#### Scenario: Planning succeeds
- **WHEN** the task has a usable spec
- **THEN** the system updates `plan.md`, updates `task.md`, appends trace evidence, and advances the task toward run

#### Scenario: Planning finds unclear spec
- **WHEN** planning finds that the spec is insufficient
- **THEN** the system returns the task to clarification or blocks the task with a clear next action

### Requirement: Run Checklist Work
The system SHALL execute implementation work through the task checklist.

#### Scenario: Running next work
- **WHEN** the user runs a task with executable checklist items
- **THEN** the system performs or guides the next work, updates checklist progress, and appends trace evidence

### Requirement: Check Implementation
The system SHALL combine verification and review in a check action that validates implementation against the task spec, plan, and checklist.

#### Scenario: Check passes
- **WHEN** verification and review satisfy the task spec and checklist
- **THEN** the system records check progress and advances the task toward finish

#### Scenario: Check detects drift
- **WHEN** implementation changes the task contract or invalidates the plan
- **THEN** the system prevents finish readiness until `spec.md`, `plan.md`, or `task.md` is updated

#### Scenario: Manual verification recorded
- **WHEN** verification cannot be represented only by commands
- **THEN** the system records manual verification status in task checklist progress and trace evidence

### Requirement: Finish Through Closure Gate
The system SHALL close completed tasks only through finish and Closure Gate checks.

#### Scenario: Direct lifecycle close rejected
- **WHEN** a workflow tries to set lifecycle directly to closed outside finish
- **THEN** the system rejects the mutation and requires finish

#### Scenario: Finish succeeds
- **WHEN** acceptance criteria and checklist completion are sufficient, unresolved drift is absent, and dirty worktree state is handled
- **THEN** the system sets lifecycle to closed, clears consumed resume state, and appends finish trace evidence

#### Scenario: Finish fails
- **WHEN** Closure Gate finds incomplete acceptance criteria, incomplete checklist work, unresolved drift, or ambiguous dirty worktree state
- **THEN** the system refuses to close the task and reports the blocking issues

### Requirement: Resume User-Triggered Notes
The system SHALL support at most one user-triggered resume note per task and consume it after successful progress.

#### Scenario: Resume note consumed
- **WHEN** the user resumes a task from `resume.md` and subsequent workflow progress is recorded
- **THEN** the system clears the resume artifact and removes the resume note

### Requirement: Discard Abandoned Tasks
The system SHALL discard abandoned tasks only after explicit confirmation and selected worktree handling.

#### Scenario: Discard confirmed
- **WHEN** the user confirms discard and selects worktree handling
- **THEN** the system removes the task record instead of marking the task closed

#### Scenario: Shared worktree discard
- **WHEN** the task shares the current Git worktree
- **THEN** the system asks the user whether to keep, revert, stash, or otherwise handle uncommitted changes before removing the task

#### Scenario: Isolated worktree discard
- **WHEN** the task uses an isolated Git worktree
- **THEN** the system may delete the isolated worktree after explicit confirmation

#### Scenario: Discard not confirmed
- **WHEN** the user attempts discard without confirmation
- **THEN** the system refuses to remove task records
