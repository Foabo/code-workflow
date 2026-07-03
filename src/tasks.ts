import path from "node:path";
import { appendFile, rm, writeFile } from "node:fs/promises";
import { ensureDir, writeFileIfMissing } from "./fs.js";
import { readJsonFile, writeJsonFile } from "./json.js";
import { getCwPaths, taskDir, taskJsonPath, tracePath } from "./paths.js";
import { assertTaskStateRecord } from "./schema.js";
import { TASK_ARTIFACT_TEMPLATES } from "./templates.js";
import { CW_SCHEMA_VERSION, TaskLifecycle, TaskStateRecord, TraceEvent } from "./types.js";

export type CreateTaskInput = {
  id: string;
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

export async function createTask(root: string, input: CreateTaskInput): Promise<TaskStateRecord> {
  validateTaskId(input.id);
  const paths = getCwPaths(root);
  const dir = taskDir(root, input.id);
  await ensureDir(paths.tasks);
  await ensureDir(dir);

  const now = (input.now ?? new Date()).toISOString();
  const state: TaskStateRecord = {
    id: input.id,
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

  await writeFile(taskJsonPath(root, input.id), `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await writeFile(tracePath(root, input.id), "", { encoding: "utf8", flag: "wx" }).catch((error: unknown) => {
    if (isAlreadyExists(error)) {
      return;
    }
    throw error;
  });
  await appendTrace(root, input.id, {
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

export async function updateTaskState(
  root: string,
  taskId: string,
  input: UpdateTaskStateInput
): Promise<TaskStateRecord> {
  const state = await readTaskState(root, taskId);
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

  await writeJsonFile(taskJsonPath(root, taskId), next);
  await appendTrace(root, taskId, {
    ts: next.updated_at,
    type: "task.state.updated",
    summary: stateUpdateSummary(state, next)
  });
  return next;
}

export async function appendTrace(root: string, taskId: string, event: TraceEvent): Promise<void> {
  if (!event.ts || !event.type || !event.summary) {
    throw new Error("trace event requires ts, type, and summary");
  }
  await appendFile(tracePath(root, taskId), `${JSON.stringify(event)}\n`, "utf8");
}

export async function createResumeNote(
  root: string,
  taskId: string,
  content: string,
  resumeCondition: string | null = null,
  now = new Date()
): Promise<TaskStateRecord> {
  const state = await readTaskState(root, taskId);
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

function validateTaskId(taskId: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(taskId)) {
    throw new Error("task id must use lowercase letters, numbers, and hyphens");
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
