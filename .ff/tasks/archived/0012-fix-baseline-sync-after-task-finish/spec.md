# Spec

## Goal
Ensure CW reliably captures reusable project facts from task work and records a clear Baseline Outcome before finish.

## Scope
Add guidance so clarify and plan capture candidate reusable facts without treating them as final project truth.
Make check the required point that records the Baseline Outcome.
Update the task template and closure behavior so a task cannot finish without that outcome.
Keep finish as the explicit accept, select, edit, or skip decision point for an existing baseline delta.

## Non-goals
Do not require clarify, plan, and check to each create baseline-delta.md.
Do not make the CLI automatically summarize project knowledge.
Do not automatically modify .cw/project files.
Do not promote task-local details into Project Baseline.

## Constraints
Active task phases may write task-local facts and optional baseline-delta.md.
Project Baseline files update only through understand or finish.
Baseline Outcome must be explicit enough for closure gate enforcement.

## Decisions
Clarify captures confirmed long-term facts as candidates in task-local artifacts.
Plan captures stable design, workflow, command, or rule candidates in task-local artifacts.
Check owns the final Baseline Outcome: create or update baseline-delta.md, record that there is no reusable project fact, or record that a candidate is not stable enough yet.
Finish only handles user-confirmed baseline decisions when baseline-delta.md exists.

## Acceptance Criteria
- [x] New task.md files include a required Baseline Outcome check item.
- [x] Closure gate blocks finish when Baseline Outcome is not recorded.
- [x] cw-clarify generated guidance tells agents to capture confirmed long-term facts as candidates, without updating Project Baseline.
- [x] cw-plan generated guidance tells agents to capture stable design, workflow, command, or rule candidates.
- [x] cw-check generated guidance requires one Baseline Outcome: baseline-delta.md created or updated, no reusable project facts, or candidate not stable yet.
- [x] Existing baseline sync behavior for accepted, selected, edited, and skipped decisions remains unchanged.
- [x] cw-finish actively merges baseline-delta.md into Project Baseline by default when the delta is ordinary and unambiguous.
- [x] Running finish without a baseline decision treats an existing baseline-delta.md as accepted and preserves existing baseline content while merging the delta.
- [x] Verification commands pass.
