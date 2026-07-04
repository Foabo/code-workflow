import path from "node:path";
import { access, readdir } from "node:fs/promises";
import { readTaskState } from "./tasks.js";
import { getCwPaths } from "./paths.js";
import { TaskLifecycle, TaskStateRecord } from "./types.js";

export type TaskSummary = Pick<
  TaskStateRecord,
  "id" | "title" | "lifecycle" | "phase" | "next_action" | "updated_at"
>;

export type SelectTaskInput = {
  taskId?: string;
  lifecycles?: TaskLifecycle[];
};

export async function listTasks(root: string): Promise<TaskSummary[]> {
  const taskIds = await listTaskIds(root);
  const tasks: TaskSummary[] = [];
  for (const taskId of taskIds) {
    const task = await readTaskState(root, taskId);
    tasks.push({
      id: task.id,
      title: task.title,
      lifecycle: task.lifecycle,
      phase: task.phase,
      next_action: task.next_action,
      updated_at: task.updated_at
    });
  }
  return tasks.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function selectTask(root: string, input: SelectTaskInput = {}): Promise<TaskStateRecord> {
  if (input.taskId !== undefined) {
    return readTaskState(root, input.taskId);
  }

  const lifecycles = input.lifecycles ?? ["open", "blocked", "parked"];
  const candidates = (await listTasks(root)).filter((task) => lifecycles.includes(task.lifecycle));

  if (candidates.length === 0) {
    throw new Error("no matching task found");
  }
  if (candidates.length > 1) {
    throw new Error(`multiple matching tasks found: ${candidates.map((task) => task.id).join(", ")}`);
  }

  return readTaskState(root, candidates[0].id);
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
    await access(path.resolve(filePath));
    return true;
  } catch {
    return false;
  }
}
