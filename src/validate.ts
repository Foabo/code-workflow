import path from "node:path";
import { access, readdir, readFile } from "node:fs/promises";
import { readJsonFile } from "./json.js";
import { getCwPaths } from "./paths.js";
import { validateTaskStateRecord, validateVersionRecord } from "./schema.js";
import { PROJECT_BASELINE_TEMPLATES, TASK_ARTIFACT_TEMPLATES } from "./templates.js";
import { DoctorReport, TaskStateRecord, ValidationIssue } from "./types.js";

export async function validateProject(root: string): Promise<ValidationIssue[]> {
  const paths = getCwPaths(root);
  const issues: ValidationIssue[] = [];

  issues.push(...(await validateRequiredFile(paths.version)));
  if (issues.length === 0) {
    try {
      issues.push(...validateVersionRecord(await readJsonFile(paths.version), ".cw/version.json"));
    } catch (error) {
      issues.push({ path: ".cw/version.json", message: formatError(error) });
    }
  }

  for (const fileName of Object.keys(PROJECT_BASELINE_TEMPLATES)) {
    issues.push(...(await validateRequiredFile(path.join(paths.project, fileName))));
  }

  for (const fileName of Object.keys(TASK_ARTIFACT_TEMPLATES)) {
    issues.push(...(await validateRequiredFile(path.join(paths.templates, fileName))));
  }

  for (const taskId of await listTaskIds(root)) {
    const taskRoot = path.join(paths.tasks, taskId);
    const taskJson = path.join(taskRoot, "task.json");
    const traceJsonl = path.join(taskRoot, "trace.jsonl");
    issues.push(...(await validateRequiredFile(taskJson)));
    issues.push(...(await validateRequiredFile(traceJsonl)));
    if (await exists(taskJson)) {
      try {
        const state = await readJsonFile<TaskStateRecord>(taskJson);
        issues.push(...validateTaskStateRecord(state, `.cw/tasks/${taskId}/task.json`));
        issues.push(...(await validateTaskArtifacts(root, taskId, state)));
      } catch (error) {
        issues.push({ path: `.cw/tasks/${taskId}/task.json`, message: formatError(error) });
      }
    }
    if (await exists(traceJsonl)) {
      issues.push(...(await validateTraceJsonl(root, taskId, traceJsonl)));
    }
  }

  return issues;
}

export async function doctorProject(root: string): Promise<DoctorReport> {
  const issues = await validateProject(root);
  const warnings: ValidationIssue[] = [];

  for (const taskId of await listTaskIds(root)) {
    const taskJson = path.join(getCwPaths(root).tasks, taskId, "task.json");
    if (!(await exists(taskJson))) {
      continue;
    }
    try {
      const state = await readJsonFile<TaskStateRecord>(taskJson);
      if (state.lifecycle !== "closed" && state.next_action.trim().length === 0) {
        warnings.push({ path: `.cw/tasks/${taskId}/task.json.next_action`, message: "unfinished task needs a next action" });
      }
      if (state.lifecycle === "closed" && state.artifacts.resume !== null) {
        warnings.push({ path: `.cw/tasks/${taskId}/task.json.artifacts.resume`, message: "closed task should not keep a resume note" });
      }
      if (state.lifecycle === "blocked" && state.blocked_reason === null) {
        warnings.push({ path: `.cw/tasks/${taskId}/task.json.blocked_reason`, message: "blocked task should record a reason" });
      }
      if (state.lifecycle === "parked" && state.parked_reason === null) {
        warnings.push({ path: `.cw/tasks/${taskId}/task.json.parked_reason`, message: "parked task should record a reason" });
      }
    } catch {
      continue;
    }
  }

  return { ok: issues.length === 0 && warnings.length === 0, issues, warnings };
}

async function validateTaskArtifacts(root: string, taskId: string, state: TaskStateRecord): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const taskRoot = path.join(getCwPaths(root).tasks, taskId);
  for (const artifactPath of Object.values(state.artifacts)) {
    if (artifactPath === null) {
      continue;
    }
    issues.push(...(await validateRequiredFile(path.join(taskRoot, artifactPath))));
  }
  return issues;
}

async function validateTraceJsonl(root: string, taskId: string, filePath: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const text = await readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const [index, line] of lines.entries()) {
    try {
      const value = JSON.parse(line) as unknown;
      if (!isTraceEventShape(value)) {
        issues.push({ path: `.cw/tasks/${taskId}/trace.jsonl:${index + 1}`, message: "trace event must include ts, type, and summary strings" });
      }
    } catch (error) {
      issues.push({ path: `.cw/tasks/${taskId}/trace.jsonl:${index + 1}`, message: formatError(error) });
    }
  }
  return issues;
}

async function validateRequiredFile(filePath: string): Promise<ValidationIssue[]> {
  if (await exists(filePath)) {
    return [];
  }
  return [{ path: filePath, message: "missing required file" }];
}

async function listTaskIds(root: string): Promise<string[]> {
  const tasksPath = getCwPaths(root).tasks;
  if (!(await exists(tasksPath))) {
    return [];
  }
  const entries = await readdir(tasksPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isTraceEventShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.ts === "string" && typeof record.type === "string" && typeof record.summary === "string";
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
