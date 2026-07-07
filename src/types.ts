export const FLOWFLOW_SCHEMA_VERSION = 1;

export type TaskLifecycle = "open" | "blocked" | "parked" | "closed";
export type EnhancementChoice = "skipped" | "detected" | "configured";
export type EnhancementCategory = "code_index" | "context_memory";
export type EnhancementSetupStatus = "skipped" | "pending" | "configured" | "failed";
export type DirtyWorktreeDecision = "clean" | "covered" | "unrelated";
export type BaselineDecision = "accepted" | "selected" | "edited" | "skipped";
export type AgentRoleName = "advisor" | "planner" | "implementer" | "reviewer" | "checker" | "baseline-writer";
export type AdvisorMode = "off" | "manual" | "gate" | "high-risk" | "always-on";
export type AdvisorSeverity = "nit" | "concern" | "blocker";
export type ModelCapabilityTier = "fast" | "balanced" | "high-reasoning" | "review" | "long-context";
export type ModelReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "auto";

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
  flowflow_version: string;
  created_at: string;
};

export type EnhancementConfigRecord = {
  schema_version: 1;
  code_intelligence: EnhancementChoice;
  external_context: EnhancementChoice;
  code_index?: EnhancementProviderRecord;
  context_memory?: EnhancementProviderRecord;
  updated_at: string;
};

export type EnhancementProviderRecord = {
  category: EnhancementCategory;
  provider_id: string;
  status: EnhancementSetupStatus;
  commands: string[];
  commands_run: string[];
  touched_files: string[];
  message: string;
  verification: {
    command: string;
    ok: boolean;
    exit_code: number | null;
  } | null;
  updated_at: string;
};

export type RoleModelProfile = {
  capability_tier: ModelCapabilityTier;
  model: string | null;
  reasoning_effort: ModelReasoningEffort | null;
  temperature?: number | null;
  notes: string[];
};

export type HarnessRoleModelOverride = {
  model?: string | null;
  reasoning_effort?: ModelReasoningEffort | null;
  temperature?: number | null;
};

export type OrchestrationConfigRecord = {
  schema_version: 1;
  advisor: {
    enabled_by_default: boolean;
    mode: AdvisorMode;
    sync_backlog: number;
    severity_levels: AdvisorSeverity[];
  };
  roles: Record<AgentRoleName, RoleModelProfile>;
  harness_overrides: Record<string, Partial<Record<AgentRoleName, HarnessRoleModelOverride>>>;
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
    code_index?: EnhancementProviderRecord | null;
    context_memory?: EnhancementProviderRecord | null;
  };
};
