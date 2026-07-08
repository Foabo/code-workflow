import path from "node:path";
import { access } from "node:fs/promises";
import { getGitStatus, GitStatus } from "../shared/index.js";
import { taskDir } from "../tasks/index.js";
import { selectTask } from "../tasks/index.js";
import { validateProject } from "../project/index.js";
import { TaskStateRecord, ValidationIssue } from "../domain/index.js";

export type WorkflowAction =
  | "work"
  | "clarify"
  | "plan"
  | "run"
  | "check"
  | "finish"
  | "resume"
  | "discard"
  | "understand";

export type PreflightInput = {
  action: WorkflowAction;
  taskId?: string;
};

export type PreflightReport = {
  ok: boolean;
  action: WorkflowAction;
  task: TaskStateRecord | null;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  git: GitStatus;
};

export async function preflight(root: string, input: PreflightInput): Promise<PreflightReport> {
  const issues = await validateProject(root);
  const warnings: ValidationIssue[] = [];
  const git = await getGitStatus(root);
  let task: TaskStateRecord | null = null;

  if (input.action !== "understand") {
    try {
      task = await selectTask(root, { taskId: input.taskId });
      warnings.push(...(await taskWarnings(root, task, input.action)));
    } catch (error) {
      if (input.action === "work") {
        warnings.push({ path: ".ff/tasks", message: formatError(error) });
      } else {
        issues.push({ path: ".ff/tasks", message: formatError(error) });
      }
    }
  }

  if (git.kind === "dirty") {
    warnings.push({ path: "git", message: `dirty worktree has ${git.entries.length} entries` });
  }

  return {
    ok: issues.length === 0,
    action: input.action,
    task,
    issues,
    warnings,
    git
  };
}

async function taskWarnings(root: string, task: TaskStateRecord, action: WorkflowAction): Promise<ValidationIssue[]> {
  const warnings: ValidationIssue[] = [];

  if (task.lifecycle === "closed" && action !== "discard") {
    warnings.push({ path: `.ff/tasks/${task.id}/task.json.lifecycle`, message: "task is already closed" });
  }
  if (task.lifecycle === "blocked" && action !== "clarify" && action !== "discard") {
    warnings.push({ path: `.ff/tasks/${task.id}/task.json.lifecycle`, message: "task is blocked" });
  }
  if (task.lifecycle === "parked" && action !== "resume" && action !== "discard") {
    warnings.push({ path: `.ff/tasks/${task.id}/task.json.lifecycle`, message: "task is parked" });
  }
  if (task.artifacts.resume !== null && action !== "resume" && action !== "finish" && action !== "discard") {
    warnings.push({ path: `.ff/tasks/${task.id}/${task.artifacts.resume}`, message: "resume note exists but action is not resume" });
  }
  if (action === "finish" && task.artifacts.baseline_delta !== null) {
    warnings.push({
      path: `.ff/tasks/${task.id}/${task.artifacts.baseline_delta}`,
      message: "baseline delta exists; finish will merge it by default unless the user chooses selected, edited, or skipped"
    });
  }

  for (const artifact of Object.values(task.artifacts)) {
    if (artifact !== null && !(await exists(path.join(taskDir(root, task.id), artifact)))) {
      warnings.push({ path: `.ff/tasks/${task.id}/${artifact}`, message: "artifact is referenced but missing" });
    }
  }

  return warnings;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
