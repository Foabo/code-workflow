import { readTaskStateAt } from "./tasks.js";
import { resolveTaskReference, listTaskDirectoryEntries, TaskListScope } from "./task-storage.js";
import { TaskLifecycle, TaskStateRecord } from "./types.js";

export type TaskSummary = Pick<
  TaskStateRecord,
  "id" | "title" | "lifecycle" | "phase" | "next_action" | "updated_at"
>;

export type SelectTaskInput = {
  taskId?: string;
  lifecycles?: TaskLifecycle[];
};

export type ListTasksInput = {
  scope?: TaskListScope;
};

export async function listTasks(root: string, input: ListTasksInput = {}): Promise<TaskSummary[]> {
  const taskEntries = await listTaskDirectoryEntries(root, input.scope ?? "active");
  const tasks: TaskSummary[] = [];
  for (const entry of taskEntries) {
    const task = await readTaskStateAt(root, entry.id, { location: entry.location });
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
    const resolved = await resolveTaskReference(root, input.taskId, "active");
    return readTaskStateAt(root, resolved.id, { location: resolved.location });
  }

  const lifecycles = input.lifecycles ?? ["open", "blocked", "parked"];
  const candidates = (await listTasks(root)).filter((task) => lifecycles.includes(task.lifecycle));

  if (candidates.length === 0) {
    throw new Error("no matching task found");
  }
  if (candidates.length > 1) {
    throw new Error(`multiple matching tasks found: ${candidates.map((task) => task.id).join(", ")}`);
  }

  return readTaskStateAt(root, candidates[0].id);
}
