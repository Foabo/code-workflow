import path from "node:path";

export type CwPaths = ReturnType<typeof getCwPaths>;

export function getCwPaths(root: string) {
  const cw = path.join(root, ".cw");
  return {
    root,
    cw,
    version: path.join(cw, "version.json"),
    enhancements: path.join(cw, "enhancements.json"),
    agentCommands: path.join(cw, "agent-commands"),
    understandDraft: path.join(cw, "understand-draft"),
    project: path.join(cw, "project"),
    tasks: path.join(cw, "tasks"),
    templates: path.join(cw, "templates")
  };
}

export function taskDir(root: string, taskId: string): string {
  return path.join(getCwPaths(root).tasks, taskId);
}

export function taskJsonPath(root: string, taskId: string): string {
  return path.join(taskDir(root, taskId), "task.json");
}

export function tracePath(root: string, taskId: string): string {
  return path.join(taskDir(root, taskId), "trace.jsonl");
}
