export { initProject } from "./project/index.js";
export type { InitOptions, InitResult } from "./project/index.js";

export { updateProject } from "./harness/index.js";
export type { UpdateOptions, UpdateResult } from "./harness/index.js";

export { runWorkflowAction } from "./workflow/index.js";
export type { WorkflowCommandAction, WorkflowOptions, WorkflowResult } from "./workflow/index.js";

export { doctorProject, validateProject } from "./project/index.js";

export type { HarnessName } from "./harness/index.js";
export type { BaselineFile } from "./baseline/index.js";
export type {
  BaselineDecision,
  DirtyWorktreeDecision,
  DoctorReport,
  EnhancementChoice,
  OrchestrationConfigRecord,
  TaskStateRecord,
  ValidationIssue
} from "./domain/index.js";
