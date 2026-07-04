import path from "node:path";
import { exec } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { ensureBaselineDelta, syncBaselineDelta } from "./baseline.js";
import { doctorProject } from "./validate.js";
import { appendTrace, consumeResumeNote, createTask, discardTask, finishTask, readTaskState, updateTaskState } from "./tasks.js";
import { getCwPaths, taskDir } from "./paths.js";
import { preflight, WorkflowAction } from "./preflight.js";
import { selectTask } from "./task-store.js";
import { TaskStateRecord } from "./types.js";

const execAsync = promisify(exec);

export type WorkflowCommandAction = WorkflowAction | "doctor";

export type WorkflowOptions = {
  taskId?: string;
  title?: string;
  goal?: string;
  scope?: string;
  acceptance?: string[];
  summary?: string;
  note?: string;
  writeFile?: string;
  content?: string;
  commands?: string[];
  decision?: "accepted" | "edited" | "skipped" | "none";
  dirtyWorktree?: "covered" | "acknowledged" | "clean";
  worktreeHandling?: "keep" | "stash" | "revert" | "delete-worktree" | "none";
  confirm?: boolean;
  merge?: boolean;
};

export type WorkflowResult = {
  action: WorkflowCommandAction;
  task: TaskStateRecord | null;
  message: string;
  details?: Record<string, unknown>;
};

export async function runWorkflowAction(
  root: string,
  action: WorkflowCommandAction,
  options: WorkflowOptions = {}
): Promise<WorkflowResult> {
  switch (action) {
    case "work":
      return runWork(root, options);
    case "clarify":
      return runClarify(root, options);
    case "plan":
      return runPlan(root, options);
    case "run":
      return runRun(root, options);
    case "check":
      return runCheck(root, options);
    case "finish":
      return runFinish(root, options);
    case "resume":
      return runResume(root, options);
    case "discard":
      return runDiscard(root, options);
    case "understand":
      return runUnderstand(root, options);
    case "doctor":
      return runDoctor(root);
    default:
      throw new Error(`unsupported workflow action: ${action}`);
  }
}

async function runWork(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const report = await preflight(root, { action: "work", taskId: options.taskId });
  if (report.task !== null) {
    return {
      action: "work",
      task: report.task,
      message: `Selected task ${report.task.id}; next action: ${report.task.next_action}`,
      details: { preflight: report }
    };
  }

  const title = required(options.title, "--title is required when cw-work creates a task");
  const id = options.taskId ?? slugify(title);
  const task = await createTask(root, { id, title });
  return {
    action: "work",
    task,
    message: `Created task ${task.id}; next action: ${task.next_action}`,
    details: { preflight: report }
  };
}

async function runClarify(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "clarify", taskId: task.id });
  const goal = required(options.goal, "--goal is required");
  const scope = options.scope ?? "In scope for the current task.";
  const acceptance = options.acceptance?.length ? options.acceptance : ["Task behavior satisfies the goal."];
  await writeFile(path.join(taskDir(root, task.id), task.artifacts.spec), renderSpec(goal, scope, acceptance), "utf8");
  const updated = await updateTaskState(root, task.id, {
    lifecycle: "open",
    phase: "plan",
    nextAction: "Create plan.md and task.md from the accepted spec",
    blockedReason: null
  });
  await appendTrace(root, task.id, {
    ts: updated.updated_at,
    type: "spec.accepted",
    summary: "Task spec accepted."
  });
  return { action: "clarify", task: updated, message: `Accepted spec for ${task.id}.` };
}

async function runPlan(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "plan", taskId: task.id });
  const spec = await readFile(path.join(taskDir(root, task.id), task.artifacts.spec), "utf8");
  const goal = extractSection(spec, "Goal") || task.title;
  await writeFile(path.join(taskDir(root, task.id), task.artifacts.plan), renderPlan(goal), "utf8");
  await writeFile(path.join(taskDir(root, task.id), task.artifacts.task), renderTask(), "utf8");
  const updated = await updateTaskState(root, task.id, {
    phase: "run",
    nextAction: "Execute implementation checklist items"
  });
  await appendTrace(root, task.id, {
    ts: updated.updated_at,
    type: "plan.updated",
    summary: "Plan and executable checklist created."
  });
  return { action: "plan", task: updated, message: `Planned task ${task.id}.` };
}

async function runRun(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "run", taskId: task.id });
  if (options.writeFile !== undefined) {
    const target = path.join(root, options.writeFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, options.content ?? "", "utf8");
  }
  const taskPath = path.join(taskDir(root, task.id), task.artifacts.task);
  const content = await readFile(taskPath, "utf8");
  await writeFile(taskPath, checkSection(content, "Implementation"), "utf8");
  const updated = await updateTaskState(root, task.id, {
    phase: "check",
    nextAction: "Run verification and review against spec.md"
  });
  await appendTrace(root, task.id, {
    ts: updated.updated_at,
    type: "run.updated",
    summary: options.summary ?? "Implementation checklist items marked complete."
  });
  return {
    action: "run",
    task: updated,
    message: `Updated run progress for ${task.id}.`,
    details: options.writeFile !== undefined ? { wrote: options.writeFile } : undefined
  };
}

async function runCheck(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "check", taskId: task.id });
  const commandResults = [];
  for (const command of options.commands ?? []) {
    const { stdout, stderr } = await execAsync(command, { cwd: root });
    commandResults.push({ command, stdout, stderr });
  }
  const taskPath = path.join(taskDir(root, task.id), task.artifacts.task);
  const content = await readFile(taskPath, "utf8");
  await writeFile(taskPath, checkSection(checkSection(content, "Verification"), "Check"), "utf8");
  const updated = await updateTaskState(root, task.id, {
    phase: "finish",
    nextAction: "Run cw-finish after user confirmation"
  });
  await appendTrace(root, task.id, {
    ts: updated.updated_at,
    type: "check.passed",
    summary: options.summary ?? "Verification and review passed.",
    data: commandResults.length > 0 ? { commands: commandResults.map((result) => result.command) } : undefined
  });
  return {
    action: "check",
    task: updated,
    message: `Check passed for ${task.id}.`,
    details: commandResults.length > 0 ? { commands: commandResults } : undefined
  };
}

async function runFinish(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "finish", taskId: task.id });
  if (options.decision === "accepted" || options.decision === "edited" || options.decision === "skipped") {
    await syncBaselineDelta(root, task.id, options.decision);
  }
  const finished = await finishTask(root, task.id, {
    summary: options.summary ?? "Task finished.",
    dirtyWorktreeHandling: options.dirtyWorktree ?? "clean",
    baselineDecision: options.decision ?? "none"
  });
  return { action: "finish", task: finished, message: `Closed task ${task.id}.` };
}

async function runResume(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "resume", taskId: task.id });
  const updated = await consumeResumeNote(root, task.id);
  return { action: "resume", task: updated, message: `Consumed resume note for ${task.id}.` };
}

async function runDiscard(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "discard", taskId: task.id });
  await discardTask(root, task.id, {
    confirmed: options.confirm === true,
    worktreeHandling: options.worktreeHandling ?? "none"
  });
  return { action: "discard", task: null, message: `Discarded task ${task.id}.` };
}

async function runDoctor(root: string): Promise<WorkflowResult> {
  const report = await doctorProject(root);
  return { action: "doctor", task: null, message: report.ok ? "Workflow health is ok." : "Workflow health has issues.", details: { report } };
}

async function runUnderstand(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const paths = getCwPaths(root);
  await preflight(root, { action: "understand" });
  const draftDir = path.join(paths.cw, "understand-draft");
  await mkdir(draftDir, { recursive: true });
  const draft = await draftBaseline(root);
  for (const [fileName, content] of Object.entries(draft)) {
    await writeFile(path.join(draftDir, fileName), content, "utf8");
  }
  if (options.merge === true) {
    for (const [fileName, content] of Object.entries(draft)) {
      await writeFile(path.join(paths.project, fileName), content, "utf8");
    }
  }
  return {
    action: "understand",
    task: null,
    message: options.merge === true ? "Project baseline draft merged." : "Project baseline draft written.",
    details: { draft_dir: ".cw/understand-draft", files: Object.keys(draft) }
  };
}

async function selected(root: string, options: WorkflowOptions): Promise<TaskStateRecord> {
  return selectTask(root, { taskId: options.taskId });
}

async function draftBaseline(root: string): Promise<Record<string, string>> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const dirs = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name).sort();
  const packageJson = files.includes("package.json")
    ? JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    : null;
  const scripts = packageJson?.scripts ?? {};

  return {
    "overview.md": `# Project Overview

## Purpose

Drafted from repository files. Review before accepting.

## Current Shape

- Top-level files: ${files.length > 0 ? files.join(", ") : "none detected"}
- Top-level directories: ${dirs.length > 0 ? dirs.join(", ") : "none detected"}

## Major Capabilities

## Non-goals
`,
    "architecture.md": `# Architecture

## Stack

${packageJson ? "- Node.js package detected from package.json" : "- Review required"}

## Modules

${dirs.map((dir) => `- ${dir}`).join("\n") || "- Review required"}

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

${files.includes("package.json") ? "- npm install" : ""}

## Run

${scripts.start ? "- npm start" : ""}

## Test

${scripts.test ? "- npm test" : ""}

## Lint

${scripts.lint ? "- npm run lint" : ""}

## Typecheck

${scripts.typecheck ? "- npm run typecheck" : ""}

## Build

${scripts.build ? "- npm run build" : ""}

## Troubleshooting
`
  };
}

function renderSpec(goal: string, scope: string, acceptance: string[]): string {
  return `# Spec

## Goal

${goal}

## Scope

${scope}

## Non-goals

## Constraints

## Decisions

## Acceptance Criteria
${acceptance.map((item) => `- [x] ${item}`).join("\n")}
`;
}

function renderPlan(goal: string): string {
  return `# Plan

## Approach

Implement the accepted task goal: ${goal}

## Key Decisions

## Risks

## Validation Strategy

Run the relevant commands from .cw/project/commands.md and review changes against spec.md.
`;
}

function renderTask(): string {
  return `# Task

## Implementation
- [ ] Implement the accepted plan.

## Verification
- [ ] Run relevant verification commands.

## Check
- [ ] Acceptance criteria in spec.md are covered.
- [ ] No unresolved drift between implementation and spec.
- [ ] Dirty worktree handling is clear.

## Notes
`;
}

function checkSection(markdown: string, section: string): string {
  const lines = markdown.split(/\r?\n/);
  let inside = false;
  return lines
    .map((line) => {
      if (line.startsWith("## ")) {
        inside = line.trim() === `## ${section}`;
        return line;
      }
      if (inside && line.startsWith("- [ ]")) {
        return line.replace("- [ ]", "- [x]");
      }
      return line;
    })
    .join("\n");
}

function extractSection(markdown: string, section: string): string | null {
  const match = new RegExp(`## ${section}\\n\\n([\\s\\S]*?)(\\n## |$)`).exec(markdown);
  return match?.[1]?.trim() || null;
}

function required(value: string | undefined, message: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(message);
  }
  return value;
}

function slugify(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug.length > 0 ? `task-${slug}` : `task-${Date.now()}`;
}

export async function createBaselineDeltaForTask(root: string, taskId: string): Promise<TaskStateRecord> {
  return ensureBaselineDelta(root, taskId);
}
