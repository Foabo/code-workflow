export { initProject } from "./init.js";
export type { InitOptions, InitResult } from "./init.js";

export { updateProject } from "./update.js";
export type { UpdateResult } from "./update.js";

export { runWorkflowAction } from "./workflow.js";
export type { WorkflowCommandAction, WorkflowOptions, WorkflowResult } from "./workflow.js";

export { doctorProject, validateProject } from "./validate.js";

export type { HarnessName } from "./adapters.js";
export type { BaselineFile } from "./baseline.js";
export type {
  BaselineDecision,
  DirtyWorktreeDecision,
  DoctorReport,
  EnhancementChoice,
  TaskStateRecord,
  ValidationIssue
} from "./types.js";
