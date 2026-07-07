import path from "node:path";
import { exec } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { BaselineFile, ensureBaselineDelta, previewBaselineMerge, syncBaselineDelta } from "./baseline.js";
import {
  proposalHash,
  proposalIdFromHash,
  readTraceEvents,
  validateClarifyGate
} from "./clarify-gate.js";
import { doctorProject } from "./validate.js";
import {
  appendTrace,
  checkClosureGate,
  consumeResumeNote,
  createTask,
  discardTask,
  finishTask,
  readTaskState,
  updateTaskState
} from "./tasks.js";
import { getFlowflowPaths, taskDir } from "./paths.js";
import { preflight, WorkflowAction } from "./preflight.js";
import { selectTask } from "./task-store.js";
import { BaselineDecision, DirtyWorktreeDecision, TaskStateRecord, ValidationIssue } from "./types.js";

const execAsync = promisify(exec);

export type WorkflowCommandAction = WorkflowAction | "doctor";

export type WorkflowOptions = {
  taskId?: string;
  title?: string;
  goal?: string;
  scope?: string;
  nonGoals?: string;
  constraints?: string;
  decisions?: string;
  acceptance?: string[];
  summary?: string;
  note?: string;
  writeFile?: string;
  content?: string;
  commands?: string[];
  manualVerification?: string;
  baselineOutcome?: string;
  drift?: boolean;
  decision?: BaselineDecision | "none";
  selectedBaselineFiles?: BaselineFile[];
  editedBaselineDelta?: string;
  confirmBaselineImpact?: boolean;
  dirtyWorktree?: DirtyWorktreeDecision;
  worktreeHandling?: "keep" | "stash" | "revert" | "delete-worktree" | "none";
  confirm?: boolean;
  merge?: boolean;
  attemptId?: string;
  proposalId?: string;
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
    const status = workStatus(report.task);
    return {
      action: "work",
      task: report.task,
      message: `Selected task ${report.task.id}; phase ${report.task.phase}; ${status.recommendedAction}`,
      details: { preflight: report, ...status }
    };
  }

  const title = required(options.title, "--title is required when ff-work creates a task");
  const task = await createTask(root, { id: options.taskId, title });
  const status = workStatus(task);
  return {
    action: "work",
    task,
    message: `Created task ${task.id}; phase ${task.phase}; ${status.recommendedAction}`,
    details: { preflight: report, ...status }
  };
}

function workStatus(task: TaskStateRecord): { phase: string; nextAction: string; recommendedAction: string } {
  return {
    phase: task.phase,
    nextAction: task.next_action,
    recommendedAction: recommendedWorkAction(task)
  };
}

function recommendedWorkAction(task: TaskStateRecord): string {
  if (task.phase === "clarify") {
    return `apply ff-clarify behavior next: ${task.next_action}`;
  }
  if (task.phase === "plan") {
    return `apply ff-plan behavior next: ${task.next_action}`;
  }
  if (task.phase === "run") {
    return `apply ff-run behavior next: ${task.next_action}`;
  }
  if (task.phase === "check") {
    return `apply ff-check behavior next: ${task.next_action}`;
  }
  if (task.phase === "finish") {
    return `task is ready for ff-finish after explicit user confirmation: ${task.next_action}`;
  }
  return `inspect task artifacts before continuing: ${task.next_action}`;
}

async function runClarify(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "clarify", taskId: task.id });
  if (options.goal === undefined || options.goal.trim().length === 0) {
    const blocked = await updateTaskState(root, task.id, {
      lifecycle: "blocked",
      phase: "clarify",
      blockedReason: options.note ?? "Clarification requires a task goal.",
      nextAction: "Ask the user for the task goal, scope, constraints, and acceptance criteria"
    });
    return {
      action: "clarify",
      task: blocked,
      message: `Blocked ${task.id}; clarification needs user input.`
    };
  }
  const goal = options.goal;
  const scope = options.scope ?? "In scope for the current task.";
  const acceptance = options.acceptance?.length ? options.acceptance : ["Task behavior satisfies the goal."];
  const proposedSpec = renderSpec(goal, scope, acceptance, {
    nonGoals: options.nonGoals,
    constraints: options.constraints,
    decisions: options.decisions
  });
  const identity = clarifyProposalIdentity(proposedSpec, options);

  if (options.confirm !== true) {
    const now = new Date().toISOString();
    const data = {
      attempt_id: identity.attemptId,
      proposal_id: identity.proposalId,
      proposal_hash: identity.proposalHash
    };
    await appendTrace(root, task.id, {
      ts: now,
      type: "brainstorm.done",
      summary: "Clarify proposal prepared; Brainstorm Pass evidence is required before acceptance.",
      data
    });
    await appendTrace(root, task.id, {
      ts: now,
      type: "spec.proposed",
      summary: "Proposed Spec prepared; advisor review and explicit accept are required before spec.md is written.",
      data
    });
    const blocked = await updateTaskState(root, task.id, {
      lifecycle: "blocked",
      phase: "clarify",
      blockedReason: "Proposed Spec requires advisor review and explicit accept before spec.md is written.",
      nextAction: "Run advisor review for the current proposal, resolve concerns or blockers, then rerun ff-clarify with explicit accept."
    });
    return {
      action: "clarify",
      task: blocked,
      message: `Proposed spec for ${task.id}; advisor review and explicit accept are required before writing spec.md.`,
      details: { proposal: proposedSpec, identity }
    };
  }

  const acceptGate = validateClarifyGate({
    task,
    events: await readTraceEvents(root, task.id),
    stage: "accept",
    attemptId: options.attemptId,
    proposalId: options.proposalId,
    proposalHash: identity.proposalHash
  });
  if (!acceptGate.ok || acceptGate.identity === null) {
    const blocked = await blockClarifyGateFailure(root, task.id, acceptGate.issues);
    return {
      action: "clarify",
      task: blocked,
      message: `Clarify accept gate blocked ${task.id}.`,
      details: { gate: acceptGate }
    };
  }
  await appendTrace(root, task.id, {
    ts: new Date().toISOString(),
    type: "spec.accepted",
    summary: "Task spec explicitly accepted.",
    data: {
      attempt_id: acceptGate.identity.attemptId,
      proposal_id: acceptGate.identity.proposalId,
      proposal_hash: acceptGate.identity.proposalHash,
      explicit: true
    }
  });
  const advanceGate = validateClarifyGate({
    task,
    events: await readTraceEvents(root, task.id),
    stage: "advance",
    attemptId: acceptGate.identity.attemptId,
    proposalId: acceptGate.identity.proposalId,
    proposalHash: acceptGate.identity.proposalHash
  });
  if (!advanceGate.ok) {
    const blocked = await blockClarifyGateFailure(root, task.id, advanceGate.issues);
    return {
      action: "clarify",
      task: blocked,
      message: `Clarify phase gate blocked ${task.id}.`,
      details: { gate: advanceGate }
    };
  }
  await writeFile(path.join(taskDir(root, task.id), task.artifacts.spec), proposedSpec, "utf8");
  const updated = await updateTaskState(root, task.id, {
    lifecycle: "open",
    phase: "plan",
    nextAction: "Create plan.md and task.md from the accepted spec",
    blockedReason: null
  });
  const resumed = await consumeResumeAfterProgress(root, updated);
  return { action: "clarify", task: resumed, message: `Accepted spec for ${task.id}.` };
}

function clarifyProposalIdentity(
  proposedSpec: string,
  options: Pick<WorkflowOptions, "attemptId" | "proposalId">
): { attemptId: string; proposalId: string; proposalHash: string } {
  const hash = proposalHash(proposedSpec);
  return {
    attemptId: options.attemptId ?? `a-${Date.now().toString(36)}-${hash.slice(0, 8)}`,
    proposalId: options.proposalId ?? proposalIdFromHash(hash),
    proposalHash: hash
  };
}

async function blockClarifyGateFailure(
  root: string,
  taskId: string,
  issues: ValidationIssue[]
): Promise<TaskStateRecord> {
  const reason = issues.length > 0
    ? `Clarify gate failed: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`
    : "Clarify gate failed.";
  const blocked = await updateTaskState(root, taskId, {
    lifecycle: "blocked",
    phase: "clarify",
    blockedReason: reason,
    nextAction: "Repair the current Proposed Spec gate evidence, advisor review, or explicit accept before writing spec.md."
  });
  await appendTrace(root, taskId, {
    ts: blocked.updated_at,
    type: "clarify.gate.failed",
    summary: reason,
    data: { issues }
  });
  return blocked;
}

async function runPlan(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "plan", taskId: task.id });
  const spec = await readFile(path.join(taskDir(root, task.id), task.artifacts.spec), "utf8");
  const specIssue = specQualityIssue(spec);
  if (specIssue !== null) {
    const blocked = await updateTaskState(root, task.id, {
      lifecycle: "blocked",
      phase: "clarify",
      blockedReason: `Task spec quality gate failed: ${specIssue.reason}`,
      nextAction: specIssue.question
    });
    await appendTrace(root, task.id, {
      ts: blocked.updated_at,
      type: "plan.blocked",
      summary: `Planning blocked because spec.md is insufficient: ${specIssue.reason}`
    });
    return { action: "plan", task: blocked, message: `Planning blocked for ${task.id}.` };
  }
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
  const resumed = await consumeResumeAfterProgress(root, updated);
  return { action: "plan", task: resumed, message: `Planned task ${task.id}.` };
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
  const resumed = await consumeResumeAfterProgress(root, updated);
  return {
    action: "run",
    task: resumed,
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
  if (options.drift === true) {
    const updated = await updateTaskState(root, task.id, {
      phase: "check",
      nextAction: "Resolve drift by updating spec.md, plan.md, or task.md before finish",
      healthFlags: Array.from(new Set([...task.health_flags, "drift_suspected"])),
      invalidatedArtifacts: Array.from(new Set([...task.invalidated_artifacts, "spec.md"]))
    });
    await appendTrace(root, task.id, {
      ts: updated.updated_at,
      type: "check.failed",
      summary: options.summary ?? "Check found unresolved drift.",
      data: { drift: true }
    });
    const resumed = await consumeResumeAfterProgress(root, updated);
    return {
      action: "check",
      task: resumed,
      message: `Check blocked finish for ${task.id}; drift needs resolution.`,
      details: commandResults.length > 0 ? { commands: commandResults, drift: true } : { drift: true }
    };
  }
  let checkedContent = checkSection(content, "Verification");
  checkedContent = checkSection(checkedContent, "Check", { skipBaselineOutcome: true });
  const baselineOutcome = options.baselineOutcome ??
    (task.artifacts.baseline_delta !== null ? "baseline-delta.md is recorded for finish decision." : undefined);
  if (baselineOutcome === undefined || baselineOutcome.trim().length === 0) {
    await writeFile(taskPath, checkedContent, "utf8");
    const updated = await updateTaskState(root, task.id, {
      phase: "check",
      nextAction: "Record Baseline Outcome before finish"
    });
    await appendTrace(root, task.id, {
      ts: updated.updated_at,
      type: "check.failed",
      summary: "Check needs a recorded Baseline Outcome before finish.",
      data: { baseline_outcome: "missing" }
    });
    const resumed = await consumeResumeAfterProgress(root, updated);
    return {
      action: "check",
      task: resumed,
      message: `Check blocked finish for ${task.id}; Baseline Outcome needs recording.`,
      details: { baseline_outcome: "missing" }
    };
  }
  checkedContent = recordBaselineOutcome(checkedContent, baselineOutcome);
  await writeFile(taskPath, checkedContent, "utf8");
  const finishNextAction = task.artifacts.baseline_delta !== null
    ? "Run ff-finish to merge baseline-delta.md by default; use selected, edited, or skipped only when needed"
    : "Run ff-finish after user confirmation";
  const updated = await updateTaskState(root, task.id, {
    healthFlags: task.health_flags.filter((flag) => flag !== "drift_suspected"),
    invalidatedArtifacts: [],
    phase: "finish",
    nextAction: finishNextAction
  });
  await appendTrace(root, task.id, {
    ts: updated.updated_at,
    type: "check.passed",
    summary: options.summary ?? "Verification and review passed.",
    data: {
        commands: commandResults.map((result) => result.command),
        manual_verification: options.manualVerification,
        baseline_outcome: baselineOutcome
      }
  });
  const resumed = await consumeResumeAfterProgress(root, updated);
  return {
    action: "check",
    task: resumed,
    message: `Check passed for ${task.id}.`,
    details: commandResults.length > 0 ? { commands: commandResults } : undefined
  };
}

async function runFinish(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "finish", taskId: task.id });
  const baselinePreview = task.artifacts.baseline_delta !== null
    ? await previewBaselineMerge(root, task.id, {
      selectedFiles: options.selectedBaselineFiles,
      editedMarkdown: options.editedBaselineDelta
    })
    : { sections: {}, highImpact: false };
  const baselineDecision = options.decision ?? (task.artifacts.baseline_delta === null ? "none" : "accepted");
  if (
    baselinePreview.highImpact &&
    baselineDecision !== undefined &&
    baselineDecision !== "none" &&
    baselineDecision !== "skipped" &&
    options.confirmBaselineImpact !== true
  ) {
    throw new Error("high-impact baseline delta requires explicit confirmation");
  }
  if (baselineDecision === "selected" && (options.selectedBaselineFiles === undefined || options.selectedBaselineFiles.length === 0)) {
    throw new Error("selected baseline sync requires at least one selected baseline file");
  }

  const gateIssues = await checkClosureGate(root, task.id, {
    summary: options.summary ?? "Task finished.",
    dirtyWorktreeHandling: options.dirtyWorktree ?? "clean",
    baselineDecision
  });
  if (gateIssues.length > 0) {
    throw new Error(`closure gate failed:\n${gateIssues.map((issue) => `- ${issue}`).join("\n")}`);
  }

  let baselineSync = null;
  if (
    baselineDecision === "accepted" ||
    baselineDecision === "selected" ||
    baselineDecision === "edited" ||
    baselineDecision === "skipped"
  ) {
    baselineSync = await syncBaselineDelta(root, task.id, baselineDecision, {
      selectedFiles: options.selectedBaselineFiles,
      editedMarkdown: options.editedBaselineDelta
    });
  }
  const finished = await finishTask(root, task.id, {
    summary: options.summary ?? "Task finished.",
    dirtyWorktreeHandling: options.dirtyWorktree ?? "clean",
    baselineDecision,
    baselineImpactConfirmed: options.confirmBaselineImpact
  });
  return {
    action: "finish",
    task: finished,
    message: `Closed task ${task.id}.`,
    details: { baseline_preview: baselinePreview.sections, baseline_sync: baselineSync }
  };
}

async function runResume(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const task = await selected(root, options);
  await preflight(root, { action: "resume", taskId: task.id });
  const resumePath = task.artifacts.resume;
  const resumeContent = resumePath === null ? null : await readFile(path.join(taskDir(root, task.id), resumePath), "utf8");
  const updated = task.lifecycle === "parked" && resumePath !== null
    ? await updateTaskState(root, task.id, {
        lifecycle: "open",
        parkedReason: null,
        nextAction: task.next_action.trim().length > 0
          ? task.next_action
          : `Continue ${task.phase} phase from task artifacts and resume note`
      })
    : task;

  return {
    action: "resume",
    task: updated,
    message: resumePath === null
      ? `No resume note found for ${task.id}; continue from task artifacts.`
      : `Loaded resume note for ${task.id}; consume it after progress is recorded.`,
    details: {
      resume_path: resumePath,
      resume_content: resumeContent,
      consumed: false
    }
  };
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

async function consumeResumeAfterProgress(root: string, task: TaskStateRecord): Promise<TaskStateRecord> {
  if (task.artifacts.resume === null) {
    return task;
  }
  return consumeResumeNote(root, task.id);
}

async function runUnderstand(root: string, options: WorkflowOptions): Promise<WorkflowResult> {
  const paths = getFlowflowPaths(root);
  await preflight(root, { action: "understand" });
  const draftDir = paths.understandDraft;
  await mkdir(draftDir, { recursive: true });
  const draft = await draftBaseline(root);
  for (const [fileName, content] of Object.entries(draft)) {
    await writeFile(path.join(draftDir, fileName), content, "utf8");
  }
  return {
    action: "understand",
    task: null,
    message: options.merge === true
      ? "Project baseline draft written; review and merge accepted content separately."
      : "Project baseline draft written.",
    details: { draft_dir: ".ff/understand-draft", files: Object.keys(draft), merged: false }
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

function renderSpec(
  goal: string,
  scope: string,
  acceptance: string[],
  details: { nonGoals?: string; constraints?: string; decisions?: string } = {}
): string {
  return `# Spec

## Goal

${goal}

## Scope

${scope}

## Non-goals

${details.nonGoals ?? ""}

## Constraints

${details.constraints ?? ""}

## Decisions

${details.decisions ?? ""}

## Acceptance Criteria
${acceptance.map((item) => `- [x] ${item}`).join("\n")}
`;
}

function renderPlan(goal: string): string {
  return `# Plan

## Approach

Plan from the accepted task goal: ${goal}

Break implementation into small, verifiable vertical slices that stay within spec.md.

## Key Decisions

## Risks

## Validation Strategy

Run the relevant commands from .ff/project/commands.md and review changes against spec.md.
`;
}

function renderTask(): string {
  return `# Task

## Implementation
- [ ] Implement the accepted plan as small, verifiable vertical slices.

## Verification
- [ ] Run relevant verification commands.

## Check
- [ ] Acceptance criteria in spec.md are covered.
- [ ] No unresolved drift between implementation and spec.
- [ ] Dirty worktree handling is clear.
- [ ] Baseline Outcome is recorded.

## Notes
`;
}

function checkSection(markdown: string, section: string, options: { skipBaselineOutcome?: boolean } = {}): string {
  const lines = markdown.split(/\r?\n/);
  let inside = false;
  return lines
    .map((line) => {
      if (line.startsWith("## ")) {
        inside = line.trim() === `## ${section}`;
        return line;
      }
      if (inside && options.skipBaselineOutcome === true && /Baseline Outcome is recorded/.test(line)) {
        return line;
      }
      if (inside && line.startsWith("- [ ]")) {
        return line.replace("- [ ]", "- [x]");
      }
      return line;
    })
    .join("\n");
}

function recordBaselineOutcome(markdown: string, outcome: string): string {
  const checked = markdown.replace(
    /^- \[ \] Baseline Outcome is recorded\.?$/m,
    "- [x] Baseline Outcome is recorded."
  );
  const note = `Baseline Outcome: ${outcome.trim()}`;
  if (/^## Notes\s*$/m.test(checked)) {
    return checked.replace(/^## Notes\s*$/m, `## Notes\n${note}`);
  }
  return `${checked.trimEnd()}\n\n## Notes\n${note}\n`;
}

function extractSection(markdown: string, section: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const collected: string[] = [];
  let inside = false;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inside) {
        break;
      }
      inside = line.trim() === `## ${section}`;
      continue;
    }
    if (inside) {
      collected.push(line);
    }
  }
  return collected.join("\n").trim() || null;
}

function hasSectionContent(markdown: string, section: string): boolean {
  return (extractSection(markdown, section) ?? "").trim().length > 0;
}

function specQualityIssue(markdown: string): { reason: string; question: string } | null {
  if (!hasSectionContent(markdown, "Goal")) {
    return {
      reason: "spec.md is missing a concrete Goal.",
      question: "What concrete outcome should this task achieve?"
    };
  }
  if (!hasSectionContent(markdown, "Scope")) {
    return {
      reason: "spec.md is missing Scope that bounds the work.",
      question: "What is included in this task, and what should stay out of scope?"
    };
  }
  if (hasUncheckedCheckbox(markdown)) {
    return {
      reason: "spec.md still has unchecked placeholder checklist items.",
      question: "Which acceptance criteria are confirmed and checkable?"
    };
  }
  if (!hasCheckedAcceptanceCriterion(markdown)) {
    return {
      reason: "spec.md is missing confirmed Acceptance Criteria.",
      question: "What observable result, command, file change, or behavior proves this task is complete?"
    };
  }
  return null;
}

function hasCheckedAcceptanceCriterion(markdown: string): boolean {
  const section = extractSection(markdown, "Acceptance Criteria");
  if (section === null) {
    return false;
  }
  return section.split(/\r?\n/).some((line) => /^- \[x\] \S/.test(line.trim()));
}

function hasUncheckedCheckbox(markdown: string): boolean {
  return /^- \[ \]/m.test(markdown);
}

function required(value: string | undefined, message: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(message);
  }
  return value;
}

export async function createBaselineDeltaForTask(root: string, taskId: string): Promise<TaskStateRecord> {
  return ensureBaselineDelta(root, taskId);
}
