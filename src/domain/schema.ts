import {
  FLOWFLOW_SCHEMA_VERSION,
  AgentRoleName,
  AdvisorMode,
  AdvisorSeverity,
  EnhancementCategory,
  EnhancementChoice,
  EnhancementConfigRecord,
  EnhancementSetupStatus,
  ModelCapabilityTier,
  ModelReasoningEffort,
  OrchestrationConfigRecord,
  TaskLifecycle,
  TaskStateRecord,
  ValidationIssue,
  VersionRecord
} from "./types.js";
import {
  ADVISOR_MODES,
  ADVISOR_SEVERITIES,
  AGENT_ROLE_NAMES,
  MODEL_CAPABILITY_TIERS,
  MODEL_REASONING_EFFORTS,
  ORCHESTRATION_HARNESSES
} from "./orchestration.js";

const lifecycles = new Set<TaskLifecycle>(["open", "blocked", "parked", "closed"]);
const enhancementChoices = new Set<EnhancementChoice>(["skipped", "detected", "configured"]);
const enhancementCategories = new Set<EnhancementCategory>(["code_index", "context_memory"]);
const enhancementSetupStatuses = new Set<EnhancementSetupStatus>(["skipped", "pending", "configured", "failed"]);
const agentRoles = new Set<AgentRoleName>(AGENT_ROLE_NAMES);
const advisorModes = new Set<AdvisorMode>(ADVISOR_MODES);
const advisorSeverities = new Set<AdvisorSeverity>(ADVISOR_SEVERITIES);
const modelCapabilityTiers = new Set<ModelCapabilityTier>(MODEL_CAPABILITY_TIERS);
const modelReasoningEfforts = new Set<ModelReasoningEffort>(MODEL_REASONING_EFFORTS);
const orchestrationHarnesses = new Set<string>(ORCHESTRATION_HARNESSES);

export function validateVersionRecord(value: unknown, pathName = ".ff/version.json"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: pathName, message: "must be a JSON object" }];
  }
  requireNumber(value, "schema_version", pathName, issues);
  requireString(value, "flowflow_version", pathName, issues);
  requireString(value, "created_at", pathName, issues);
  if (value.schema_version !== FLOWFLOW_SCHEMA_VERSION) {
    issues.push({ path: `${pathName}.schema_version`, message: `must be ${FLOWFLOW_SCHEMA_VERSION}` });
  }
  return issues;
}

export function validateTaskStateRecord(value: unknown, pathName = "task.json"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: pathName, message: "must be a JSON object" }];
  }

  for (const key of ["id", "title", "phase", "next_action", "created_at", "updated_at"]) {
    requireString(value, key, pathName, issues);
  }

  requireNumber(value, "schema_version", pathName, issues);
  if (value.schema_version !== FLOWFLOW_SCHEMA_VERSION) {
    issues.push({ path: `${pathName}.schema_version`, message: `must be ${FLOWFLOW_SCHEMA_VERSION}` });
  }

  if (typeof value.lifecycle !== "string" || !lifecycles.has(value.lifecycle as TaskLifecycle)) {
    issues.push({ path: `${pathName}.lifecycle`, message: "must be one of open, blocked, parked, closed" });
  }
  if ("result" in value) {
    issues.push({ path: `${pathName}.result`, message: "result field is not part of task state" });
  }

  requireStringArray(value, "health_flags", pathName, issues);
  requireStringArray(value, "invalidated_artifacts", pathName, issues);
  requireNullableString(value, "blocked_reason", pathName, issues);
  requireNullableString(value, "parked_reason", pathName, issues);
  requireNullableString(value, "resume_condition", pathName, issues);

  if (!isRecord(value.artifacts)) {
    issues.push({ path: `${pathName}.artifacts`, message: "must be a JSON object" });
  } else {
    for (const key of ["spec", "plan", "task"]) {
      requireString(value.artifacts, key, `${pathName}.artifacts`, issues);
    }
    requireNullableString(value.artifacts, "baseline_delta", `${pathName}.artifacts`, issues);
    requireNullableString(value.artifacts, "resume", `${pathName}.artifacts`, issues);
  }

  return issues;
}

export function validateEnhancementConfigRecord(
  value: unknown,
  pathName = ".ff/enhancements.json"
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: pathName, message: "must be a JSON object" }];
  }
  requireNumber(value, "schema_version", pathName, issues);
  if (value.schema_version !== FLOWFLOW_SCHEMA_VERSION) {
    issues.push({ path: `${pathName}.schema_version`, message: `must be ${FLOWFLOW_SCHEMA_VERSION}` });
  }
  requireEnhancementChoice(value, "code_intelligence", pathName, issues);
  requireEnhancementChoice(value, "external_context", pathName, issues);
  if (value.code_index !== undefined) {
    requireEnhancementProviderRecord(value.code_index, "code_index", `${pathName}.code_index`, issues);
  }
  if (value.context_memory !== undefined) {
    requireEnhancementProviderRecord(value.context_memory, "context_memory", `${pathName}.context_memory`, issues);
  }
  requireString(value, "updated_at", pathName, issues);
  return issues;
}

export function validateOrchestrationConfigRecord(
  value: unknown,
  pathName = ".ff/orchestration.json"
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: pathName, message: "must be a JSON object" }];
  }
  requireNumber(value, "schema_version", pathName, issues);
  if (value.schema_version !== FLOWFLOW_SCHEMA_VERSION) {
    issues.push({ path: `${pathName}.schema_version`, message: `must be ${FLOWFLOW_SCHEMA_VERSION}` });
  }
  requireString(value, "updated_at", pathName, issues);
  validateAdvisorConfig(value.advisor, `${pathName}.advisor`, issues);
  validateRoleProfiles(value.roles, `${pathName}.roles`, issues);
  validateHarnessOverrides(value.harness_overrides, `${pathName}.harness_overrides`, issues);
  return issues;
}

export function assertVersionRecord(value: unknown, pathName?: string): asserts value is VersionRecord {
  throwIfIssues(validateVersionRecord(value, pathName));
}

export function assertTaskStateRecord(value: unknown, pathName?: string): asserts value is TaskStateRecord {
  throwIfIssues(validateTaskStateRecord(value, pathName));
}

export function assertEnhancementConfigRecord(
  value: unknown,
  pathName?: string
): asserts value is EnhancementConfigRecord {
  throwIfIssues(validateEnhancementConfigRecord(value, pathName));
}

export function assertOrchestrationConfigRecord(
  value: unknown,
  pathName?: string
): asserts value is OrchestrationConfigRecord {
  throwIfIssues(validateOrchestrationConfigRecord(value, pathName));
}

function throwIfIssues(issues: ValidationIssue[]): void {
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  if (typeof record[key] !== "string" || record[key].length === 0) {
    issues.push({ path: `${pathName}.${key}`, message: "must be a non-empty string" });
  }
}

function requireNullableString(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  const value = record[key];
  if (value !== null && typeof value !== "string") {
    issues.push({ path: `${pathName}.${key}`, message: "must be a string or null" });
  }
}

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  if (typeof record[key] !== "number") {
    issues.push({ path: `${pathName}.${key}`, message: "must be a number" });
  }
}

function requireStringArray(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    issues.push({ path: `${pathName}.${key}`, message: "must be an array of strings" });
  }
}

function requireEnhancementChoice(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  if (typeof record[key] !== "string" || !enhancementChoices.has(record[key] as EnhancementChoice)) {
    issues.push({ path: `${pathName}.${key}`, message: "must be skipped, detected, or configured" });
  }
}

function requireEnhancementProviderRecord(
  value: unknown,
  expectedCategory: EnhancementCategory,
  pathName: string,
  issues: ValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path: pathName, message: "must be a JSON object" });
    return;
  }

  requireString(value, "provider_id", pathName, issues);
  requireString(value, "message", pathName, issues);
  requireString(value, "updated_at", pathName, issues);
  requireStringArray(value, "commands", pathName, issues);
  requireStringArray(value, "commands_run", pathName, issues);
  requireStringArray(value, "touched_files", pathName, issues);

  if (typeof value.category !== "string" || !enhancementCategories.has(value.category as EnhancementCategory)) {
    issues.push({ path: `${pathName}.category`, message: "must be code_index or context_memory" });
  } else if (value.category !== expectedCategory) {
    issues.push({ path: `${pathName}.category`, message: `must be ${expectedCategory}` });
  }

  if (typeof value.status !== "string" || !enhancementSetupStatuses.has(value.status as EnhancementSetupStatus)) {
    issues.push({ path: `${pathName}.status`, message: "must be skipped, pending, configured, or failed" });
  }

  if (value.verification !== null) {
    if (!isRecord(value.verification)) {
      issues.push({ path: `${pathName}.verification`, message: "must be a JSON object or null" });
    } else {
      requireString(value.verification, "command", `${pathName}.verification`, issues);
      requireBoolean(value.verification, "ok", `${pathName}.verification`, issues);
      requireNullableNumber(value.verification, "exit_code", `${pathName}.verification`, issues);
    }
  }
}

function validateAdvisorConfig(value: unknown, pathName: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path: pathName, message: "must be a JSON object" });
    return;
  }
  requireBoolean(value, "enabled_by_default", pathName, issues);
  requireNumber(value, "sync_backlog", pathName, issues);
  if (typeof value.mode !== "string" || !advisorModes.has(value.mode as AdvisorMode)) {
    issues.push({ path: `${pathName}.mode`, message: "must be off, manual, gate, high-risk, or always-on" });
  }
  requireEnumStringArray(value, "severity_levels", advisorSeverities, pathName, issues, "must contain nit, concern, or blocker");
}

function validateRoleProfiles(value: unknown, pathName: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path: pathName, message: "must be a JSON object" });
    return;
  }
  for (const role of AGENT_ROLE_NAMES) {
    validateRoleModelProfile(value[role], `${pathName}.${role}`, issues);
  }
  for (const key of Object.keys(value)) {
    if (!agentRoles.has(key as AgentRoleName)) {
      issues.push({ path: `${pathName}.${key}`, message: "unknown role" });
    }
  }
}

function validateRoleModelProfile(value: unknown, pathName: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path: pathName, message: "must be a JSON object" });
    return;
  }
  if (typeof value.capability_tier !== "string" || !modelCapabilityTiers.has(value.capability_tier as ModelCapabilityTier)) {
    issues.push({ path: `${pathName}.capability_tier`, message: "must be fast, balanced, high-reasoning, review, or long-context" });
  }
  requireNullableString(value, "model", pathName, issues);
  requireNullableReasoningEffort(value, "reasoning_effort", pathName, issues);
  if ("temperature" in value) {
    requireNullableTemperature(value, "temperature", pathName, issues);
  }
  requireStringArray(value, "notes", pathName, issues);
}

function validateHarnessOverrides(value: unknown, pathName: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path: pathName, message: "must be a JSON object" });
    return;
  }
  for (const [harness, overrides] of Object.entries(value)) {
    if (!orchestrationHarnesses.has(harness)) {
      issues.push({ path: `${pathName}.${harness}`, message: "unknown harness" });
      continue;
    }
    if (!isRecord(overrides)) {
      issues.push({ path: `${pathName}.${harness}`, message: "must be a JSON object" });
      continue;
    }
    for (const [role, override] of Object.entries(overrides)) {
      if (!agentRoles.has(role as AgentRoleName)) {
        issues.push({ path: `${pathName}.${harness}.${role}`, message: "unknown role" });
        continue;
      }
      if (!isRecord(override)) {
        issues.push({ path: `${pathName}.${harness}.${role}`, message: "must be a JSON object" });
        continue;
      }
      if ("model" in override) {
        requireNullableString(override, "model", `${pathName}.${harness}.${role}`, issues);
      }
      if ("reasoning_effort" in override) {
        requireNullableReasoningEffort(override, "reasoning_effort", `${pathName}.${harness}.${role}`, issues);
      }
      if ("temperature" in override) {
        requireNullableTemperature(override, "temperature", `${pathName}.${harness}.${role}`, issues);
      }
    }
  }
}

function requireBoolean(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  if (typeof record[key] !== "boolean") {
    issues.push({ path: `${pathName}.${key}`, message: "must be a boolean" });
  }
}

function requireEnumStringArray<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: Set<T>,
  pathName: string,
  issues: ValidationIssue[],
  message: string
): void {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !allowed.has(item as T))) {
    issues.push({ path: `${pathName}.${key}`, message });
  }
}

function requireNullableReasoningEffort(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  const value = record[key];
  if (value !== null && (typeof value !== "string" || !modelReasoningEfforts.has(value as ModelReasoningEffort))) {
    issues.push({ path: `${pathName}.${key}`, message: "must be none, low, medium, high, xhigh, auto, or null" });
  }
}

function requireNullableTemperature(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  const value = record[key];
  if (value !== null && (typeof value !== "number" || value < 0 || value > 2)) {
    issues.push({ path: `${pathName}.${key}`, message: "must be a number from 0 to 2, or null" });
  }
}

function requireNullableNumber(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[]
): void {
  const value = record[key];
  if (value !== null && typeof value !== "number") {
    issues.push({ path: `${pathName}.${key}`, message: "must be a number or null" });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
