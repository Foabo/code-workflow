import path from "node:path";

export type CwPaths = ReturnType<typeof getCwPaths>;
export type TaskLocation = "active" | "archived";

export const TASK_ARCHIVE_DIR_NAME = "archived";

export function getCwPaths(root: string) {
  const cw = path.join(root, ".cw");
  const tasks = path.join(cw, "tasks");
  return {
    root,
    cw,
    version: path.join(cw, "version.json"),
    enhancements: path.join(cw, "enhancements.json"),
    understandDraft: path.join(cw, "understand-draft"),
    project: path.join(cw, "project"),
    tasks,
    tasksArchive: path.join(tasks, TASK_ARCHIVE_DIR_NAME),
    templates: path.join(cw, "templates")
  };
}

export function taskDir(root: string, taskId: string, location: TaskLocation = "active"): string {
  const paths = getCwPaths(root);
  return path.join(location === "archived" ? paths.tasksArchive : paths.tasks, taskId);
}

export function taskJsonPath(root: string, taskId: string, location: TaskLocation = "active"): string {
  return path.join(taskDir(root, taskId, location), "task.json");
}

export function tracePath(root: string, taskId: string, location: TaskLocation = "active"): string {
  return path.join(taskDir(root, taskId, location), "trace.jsonl");
}
