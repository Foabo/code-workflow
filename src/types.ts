export const CW_SCHEMA_VERSION = 1;

export type TaskLifecycle = "open" | "blocked" | "parked" | "closed";
export type EnhancementChoice = "skipped" | "detected" | "configured";
export type DirtyWorktreeDecision = "clean" | "covered" | "unrelated";
export type BaselineDecision = "accepted" | "selected" | "edited" | "skipped";

export type TaskArtifacts = {
  spec: string;
  plan: string;
  task: string;
  baseline_delta: string | null;
  resume: string | null;
};

export type TaskStateRecord = {
  id: string;
  title: string;
  lifecycle: TaskLifecycle;
  phase: string;
  next_action: string;
  health_flags: string[];
  artifacts: TaskArtifacts;
  invalidated_artifacts: string[];
  blocked_reason: string | null;
  parked_reason: string | null;
  resume_condition: string | null;
  created_at: string;
  updated_at: string;
  schema_version: 1;
};

export type VersionRecord = {
  schema_version: 1;
  cw_version: string;
  created_at: string;
};

export type EnhancementConfigRecord = {
  schema_version: 1;
  code_intelligence: EnhancementChoice;
  external_context: EnhancementChoice;
  updated_at: string;
};

export type TraceEvent = {
  ts: string;
  type: string;
  summary: string;
  data?: Record<string, unknown>;
};

export type ValidationIssue = {
  path: string;
  message: string;
};

export type DoctorReport = {
  ok: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  enhancements?: {
    code_intelligence: EnhancementChoice | null;
    external_context: EnhancementChoice | null;
  };
};
