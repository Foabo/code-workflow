import path from "node:path";

export type FlowflowPaths = ReturnType<typeof getFlowflowPaths>;

export const TASK_ARCHIVE_DIR_NAME = "archived";

export function getFlowflowPaths(root: string) {
  const ff = path.join(root, ".ff");
  const tasks = path.join(ff, "tasks");
  return {
    root,
    ff,
    version: path.join(ff, "version.json"),
    enhancements: path.join(ff, "enhancements.json"),
    orchestration: path.join(ff, "orchestration.json"),
    understandDraft: path.join(ff, "understand-draft"),
    project: path.join(ff, "project"),
    tasks,
    tasksArchive: path.join(tasks, TASK_ARCHIVE_DIR_NAME),
    templates: path.join(ff, "templates")
  };
}
