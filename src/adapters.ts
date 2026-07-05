import path from "node:path";
import { writeFile } from "node:fs/promises";
import { ensureDir, writeFileIfMissing } from "./fs.js";
import { AGENT_COMMANDS } from "./templates.js";

export type HarnessName = "codex" | "claude" | "opencode" | "pi";

export type AdapterResult = {
  harness: HarnessName;
  created: string[];
  existing: string[];
};

export type AdapterOptions = {
  overwrite?: boolean;
};

const commandPurposes: Record<(typeof AGENT_COMMANDS)[number], string> = {
  "cw-work": "Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.",
  "cw-clarify": "Review fuzzy intent, produce a user-confirmed Proposed Spec, then update spec.md with the accepted task contract.",
  "cw-plan": "Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.",
  "cw-run": "Execute the next checklist items from task.md, modify repository code, update progress, and append trace events through helpers.",
  "cw-check": "Run verification and review, reconcile drift, and update task.md before finish is allowed.",
  "cw-finish": "Run the closure gate, handle dirty worktree state, sync accepted baseline delta, consume resume notes, and close the task.",
  "cw-resume": "Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.",
  "cw-discard": "Abandon a task after user-confirmed worktree handling, then remove the task record.",
  "cw-doctor": "Inspect repository workflow health with cw doctor and report issues or warnings.",
  "cw-understand": "Draft project baseline updates for an existing repository, then ask the user what to merge."
};

const commandSteps: Record<(typeof AGENT_COMMANDS)[number], string[]> = {
  "cw-work": [
    "Run `cw preflight --action work`.",
    "If no task exists, create one with `cw internal create-task --title <title>` after deriving a clear title from the user request.",
    "Select the task with `cw internal select-task` or `cw internal select-task --task <task-id>`.",
    "Read spec.md, plan.md, task.md, and relevant project baseline files.",
    "Route by current task phase and artifact state: clarify, plan, run, check, or finish readiness.",
    "Apply the matching command behavior in this same agent session when the next step is clear.",
    "Stop for user judgment when the matching phase requires confirmation, new requirements, or product behavior decisions.",
    "When check passes, report finish readiness and ask whether to run cw-finish."
  ],
  "cw-clarify": [
    "Run `cw preflight --action clarify --task <task-id>` when a task id is known.",
    "Read the current spec.md and relevant project baseline files.",
    "Apply the clarify quality gate described below.",
    "Ask only the questions needed to settle goal, scope, non-goals, constraints, decisions, and acceptance criteria.",
    "Present a short Proposed Spec and wait for user confirmation before editing spec.md.",
    "Edit spec.md only with the accepted task contract.",
    "Run `cw internal set-state --task <task-id> --phase plan --next-action <text>` when the spec is accepted.",
    "If required information is missing, run `cw internal set-state --task <task-id> --lifecycle blocked --phase clarify --blocked-reason <reason> --next-action <text>`."
  ],
  "cw-plan": [
    "Run `cw preflight --action plan --task <task-id>`.",
    "Read spec.md and relevant project baseline files.",
    "Apply the spec quality gate described below.",
    "If the spec quality gate fails, return to cw-clarify behavior with one concrete next question.",
    "Edit plan.md with the implementation approach, key decisions, risks, and validation strategy.",
    "Edit task.md with executable implementation, verification, and check items.",
    "Run a post-plan artifact cross-review of spec.md, plan.md, and task.md before moving to run.",
    "Run `cw internal set-state --task <task-id> --phase run --next-action <text>`."
  ],
  "cw-run": [
    "Run `cw preflight --action run --task <task-id>`.",
    "Read spec.md, plan.md, task.md, and relevant code.",
    "Implement the next unchecked task.md items against the accepted spec.md and plan.md contract.",
    "Stop for user confirmation when work reveals requirement drift, plan contradiction, or product behavior outside scope.",
    "Add or update tests by default for behavior, workflow semantics, CLI/API behavior, state transitions, parsing, validation, and error handling.",
    "For simple file creation or replacement tasks, the executable shim may be called with `cw-run --task <task-id> --write-file <path> --content <text>`.",
    "Update task.md checklist progress.",
    "Record material progress with `cw internal append-trace --task <task-id> --type run.updated --summary <summary>`.",
    "Run `cw internal ensure-baseline-delta --task <task-id>` when stable reusable project facts are discovered.",
    "Run `cw internal set-state --task <task-id> --phase check --next-action <text>` when implementation items are complete enough to verify."
  ],
  "cw-check": [
    "Run `cw preflight --action check --task <task-id>`.",
    "Run the relevant commands from .cw/project/commands.md.",
    "For deterministic verification commands, the executable shim may be called with repeated `cw-check --task <task-id> --command <cmd>` flags.",
    "Run artifact alignment review against spec.md, plan.md, and task.md.",
    "Run implementation evidence review against every acceptance criterion.",
    "Fix small local defects when the task contract is unchanged.",
    "If spec drift appears, stop for user confirmation and update spec.md only after confirmation.",
    "Update task.md verification and check items.",
    "Append a check trace event with `cw internal append-trace --task <task-id> --type check.passed --summary <summary>` or `check.failed`.",
    "When check passes, run `cw internal set-state --task <task-id> --phase finish --next-action <text>`."
  ],
  "cw-finish": [
    "Run `cw preflight --action finish --task <task-id>`.",
    "Confirm dirty worktree handling when needed.",
    "Review check evidence, unresolved drift flags, dirty worktree handling, baseline decision, and final summary as the closure packet.",
    "If baseline-delta.md exists, prepare a current-state candidate diff for .cw/project files and ask whether to accept, select, edit, or skip it.",
    "After confirmation, run `cw internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped --edited-content <confirmed-current-state-sections>` when applicable.",
    "Run `cw internal finish-task --task <task-id> --summary <summary> --dirty-worktree <covered|unrelated|clean> --baseline <accepted|selected|edited|skipped|none>`.",
    "Report the closed task id and any project baseline files updated."
  ],
  "cw-resume": [
    "Run `cw preflight --action resume --task <task-id>`.",
    "Read resume.md together with task.json, trace.jsonl, spec.md, plan.md, and task.md.",
    "Continue from the task artifacts, using resume.md only as a pointer.",
    "Let the workflow kernel consume resume.md automatically after a later workflow action records progress."
  ],
  "cw-discard": [
    "Run `cw preflight --action discard --task <task-id>`.",
    "Inspect Git status and explain whether changes will be kept, stashed, reverted, or an isolated worktree will be deleted.",
    "Ask for explicit confirmation.",
    "Run `cw internal discard-task --task <task-id> --confirm --worktree <keep|stash|revert|delete-worktree|none>`."
  ],
  "cw-doctor": [
    "Run `cw doctor`.",
    "Report issues first, then warnings.",
    "For malformed or missing files, recommend the smallest repair.",
    "Do not change project baseline or task artifacts unless the user asks for repair."
  ],
  "cw-understand": [
    "Run `cw preflight --action understand`.",
    "Inspect repository structure, package files, commands, and existing docs.",
    "Draft candidate updates for .cw/project/overview.md, architecture.md, rules.md, and commands.md.",
    "Ask the user what to merge before editing project baseline files.",
    "After accepted edits, run `cw internal append-trace --task <task-id> --type baseline.updated --summary <summary>` only if this is tied to a task."
  ]
};

const commandGuidance: Partial<Record<(typeof AGENT_COMMANDS)[number], string[]>> = {
  "cw-work": [
    "`cw-work` is the routine progress command. Repeated `/cw-work` calls should be enough to advance ordinary work through clarify, plan, run, and check.",
    "The executable `work` helper creates or selects the task and returns actionable status. The generated skill performs the judgment-heavy orchestration: questioning, planning, code edits, verification, and review.",
    "Use task truth to choose the next responsibility: clarify means challenge and accept the task contract, plan means create or repair plan.md and task.md, run means execute unchecked implementation items, check means verify and review evidence, and finish means stop before closure.",
    "Delegation may help with implementation or checking only when the harness, tools, and user or environment permission allow it; otherwise route phases and perform the same responsibilities inline.",
    "Do not close tasks from `cw-work`. When the task is ready for finish, summarize the closure readiness and ask whether to run `cw-finish`.",
    "If the phase, artifacts, or user request conflict, stop and resolve the conflict through the matching phase guidance before making code changes."
  ],
  "cw-clarify": [
    "Clarify uses one process for all tasks. Smaller tasks are faster because fewer important uncertainties survive the challenge pass, not because challenge is skipped.",
    "Start with a challenge pass before writing Proposed Spec: restate the original problem and motivation, test assumptions, check scope boundaries, make acceptance criteria observable, name material risks, and ask whether there is a shorter path.",
    "If the challenge pass leaves important uncertainty, grill one question at a time. Include your recommended answer and the trade-off so the user can make a concrete decision.",
    "Use expand-then-grill when the request is broad, ambiguous, high risk, or affects workflow semantics, CLI/API behavior, task lifecycle, state machines, cross-module behavior, irreversible work, or baseline promotion.",
    "Expand around user-visible results, offer at most three candidate directions, and recommend one before grilling the chosen direction.",
    "Clarification is complete only when the goal, boundary, acceptance criteria, key risks, and important trade-offs are clear enough to write spec.md without high-risk assumptions.",
    "Before writing spec.md, present a Proposed Spec using the existing sections: Goal, Scope, Non-goals, Constraints, Decisions, and Acceptance Criteria. Continue asking if any high-risk assumption remains.",
    "Clarify terminology lightly. Task-local terms belong in spec.md; stable reusable project concepts may become baseline-delta.md candidates.",
    "For generated workflow guidance changes, challenge likely agent behavior directly: would this wording let an agent skip challenge, skip grill, move to plan/run too early, misuse subagents, or accept vague evidence?"
  ],
  "cw-plan": [
    "The spec quality gate checks that Goal is concrete, Scope bounds the work, Acceptance Criteria are checkable, and Decisions cover product trade-offs that affect implementation.",
    "Do not modify spec.md during planning. If the gate fails, block the task in clarify phase and provide one concrete next question in the blocked reason or next action.",
    "Plan from the accepted contract. Implementation choices may be recorded in plan.md only when they stay inside the confirmed spec.",
    "Break task.md implementation items into small, verifiable vertical slices. Keep file-level edits as implementation details, not primary checklist items.",
    "Post-plan artifact cross-review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work. Prefer an independent reviewer subagent only when the harness, tools, and user or environment permission allow delegation; otherwise run the same check inline.",
    "For generated workflow guidance changes, include behavior-review checks in task.md. Look for skipped challenge, skipped grill, unclear delegation permission, premature phase movement, and acceptance criteria without evidence.",
    "Keep deterministic tests separate from behavior review. Tests should verify generated output, while check-stage review evaluates likely agent behavior."
  ],
  "cw-run": [
    "Run executes the accepted task contract. Do not expand product behavior or implementation scope beyond spec.md and plan.md without user confirmation.",
    "Behavior changes require test evidence by default. Use red-green TDD when a clear public seam exists; use commands, fixtures, snapshots, file checks, or manual review when those are the right evidence.",
    "Use delegated implementers for independent vertical slices only when the harness, tools, and user or environment permission allow delegation; otherwise implement the same checklist items inline.",
    "Delegated implementers may write code and update checklist progress, but they must not close tasks or decide requirement drift.",
    "Domain modeling is optional. Use it only when terms or stable reusable project concepts change; otherwise record task-local terms in spec.md or task.md.",
    "External TDD, domain modeling, implement, Superpowers, or subagent skills may help when installed, but this generated guidance is sufficient to proceed without them."
  ],
  "cw-check": [
    "Artifact alignment review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work.",
    "Implementation evidence review maps every acceptance criterion to evidence in task.md Verification or Check entries. Evidence can be tests, commands, file checks, CI/CD or test-environment notes, or manual verification.",
    "CI/CD or test-environment evidence states environment, action, and result without relying on commit identity.",
    "Small local defects may be fixed during check when the accepted spec.md contract is unchanged. Changes to spec.md or out-of-scope implementation behavior return to clarify for user confirmation.",
    "Use an independent reviewer for broad, behaviorally large, or workflow-semantics changes only when the harness, tools, and user or environment permission allow delegation; otherwise perform the same artifact and evidence review inline.",
    "Run a final broad review when the change is cross-cutting, behaviorally large, or touches workflow semantics shared by multiple commands."
  ],
  "cw-finish": [
    "Finish closes the CW task. It does not create commits, require one final commit, push branches, open PRs, deploy, clean up branches, or record a commit ledger.",
    "The closure packet covers check evidence, unresolved drift, dirty worktree handling, baseline decision, and final summary.",
    "Project Baseline files are current-state descriptions. If baseline-delta.md exists, the finish-stage agent prepares a candidate diff that integrates the delta into existing .cw/project files.",
    "A fast inexpensive model may help draft the candidate baseline diff when available, but the generated skill must support inline preparation. The CLI core must not call an LLM.",
    "Apply baseline changes only after user confirmation. Helpers apply accepted current-state markdown sections or record skipped/selected decisions."
  ],
  "cw-resume": [
    "Resume is user-triggered continuation. Read resume.md after task.json, trace.jsonl, spec.md, plan.md, and task.md; task artifacts remain the task truth and resume.md is only a pointer.",
    "If the task is parked, resume may return it to open lifecycle for continuation while preserving the current phase and next action.",
    "Do not consume resume.md while loading resume context. The workflow kernel consumes it automatically after a later workflow action records material progress.",
    "If resume.md conflicts with task artifacts, trust the task artifacts and stop for user confirmation before changing spec.md, plan.md, or task.md.",
    "Report the loaded resume path, whether it was consumed, and the next action the agent should take."
  ],
  "cw-doctor": [
    "Doctor is repository-level diagnosis. It reports validation issues, hygiene warnings, generated adapter drift, and enhancement status.",
    "Report issues before warnings. For each item, include the file path or state field, the observed problem, and the smallest repair.",
    "Treat issues as invalid repository state and warnings as workflow hygiene risk; do not blur the two categories.",
    "Doctor is read-only by default. If the user asks for repair, make the smallest scoped change and use normal confirmation rules for task artifacts or Project Baseline files.",
    "Do not use doctor as the action-local gate; preflight owns action-local checks."
  ],
  "cw-understand": [
    "Understand is draft-first repository observation. Write candidates to .cw/understand-draft/ and never overwrite .cw/project/* automatically.",
    "Separate observed facts from inferences. Observed facts include files, package scripts, config, docs, dependencies, and existing .cw/project content; uncertain inferences should say Review required.",
    "Read the current Project Baseline before proposing a merge, and preserve user-authored current-state content unless the user accepts a replacement.",
    "Ask which drafted sections to merge. Merge only accepted content, and record a baseline.updated trace event only when the understand work is tied to a task.",
    "Do not promote task-local plans, aspirations, or one-off implementation details into Project Baseline."
  ]
};

const executionStrategyCommands = new Set<(typeof AGENT_COMMANDS)[number]>([
  "cw-work",
  "cw-plan",
  "cw-run",
  "cw-check"
]);

export async function generateAdapter(
  root: string,
  harness: HarnessName,
  options: AdapterOptions = {}
): Promise<AdapterResult> {
  if (harness === "codex") {
    return generateAgentSkillAdapter(root, harness, options);
  }
  if (harness === "claude") {
    return generateClaudeAdapter(root, options);
  }
  if (harness === "opencode") {
    return generateAgentSkillAdapter(root, harness, options);
  }
  if (harness === "pi") {
    return generateAgentSkillAdapter(root, harness, options);
  }
  throw new Error(`unsupported harness: ${harness satisfies never}`);
}

async function generateAgentSkillAdapter(
  root: string,
  harness: HarnessName,
  options: AdapterOptions
): Promise<AdapterResult> {
  const result: AdapterResult = { harness, created: [], existing: [] };
  const skillsRoot = path.join(root, ".agents", "skills");
  await ensureDir(skillsRoot);

  for (const command of AGENT_COMMANDS) {
    const skillDir = path.join(skillsRoot, command);
    await ensureDir(skillDir);
    await writeGenerated(root, path.join(skillDir, "SKILL.md"), renderHarnessSkill(command, harness), options, result);
  }

  return result;
}

async function generateClaudeAdapter(root: string, options: AdapterOptions): Promise<AdapterResult> {
  const result: AdapterResult = { harness: "claude", created: [], existing: [] };
  const skillsRoot = path.join(root, ".claude", "skills");
  await ensureDir(skillsRoot);

  for (const command of AGENT_COMMANDS) {
    const skillDir = path.join(skillsRoot, command);
    await ensureDir(skillDir);
    await writeGenerated(root, path.join(skillDir, "SKILL.md"), renderHarnessSkill(command, "claude"), options, result);
  }

  return result;
}

function renderWorkflowInstructions(command: (typeof AGENT_COMMANDS)[number]): string {
  return `# ${command}

${commandPurposes[command]}

## Required Reading

- .cw/version.json
- .cw/project/overview.md
- .cw/project/architecture.md
- .cw/project/rules.md
- .cw/project/commands.md
- Current task files under .cw/tasks/<task-id>/ when a task exists

## Rules

- Treat .cw task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use cw internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

${renderExecutionStrategyGuidance(command)}## Workflow Steps

${commandSteps[command].map((step, index) => `${index + 1}. ${step}`).join("\n")}${renderCommandGuidance(command)}

## Helper Commands

- cw validate
- cw doctor
- cw tasks
- cw preflight --action <action> [--task <task-id>]
- cw internal create-task --title <title> [--id <task-id>]
- cw internal select-task [--task <task-id>]
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary>
- cw internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- cw internal finish-task --task <task-id> --summary <summary>
- cw internal discard-task --task <task-id> --confirm --worktree <handling>
- cw internal create-resume --task <task-id> --content <markdown>
- cw internal ensure-baseline-delta --task <task-id>
- cw internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped
- cw internal consume-resume --task <task-id>
`;
}

function renderExecutionStrategyGuidance(command: (typeof AGENT_COMMANDS)[number]): string {
  if (!executionStrategyCommands.has(command)) {
    return "";
  }

  return `## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Delegation is optional and permission-bound; continue inline when delegation is unavailable or unauthorized.
- Delegated work receives task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Delegated agents must not close tasks; closure decisions and unresolved drift return to the main session.

`;
}

function renderCommandGuidance(command: (typeof AGENT_COMMANDS)[number]): string {
  const guidance = commandGuidance[command];
  if (guidance === undefined || guidance.length === 0) {
    return "";
  }
  return `

## Phase Guidance

${guidance.map((item) => `- ${item}`).join("\n")}
`;
}

function renderHarnessSkill(command: (typeof AGENT_COMMANDS)[number], harness: HarnessName): string {
  return `---
name: ${command}
description: ${commandPurposes[command]}
---

Use this skill when the user asks ${harnessLabel(harness)} to run \`${command}\` or the matching CW workflow action in this repository.

Before acting, read the repository's \`.cw\` files relevant to the current task. Treat \`.cw\` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

${renderWorkflowInstructions(command)}
`;
}

export function isGeneratedSkillCurrent(
  command: (typeof AGENT_COMMANDS)[number],
  content: string,
  skillsPath: ".agents/skills" | ".claude/skills"
): boolean {
  const harnesses: HarnessName[] = skillsPath === ".claude/skills" ? ["claude"] : ["codex", "opencode", "pi"];
  return harnesses.some((harness) => content === renderHarnessSkill(command, harness));
}

async function writeGenerated(
  root: string,
  filePath: string,
  content: string,
  options: AdapterOptions,
  result: AdapterResult
): Promise<void> {
  if (options.overwrite === true) {
    await writeFile(filePath, content, "utf8");
    result.created.push(relative(root, filePath));
  } else if (await writeFileIfMissing(filePath, content)) {
    result.created.push(relative(root, filePath));
  } else {
    result.existing.push(relative(root, filePath));
  }
}

function harnessLabel(harness: HarnessName): string {
  if (harness === "opencode") {
    return "OpenCode";
  }
  if (harness === "pi") {
    return "Pi";
  }
  return harness[0].toUpperCase() + harness.slice(1);
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath);
}
