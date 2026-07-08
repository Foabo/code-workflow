export {
  appendTrace,
  checkClosureGate,
  consumeResumeNote,
  createResumeNote,
  createTask,
  discardTask,
  finishTask,
  migrateTasks,
  readTaskState,
  readTaskStateAt,
  updateTaskState
} from "./lifecycle.js";
export type {
  CreateTaskInput,
  DiscardTaskInput,
  FinishTaskInput,
  TaskFileInput,
  UpdateTaskStateInput
} from "./lifecycle.js";

export { taskDir, taskJsonPath, tracePath } from "./paths.js";
export type { TaskLocation } from "./paths.js";

export {
  allocateTaskId,
  formatTaskId,
  isFullNumericTaskId,
  isShortNumericTaskReference,
  listTaskDirectoryEntries,
  listTaskIds,
  migrateLegacyTaskIds,
  resolveTaskReference,
  slugifyTaskTitle
} from "./storage.js";
export type {
  LegacyTaskMigration,
  LegacyTaskMigrationResult,
  TaskDirectoryEntry,
  TaskListScope,
  TaskReferenceResolution
} from "./storage.js";

export { listTasks, selectTask } from "./store.js";
export type { ListTasksInput, SelectTaskInput, TaskSummary } from "./store.js";

export { TASK_ARTIFACT_TEMPLATES } from "./templates.js";
