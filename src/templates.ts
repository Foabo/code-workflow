export const PROJECT_BASELINE_TEMPLATES: Record<string, string> = {
  "overview.md": `# Project Overview

## Purpose

## Current Shape

## Major Capabilities

## Non-goals
`,
  "architecture.md": `# Architecture

## Stack

## Modules

## Data Flow

## Integration Points

## Constraints
`,
  "rules.md": `# Rules

## Coding

## Testing

## Review

## Agent Rules

## Do Not
`,
  "commands.md": `# Commands

## Setup

## Run

## Test

## Lint

## Typecheck

## Build

## Troubleshooting
`
};

export const TASK_ARTIFACT_TEMPLATES: Record<string, string> = {
  "spec.md": `# Spec

## Goal

## Scope

## Non-goals

## Constraints

## Decisions

## Acceptance Criteria
- [ ] 
`,
  "plan.md": `# Plan

## Approach

## Key Decisions

## Risks

## Validation Strategy
`,
  "task.md": `# Task

## Implementation
- [ ] 

## Verification
- [ ] 

## Check
- [ ] Acceptance criteria in spec.md are covered.
- [ ] No unresolved drift between implementation and spec.
- [ ] Dirty worktree handling is clear.

## Notes
`,
  "baseline-delta.md": `# Baseline Delta

## overview.md

## architecture.md

## rules.md

## commands.md
`,
  "resume.md": `# Resume

## Situation

## Next Action

## References
`
};

export const AGENT_COMMANDS = [
  "cw-work",
  "cw-clarify",
  "cw-plan",
  "cw-run",
  "cw-check",
  "cw-finish",
  "cw-resume",
  "cw-discard",
  "cw-doctor",
  "cw-understand"
] as const;
