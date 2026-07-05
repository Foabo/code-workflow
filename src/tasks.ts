import path from "node:path";
import { appendFile, readFile, rename, rm, writeFile } from "node:fs/promises";
import { ensureDir, writeFileIfMissing } from "./fs.js";
import { getGitStatus } from "./git.js";
import { readJsonFile, writeJsonFile } from "./json.js";
import { getCwPaths, TaskLocation, taskDir, taskJsonPath, tracePath } from "./paths.js";
import { assertTaskStateRecord } from "./schema.js";
import { allocateTaskId, isFullNumericTaskId, listTaskIds, migrateLegacyTaskIds, LegacyTaskMigrationResult } from "./task-storage.js";
import { TASK_ARTIFACT_TEMPLATES } from "./templates.js";
import {
  BaselineDecision,
  CW_SCHEMA_VERSION,
  DirtyWorktreeDecision,
  TaskLifecycle,
  TaskStateRecord,
  TraceEvent
} from "./types.js";

export type CreateTaskInput = {
  id?: string;
  title: string;
  phase?: string;
  nextAction?: string;
  now?: Date;
};

export type UpdateTaskStateInput = {
  lifecycle?: TaskLifecycle;
  phase?: string;
  nextAction?: string;
  blockedReason?: string | null;
  parkedReason?: string | null;
  resumeCondition?: string | null;
  healthFlags?: string[];
  invalidatedArtifacts?: string[];
  now?: Date;
};

export type FinishTaskInput = {
  summary: string;
  dirtyWorktreeHandling?: DirtyWorktreeDecision;
  baselineDecision?: BaselineDecision | "none";
  baselineImpactConfirmed?: boolean;
  now?: Date;
};

export type DiscardTaskInput = {
  worktreeHandling: "keep" | "stash" | "revert" | "delete-worktree" | "none";
  confirmed: boolean;
  now?: Date;
};

export type TaskFileInput = {
  location?: TaskLocation;
};

export async function createTask(root: string, input: CreateTaskInput): Promise<TaskStateRecord> {
  const id = input.id ?? (await allocateTaskId(root, input.title));
  validateTaskId(id);
  await ensureTaskIdAvailable(root, id);
  const paths = getCwPaths(root);
  const dir = taskDir(root, id);
  await ensureDir(paths.tasks);
  await ensureDir(dir);

  const now = (input.now ?? new Date()).toISOString();
  const state: TaskStateRecord = {
    id,
    title: input.title,
    lifecycle: "open",
    phase: input.phase ?? "clarify",
    next_action: input.nextAction ?? "Clarify task goal, scope, constraints, and acceptance criteria",
    health_flags: [],
    artifacts: {
      spec: "spec.md",
      plan: "plan.md",
      task: "task.md",
      baseline_delta: null,
      resume: null
    },
    invalidated_artifacts: [],
    blocked_reason: null,
    parked_reason: null,
    resume_condition: null,
    created_at: now,
    updated_at: now,
    schema_version: CW_SCHEMA_VERSION
  };

  for (const fileName of ["spec.md", "plan.md", "task.md"]) {
    await writeFileIfMissing(path.join(dir, fileName), TASK_ARTIFACT_TEMPLATES[fileName]);
  }

  await writeFile(taskJsonPath(root, id), `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await writeFile(tracePath(root, id), "", { encoding: "utf8", flag: "wx" }).catch((error: unknown) => {
    if (isAlreadyExists(error)) {
      return;
    }
    throw error;
  });
  await appendTrace(root, id, {
    ts: now,
    type: "task.created",
    summary: `Task created: ${input.title}`
  });

  return state;
}

export async function readTaskState(root: string, taskId: string): Promise<TaskStateRecord> {
  const state = await readJsonFile<unknown>(taskJsonPath(root, taskId));
  assertTaskStateRecord(state, `.cw/tasks/${taskId}/task.json`);
  return state;
}

export async function readTaskStateAt(root: string, taskId: string, input: TaskFileInput = {}): Promise<TaskStateRecord> {
  const location = input.location ?? "active";
  const state = await readJsonFile<unknown>(taskJsonPath(root, taskId, location));
  const display = location === "archived" ? `.cw/tasks/archived/${taskId}/task.json` : `.cw/tasks/${taskId}/task.json`;
  assertTaskStateRecord(state, display);
  return state;
}

export async function updateTaskState(
  root: string,
  taskId: string,
  input: UpdateTaskStateInput
): Promise<TaskStateRecord> {
  const state = await readTaskState(root, taskId);
  if (input.lifecycle === "closed") {
    throw new Error("use finishTask to close a task");
  }
  const next: TaskStateRecord = {
    ...state,
    lifecycle: input.lifecycle ?? state.lifecycle,
    phase: input.phase ?? state.phase,
    next_action: input.nextAction ?? state.next_action,
    health_flags: input.healthFlags ?? state.health_flags,
    invalidated_artifacts: input.invalidatedArtifacts ?? state.invalidated_artifacts,
    blocked_reason: input.blockedReason === undefined ? state.blocked_reason : input.blockedReason,
    parked_reason: input.parkedReason === undefined ? state.parked_reason : input.parkedReason,
    resume_condition: input.resumeCondition === undefined ? state.resume_condition : input.resumeCondition,
    updated_at: (input.now ?? new Date()).toISOString()
  };

  validateTaskLifecycleHygiene(next);
  await writeJsonFile(taskJsonPath(root, taskId), next);
  await appendTrace(root, taskId, {
    ts: next.updated_at,
    type: "task.state.updated",
    summary: stateUpdateSummary(state, next)
  });
  return next;
}

export async function finishTask(root: string, taskId: string, input: FinishTaskInput): Promise<TaskStateRecord> {
  const state = await readTaskState(root, taskId);
  if (state.lifecycle !== "open") {
    throw new Error("only open tasks can finish");
  }

  const gateIssues = await checkClosureGate(root, taskId, input);
  if (gateIssues.length > 0) {
    throw new Error(`closure gate failed:\n${gateIssues.map((issue) => `- ${issue}`).join("\n")}`);
  }

  if (state.artifacts.resume !== null) {
    await rm(path.join(taskDir(root, taskId), state.artifacts.resume), { force: true });
  }

  const now = (input.now ?? new Date()).toISOString();
  const next: TaskStateRecord = {
    ...state,
    lifecycle: "closed",
    phase: "finish",
    next_action: "Task is closed",
    artifacts: { ...state.artifacts, resume: null },
    resume_condition: null,
    updated_at: now
  };

  await writeJsonFile(taskJsonPath(root, taskId), next);
  if (state.artifacts.resume !== null) {
    await appendTrace(root, taskId, {
      ts: now,
      type: "resume.consumed",
      summary: "Resume note consumed and removed."
    });
  }
  await appendTrace(root, taskId, {
    ts: now,
    type: "task.finished",
    summary: input.summary,
    data: {
      baseline_decision: input.baselineDecision ?? "none",
      dirty_worktree_handling: input.dirtyWorktreeHandling ?? "clean"
    }
  });
  await ensureDir(getCwPaths(root).tasksArchive);
  await rename(taskDir(root, taskId), taskDir(root, taskId, "archived"));
  return next;
}

export async function checkClosureGate(root: string, taskId: string, input: FinishTaskInput): Promise<string[]> {
  const state = await readTaskState(root, taskId);
  if (state.lifecycle !== "open") {
    return ["only open tasks can finish"];
  }
  return closureGateIssues(root, taskId, state, input);
}

export async function discardTask(root: string, taskId: string, input: DiscardTaskInput): Promise<void> {
  if (!input.confirmed) {
    throw new Error("discard requires explicit confirmation");
  }
  const gitStatus = await getGitStatus(root);
  if (gitStatus.kind === "dirty" && input.worktreeHandling === "none") {
    throw new Error("shared-worktree discard requires selected worktree handling");
  }
  const now = (input.now ?? new Date()).toISOString();
  await readTaskState(root, taskId);
  await appendTrace(root, taskId, {
    ts: now,
    type: "task.discarded",
    summary: `Task discarded with worktree handling: ${input.worktreeHandling}`
  });
  await rm(taskDir(root, taskId), { recursive: true, force: true });
}

export async function appendTrace(root: string, taskId: string, event: TraceEvent, input: TaskFileInput = {}): Promise<void> {
  if (!event.ts || !event.type || !event.summary) {
    throw new Error("trace event requires ts, type, and summary");
  }
  await appendFile(tracePath(root, taskId, input.location ?? "active"), `${JSON.stringify(event)}\n`, "utf8");
}

export async function migrateTasks(root: string, now = new Date()): Promise<LegacyTaskMigrationResult> {
  return migrateLegacyTaskIds(root, now);
}

export async function createResumeNote(
  root: string,
  taskId: string,
  content: string,
  resumeCondition: string | null = null,
  now = new Date()
): Promise<TaskStateRecord> {
  const state = await readTaskState(root, taskId);
  if (state.artifacts.resume !== null) {
    throw new Error("task already has a resume note");
  }
  const filePath = path.join(taskDir(root, taskId), "resume.md");
  await writeFile(filePath, content, "utf8");
  const next: TaskStateRecord = {
    ...state,
    artifacts: { ...state.artifacts, resume: "resume.md" },
    resume_condition: resumeCondition,
    updated_at: now.toISOString()
  };
  await writeJsonFile(taskJsonPath(root, taskId), next);
  await appendTrace(root, taskId, {
    ts: next.updated_at,
    type: "resume.created",
    summary: "Resume note created."
  });
  return next;
}

export async function consumeResumeNote(root: string, taskId: string, now = new Date()): Promise<TaskStateRecord> {
  const state = await readTaskState(root, taskId);
  if (state.artifacts.resume === null) {
    return state;
  }

  await rm(path.join(taskDir(root, taskId), state.artifacts.resume), { force: true });
  const next: TaskStateRecord = {
    ...state,
    artifacts: { ...state.artifacts, resume: null },
    resume_condition: null,
    updated_at: now.toISOString()
  };
  await writeJsonFile(taskJsonPath(root, taskId), next);
  await appendTrace(root, taskId, {
    ts: next.updated_at,
    type: "resume.consumed",
    summary: "Resume note consumed and removed."
  });
  return next;
}

async function closureGateIssues(
  root: string,
  taskId: string,
  state: TaskStateRecord,
  input: FinishTaskInput
): Promise<string[]> {
  const issues: string[] = [];
  const dir = taskDir(root, taskId);
  const spec = await readFile(path.join(dir, state.artifacts.spec), "utf8");
  const task = await readFile(path.join(dir, state.artifacts.task), "utf8");

  if (state.phase !== "finish") {
    issues.push("task phase must be finish before closure");
  }
  if (hasUncheckedCheckbox(spec)) {
    issues.push("spec.md has unchecked acceptance criteria or checklist items");
  }
  if (hasUncheckedCheckbox(task)) {
    issues.push("task.md has unchecked implementation, verification, or check items");
  }
  if (state.artifacts.baseline_delta === null && !hasRecordedBaselineOutcome(task)) {
    issues.push("task.md must record Baseline Outcome or provide baseline-delta.md");
  }

  if (state.artifacts.baseline_delta !== null && input.baselineDecision === undefined) {
    issues.push("baseline delta requires an accepted, selected, edited, or skipped decision");
  }
  if (state.invalidated_artifacts.length > 0 || state.health_flags.includes("drift_suspected")) {
    issues.push("unresolved drift prevents finish");
  }

  const gitStatus = await getGitStatus(root);
  if (gitStatus.kind === "dirty" && (input.dirtyWorktreeHandling === undefined || input.dirtyWorktreeHandling === "clean")) {
    issues.push("dirty worktree requires covered or unrelated handling");
  }

  return issues;
}

function validateTaskLifecycleHygiene(state: TaskStateRecord): void {
  if (state.lifecycle !== "closed" && state.next_action.trim().length === 0) {
    throw new Error("unfinished task requires next action");
  }
  if (state.lifecycle === "blocked" && state.blocked_reason === null) {
    throw new Error("blocked task requires blocked reason");
  }
  if (state.lifecycle === "parked") {
    if (state.parked_reason === null) {
      throw new Error("parked task requires parked reason");
    }
    if (state.resume_condition === null) {
      throw new Error("parked task requires resume condition");
    }
  }
}

function hasRecordedBaselineOutcome(markdown: string): boolean {
  return /^-\s+\[[xX]\]\s+Baseline Outcome is recorded\.?\s*$/m.test(markdown);
}

function hasUncheckedCheckbox(markdown: string): boolean {
  return /^- \[ \]/m.test(markdown);
}

function validateTaskId(taskId: string): void {
  if (!isFullNumericTaskId(taskId)) {
    throw new Error("task id must use four digits, a hyphen, and a lowercase slug");
  }
}

async function ensureTaskIdAvailable(root: string, taskId: string): Promise<void> {
  const prefix = taskId.slice(0, 4);
  const conflict = (await listTaskIds(root, "all")).find((existing) => existing.startsWith(`${prefix}-`));
  if (conflict !== undefined) {
    throw new Error(`task number ${prefix} is already used by ${conflict}`);
  }
}

function stateUpdateSummary(previous: TaskStateRecord, next: TaskStateRecord): string {
  const changes: string[] = [];
  if (previous.lifecycle !== next.lifecycle) {
    changes.push(`lifecycle ${previous.lifecycle} -> ${next.lifecycle}`);
  }
  if (previous.phase !== next.phase) {
    changes.push(`phase ${previous.phase} -> ${next.phase}`);
  }
  if (previous.next_action !== next.next_action) {
    changes.push("next action updated");
  }
  return changes.length > 0 ? changes.join("; ") : "Task state refreshed.";
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST";
}
