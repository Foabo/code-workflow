## ADDED Requirements

### Requirement: Maintain Project Baseline
The system SHALL maintain concise Project Baseline files for reusable repository-level knowledge.

#### Scenario: Baseline exists after init
- **WHEN** a repository is initialized
- **THEN** the system provides baseline files for overview, architecture, rules, and commands

### Requirement: Understand Existing Repository Into Drafts
The system SHALL draft Project Baseline updates for existing repositories before changing baseline files.

#### Scenario: Understand creates drafts
- **WHEN** the user runs understand in an existing repository
- **THEN** the system creates draft overview, architecture, rules, and commands files separate from Project Baseline

#### Scenario: Understand observes commands
- **WHEN** repository scripts or equivalent configuration are present
- **THEN** the system includes observed commands in the commands draft

#### Scenario: Understand draft accepted
- **WHEN** the user accepts draft content from understand
- **THEN** the coding agent semantically merges accepted content into Project Baseline and the kernel helper validates and records the update

### Requirement: Promote Baseline Delta During Finish
The system SHALL promote task-local baseline deltas into Project Baseline only during finish and only with user confirmation.

#### Scenario: Baseline delta previewed
- **WHEN** finish sees a task-local baseline delta
- **THEN** the system previews the proposed Project Baseline updates before applying any change

#### Scenario: Baseline delta accepted
- **WHEN** the user accepts a baseline delta during finish
- **THEN** the system updates the selected Project Baseline files and records the sync decision

#### Scenario: Baseline delta selected
- **WHEN** the user selects only some baseline delta items during finish
- **THEN** the system applies only the selected updates and records the selection

#### Scenario: Baseline delta edited
- **WHEN** the user edits the baseline delta before sync
- **THEN** the system applies the edited updates, validates the resulting baseline files, and records the edit decision

#### Scenario: Baseline delta skipped
- **WHEN** the user skips baseline delta sync during finish
- **THEN** the system allows finish to continue without changing Project Baseline

#### Scenario: High-impact baseline change
- **WHEN** a baseline delta changes architecture, product capability, deletes content, conflicts with existing baseline, or has low confidence
- **THEN** the system requires explicit confirmation before applying it

#### Scenario: Baseline sync recorded
- **WHEN** baseline delta sync is accepted, selected, edited, or skipped
- **THEN** the system appends trace evidence with the sync decision

### Requirement: Keep Active Task Facts Local
The system SHALL keep active task facts in task artifacts until they are promoted through finish or understand.

#### Scenario: Active task updates candidate facts
- **WHEN** task work identifies candidate reusable project facts
- **THEN** the system records them in optional `baseline-delta.md` instead of directly editing Project Baseline
