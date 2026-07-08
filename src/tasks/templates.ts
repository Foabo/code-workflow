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
- [ ] Baseline Outcome is recorded.

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
