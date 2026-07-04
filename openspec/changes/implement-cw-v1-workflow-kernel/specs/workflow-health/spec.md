## ADDED Requirements

### Requirement: Run Action Preflight
The system SHALL run lightweight preflight before key workflow actions.

#### Scenario: Preflight before key action
- **WHEN** the user runs work, run, check, finish, resume, or discard
- **THEN** the system checks selected task state, lifecycle and phase consistency, artifact presence, stale resume concerns, and relevant dirty worktree state

### Requirement: Diagnose Repository Health
The system SHALL provide a manual repository-level doctor command.

#### Scenario: Healthy repository
- **WHEN** doctor runs on a valid initialized repository
- **THEN** the system reports healthy workflow structure

#### Scenario: Unhealthy repository
- **WHEN** doctor finds malformed state, stale or blocked tasks, missing next action, schema mismatch, leftover resume notes, dirty worktree concerns, or adapter drift
- **THEN** the system reports structured health issues

#### Scenario: Missing Project Baseline files
- **WHEN** doctor finds that required Project Baseline files are missing
- **THEN** the system reports the missing files as workflow health issues

### Requirement: Keep Git As Code Change Truth
The system SHALL inspect Git state when needed without maintaining a separate code-change ledger.

#### Scenario: Dirty worktree during finish
- **WHEN** finish detects dirty worktree state
- **THEN** the system requires the state to be covered, acknowledged as unrelated, or clarified before closure

### Requirement: Support Execution Strategies
The system SHALL support inline, subagent, and hybrid execution strategies without changing task truth.

#### Scenario: Inline execution
- **WHEN** a coding harness lacks subagent support
- **THEN** the workflow remains fully usable in the main session

#### Scenario: Hybrid execution guidance
- **WHEN** a coding harness supports delegation
- **THEN** generated guidance recommends keeping coordination in the main session while delegating implementation or checking to subagents

#### Scenario: Subagent context limits
- **WHEN** a subagent performs workflow work
- **THEN** the subagent receives task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history

#### Scenario: Implementer cannot close task
- **WHEN** an implementer subagent performs workflow work
- **THEN** generated guidance forbids it from closing tasks

#### Scenario: Checker escalates drift
- **WHEN** a checker subagent finds spec drift or product behavior changes
- **THEN** generated guidance returns the decision to the main session for user confirmation

### Requirement: Treat Enhancements As Optional
The system SHALL treat code intelligence and external memory or context tools as optional enhancements.

#### Scenario: Enhancement absent
- **WHEN** no enhancement is configured
- **THEN** the core workflow remains usable and doctor does not fail core health because of the absence

#### Scenario: External memory present
- **WHEN** external memory or context tools are detected
- **THEN** the system treats them as session aids, not Repo Truth
