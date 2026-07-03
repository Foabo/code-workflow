import path from "node:path";
import { ensureDir, writeFileIfMissing } from "./fs.js";
import { getCwPaths } from "./paths.js";
import { AGENT_COMMANDS } from "./templates.js";

export type HarnessName = "generic";

export type AdapterResult = {
  harness: HarnessName;
  created: string[];
  existing: string[];
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

export async function generateAdapter(root: string, harness: HarnessName = "generic"): Promise<AdapterResult> {
  const paths = getCwPaths(root);
  const created: string[] = [];
  const existing: string[] = [];
  await ensureDir(paths.agentCommands);

  for (const command of AGENT_COMMANDS) {
    const filePath = path.join(paths.agentCommands, `${command}.md`);
    if (await writeFileIfMissing(filePath, renderGenericCommand(command))) {
      created.push(relative(root, filePath));
    } else {
      existing.push(relative(root, filePath));
    }
  }

  return { harness, created, existing };
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

## Helper Commands

- cw validate
- cw doctor
- cw internal create-task --id <task-id> --title <title>
- cw internal append-trace --task <task-id> --type <event-type> --summary <summary>
- cw internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- cw internal create-resume --task <task-id> --content <markdown>
- cw internal consume-resume --task <task-id>
`;
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath);
}
