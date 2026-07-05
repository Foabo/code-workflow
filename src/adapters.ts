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

export const GENERATED_MARKER = "<!-- generated-by-cw:v1 -->";

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
    "If the task needs clarification, follow cw-clarify behavior.",
    "If planning is missing or stale, follow cw-plan behavior.",
    "If executable checklist items exist, follow cw-run behavior.",
    "Run cw-check behavior when implementation appears complete.",
    "When check passes, stop and ask whether to run cw-finish."
  ],
  "cw-clarify": [
    "Run `cw preflight --action clarify --task <task-id>` when a task id is known.",
    "Read the current spec.md and relevant project baseline files.",
    "Choose strict or light clarify behavior using the Phase Guidance below.",
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
    "Run `cw internal set-state --task <task-id> --phase run --next-action <text>`."
  ],
  "cw-run": [
    "Run `cw preflight --action run --task <task-id>`.",
    "Read spec.md, plan.md, task.md, and relevant code.",
    "Implement the next unchecked implementation items in task.md.",
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
    "Review the implementation against spec.md, plan.md, and task.md.",
    "Fix small local defects when the task contract is unchanged.",
    "If spec drift appears, stop for user confirmation and update spec.md only after confirmation.",
    "Update task.md verification and check items.",
    "Append a check trace event with `cw internal append-trace --task <task-id> --type check.passed --summary <summary>` or `check.failed`.",
    "When check passes, run `cw internal set-state --task <task-id> --phase finish --next-action <text>`."
  ],
  "cw-finish": [
    "Run `cw preflight --action finish --task <task-id>`.",
    "Confirm dirty worktree handling when needed.",
    "If baseline-delta.md exists, preview it and ask whether to accept, select, edit, or skip it.",
    "After confirmation, run `cw internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped` when applicable.",
    "Run `cw internal finish-task --task <task-id> --summary <summary> --dirty-worktree <covered|unrelated|clean> --baseline <accepted|selected|edited|skipped|none>`.",
    "Report the closed task id and any project baseline files updated."
  ],
  "cw-resume": [
    "Run `cw preflight --action resume --task <task-id>`.",
    "Read resume.md together with task.json, trace.jsonl, spec.md, plan.md, and task.md.",
    "Continue from the task artifacts, using resume.md only as a pointer.",
    "After recording progress, run `cw internal consume-resume --task <task-id>`."
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
  "cw-clarify": [
    "Default to strict requirements review. Use light mode only when the user explicitly asks for fast handling, or when the task is low risk, goal-complete, reversible, and has obvious verification.",
    "Escalate to strict mode when the request affects product behavior, workflow semantics, CLI/API behavior, task lifecycle, state machines, cross-module behavior, irreversible work, or unclear acceptance criteria.",
    "Expand only when the user gives background or a loose desire instead of a clear target. Expand around user results, offer at most three candidate directions, and recommend one.",
    "Grill after a candidate direction exists. Ask one important question at a time, include your recommended answer, and name the trade-off when it matters.",
    "Clarification is complete only when the goal, boundary, acceptance criteria, and key risks are clear enough to write spec.md without high-risk assumptions.",
    "Before writing spec.md, present a Proposed Spec using the existing sections: Goal, Scope, Non-goals, Constraints, Decisions, and Acceptance Criteria. Continue asking if any high-risk assumption remains.",
    "Clarify terminology lightly. Task-local terms belong in spec.md; stable reusable project concepts may become baseline-delta.md candidates."
  ],
  "cw-plan": [
    "The spec quality gate checks that Goal is concrete, Scope bounds the work, Acceptance Criteria are checkable, and Decisions cover product trade-offs that affect implementation.",
    "Do not modify spec.md during planning. If the gate fails, block the task in clarify phase and provide one concrete next question in the blocked reason or next action.",
    "Plan from the accepted contract. Implementation choices may be recorded in plan.md only when they stay inside the confirmed spec.",
    "Break task.md implementation items into small, verifiable vertical slices. Keep file-level edits as implementation details, not primary checklist items."
  ]
};

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
  return `${GENERATED_MARKER}

# ${command}

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
- If a subagent, skill, hook, MCP tool, or code intelligence tool is unavailable, continue inline when responsible.

## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Hybrid execution is recommended when the harness supports delegation: keep coordination in the main session while delegating implementation or checking.
- Subagents receive task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Implementer subagents may write code and update checklist progress, but must not close tasks.
- Checker subagents must return spec drift or product behavior changes to the main session for user confirmation.

## Workflow Steps

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
