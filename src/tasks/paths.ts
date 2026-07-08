import path from "node:path";
import { getFlowflowPaths } from "../project/paths.js";

export type TaskLocation = "active" | "archived";

export function taskDir(root: string, taskId: string, location: TaskLocation = "active"): string {
  const paths = getFlowflowPaths(root);
  return path.join(location === "archived" ? paths.tasksArchive : paths.tasks, taskId);
}

export function taskJsonPath(root: string, taskId: string, location: TaskLocation = "active"): string {
  return path.join(taskDir(root, taskId, location), "task.json");
}

export function tracePath(root: string, taskId: string, location: TaskLocation = "active"): string {
  return path.join(taskDir(root, taskId, location), "trace.jsonl");
}
