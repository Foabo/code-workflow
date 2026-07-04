## ADDED Requirements

### Requirement: Generate Prefixed Agent Commands
The system SHALL generate coding-harness command entries using the `cw-` prefix.

#### Scenario: V1 command set generated
- **WHEN** command entries are generated for v1
- **THEN** the system generates entries for `cw-work`, `cw-clarify`, `cw-plan`, `cw-run`, `cw-check`, `cw-finish`, `cw-resume`, `cw-discard`, `cw-doctor`, and `cw-understand`

#### Scenario: Generic command generation
- **WHEN** initialization generates generic harness entries
- **THEN** each v1 workflow action has a generated `cw-*` command entry

#### Scenario: Harness-native command generation
- **WHEN** initialization targets a supported coding harness
- **THEN** the system generates native command or skill files for that harness

### Requirement: Treat Generated Files As Entry Points
The system SHALL make generated harness files point back to Repo Truth instead of becoming canonical workflow state.

#### Scenario: Generated command content
- **WHEN** the system generates a harness command entry
- **THEN** the generated content states that `.cw` is Repo Truth and references the relevant workflow action semantics

### Requirement: Regenerate Stale Entries
The system SHALL update generated harness entries without changing canonical task truth.

#### Scenario: Updating generated entries
- **WHEN** generated command files are stale
- **THEN** the update flow regenerates them from CW command semantics

### Requirement: Keep Public CLI Thin
The system SHALL expose setup and maintenance through the public CLI while keeping daily workflow agent-native.

#### Scenario: Public CLI use
- **WHEN** a user invokes the public CLI
- **THEN** the supported public operations are setup, validation, update, and diagnostics rather than the full daily task workflow

### Requirement: Use Internal Helpers For State Mutation
The system SHALL perform deterministic state mutation through kernel helpers rather than relying on agents to hand-edit structured files.

#### Scenario: Agent command mutates state
- **WHEN** a workflow action needs to update task state or trace events
- **THEN** the action uses a helper path that validates and writes structured state consistently
