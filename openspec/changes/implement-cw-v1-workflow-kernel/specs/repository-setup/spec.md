## ADDED Requirements

### Requirement: Initialize Repo Truth
The system SHALL initialize a repository with the minimal CW Repo Truth structure required for workflow use.

#### Scenario: Initializing an empty repository
- **WHEN** the user runs initialization in a repository without `.cw`
- **THEN** the system creates version state, Project Baseline templates, task storage, task artifact templates, and default generated command entries

#### Scenario: Re-running initialization
- **WHEN** the user runs initialization in a repository that already contains CW files
- **THEN** the system preserves existing user-editable files and reports existing files instead of overwriting them

### Requirement: Validate Initialized Structure
The system SHALL validate an initialized repository through observable project health checks.

#### Scenario: Valid initialized repository
- **WHEN** validation runs after initialization
- **THEN** the system reports no structural errors

#### Scenario: Doctor after initialization
- **WHEN** repository doctor runs after initialization
- **THEN** the system reports a healthy repository

### Requirement: Create Sparse Project Baseline Templates
The system SHALL create short Project Baseline template files for overview, architecture, rules, and commands.

#### Scenario: Baseline templates exist
- **WHEN** initialization completes
- **THEN** the repository contains sparse baseline templates that can be filled by understand or finish-time baseline promotion

### Requirement: Ask Skippable Enhancement Questions
The system SHALL allow users to configure optional code intelligence and external memory or context detection during initialization without making them required.

#### Scenario: User skips all enhancements
- **WHEN** the user declines optional enhancements
- **THEN** the initialized workflow remains fully usable

#### Scenario: User configures enhancements
- **WHEN** the user chooses optional enhancement configuration
- **THEN** the system records enhancement choices as recommendations or detection behavior, not Repo Truth
