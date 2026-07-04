import path from "node:path";
import { writeFile } from "node:fs/promises";
import { ensureDir, writeFileIfMissing } from "./fs.js";
import { getCwPaths } from "./paths.js";
import { AGENT_COMMANDS } from "./templates.js";

export type HarnessName = "generic" | "codex";

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
  "cw-clarify": "Clarify the task contract and update spec.md with user-confirmed goal, scope, constraints, decisions, and acceptance criteria.",
  "cw-plan": "Read the accepted spec and project baseline, then update plan.md and task.md without writing implementation code.",
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
    "If no task exists, create one with `cw internal create-task --id <task-id> --title <title>` after deriving a clear title from the user request.",
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
    "Ask only the questions needed to settle goal, scope, non-goals, constraints, decisions, and acceptance criteria.",
    "Edit spec.md with the accepted task contract.",
    "Run `cw internal set-state --task <task-id> --phase plan --next-action <text>` when the spec is accepted.",
    "If required information is missing, run `cw internal set-state --task <task-id> --lifecycle blocked --phase clarify --blocked-reason <reason> --next-action <text>`."
  ],
  "cw-plan": [
    "Run `cw preflight --action plan --task <task-id>`.",
    "Read spec.md and relevant project baseline files.",
    "If the spec is unclear, return to cw-clarify behavior.",
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
    "If baseline-delta.md exists, preview it and ask whether to accept, edit, or skip it.",
    "After confirmation, run `cw internal sync-baseline-delta --task <task-id> --decision accepted|edited|skipped` when applicable.",
    "Run `cw internal finish-task --task <task-id> --summary <summary> --dirty-worktree <covered|acknowledged|clean> --baseline <accepted|edited|skipped|none>`.",
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

export async function generateAdapter(
  root: string,
  harness: HarnessName = "generic",
  options: AdapterOptions = {}
): Promise<AdapterResult> {
  if (harness === "codex") {
    return generateCodexAdapter(root, options);
  }
  return generateGenericAdapter(root, harness, options);
}

async function generateGenericAdapter(
  root: string,
  harness: HarnessName,
  options: AdapterOptions
): Promise<AdapterResult> {
  const paths = getCwPaths(root);
  const created: string[] = [];
  const existing: string[] = [];
  await ensureDir(paths.agentCommands);

  for (const command of AGENT_COMMANDS) {
    const filePath = path.join(paths.agentCommands, `${command}.md`);
    if (options.overwrite === true) {
      await writeFile(filePath, renderGenericCommand(command), "utf8");
      created.push(relative(root, filePath));
    } else if (await writeFileIfMissing(filePath, renderGenericCommand(command))) {
      created.push(relative(root, filePath));
    } else {
      existing.push(relative(root, filePath));
    }
  }

  return { harness, created, existing };
}

async function generateCodexAdapter(root: string, options: AdapterOptions): Promise<AdapterResult> {
  const generic = await generateGenericAdapter(root, "codex", options);
  const promptDir = path.join(root, ".codex", "prompts");
  await ensureDir(promptDir);

  for (const command of AGENT_COMMANDS) {
    const filePath = path.join(promptDir, `${command}.md`);
    const content = renderCodexPrompt(command);
    if (options.overwrite === true) {
      await writeFile(filePath, content, "utf8");
      generic.created.push(relative(root, filePath));
    } else if (await writeFileIfMissing(filePath, content)) {
      generic.created.push(relative(root, filePath));
    } else {
      generic.existing.push(relative(root, filePath));
    }
  }

  return generic;
}

function renderGenericCommand(command: (typeof AGENT_COMMANDS)[number]): string {
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
- If a subagent, skill, hook, MCP tool, or code intelligence tool is unavailable, continue inline when responsible.

## Workflow Steps

${commandSteps[command].map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Helper Commands

- cw validate
- cw doctor
- cw tasks
- cw preflight --action <action> [--task <task-id>]
- cw internal create-task --id <task-id> --title <title>
- cw internal select-task [--task <task-id>]
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary>
- cw internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- cw internal finish-task --task <task-id> --summary <summary>
- cw internal discard-task --task <task-id> --confirm --worktree <handling>
- cw internal create-resume --task <task-id> --content <markdown>
- cw internal ensure-baseline-delta --task <task-id>
- cw internal sync-baseline-delta --task <task-id> --decision accepted|edited|skipped
- cw internal consume-resume --task <task-id>
`;
}

function renderCodexPrompt(command: (typeof AGENT_COMMANDS)[number]): string {
  return `---
description: ${commandPurposes[command]}
argument-hint: "[--task <task-id>] [--root <path>] [workflow flags]"
---

Use CW's repository-local workflow state to run ${command}.

${renderGenericCommand(command)}
`;
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath);
}
