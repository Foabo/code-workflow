import {
  CW_SCHEMA_VERSION,
  EnhancementCategory,
  EnhancementChoice,
  EnhancementConfigRecord,
  EnhancementSetupStatus,
  TaskLifecycle,
  TaskStateRecord,
  ValidationIssue,
  VersionRecord
} from "./types.js";

const lifecycles = new Set<TaskLifecycle>(["open", "blocked", "parked", "closed"]);
const enhancementChoices = new Set<EnhancementChoice>(["skipped", "detected", "configured"]);
const enhancementCategories = new Set<EnhancementCategory>(["code_index", "context_memory"]);
const enhancementSetupStatuses = new Set<EnhancementSetupStatus>(["skipped", "pending", "configured", "failed"]);

export function validateVersionRecord(value: unknown, pathName = ".cw/version.json"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: pathName, message: "must be a JSON object" }];
  }
  requireNumber(value, "schema_version", pathName, issues);
  requireString(value, "cw_version", pathName, issues);
  requireString(value, "created_at", pathName, issues);
  if (value.schema_version !== CW_SCHEMA_VERSION) {
    issues.push({ path: `${pathName}.schema_version`, message: `must be ${CW_SCHEMA_VERSION}` });
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
  if (value.schema_version !== CW_SCHEMA_VERSION) {
    issues.push({ path: `${pathName}.schema_version`, message: `must be ${CW_SCHEMA_VERSION}` });
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
  pathName = ".cw/enhancements.json"
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: pathName, message: "must be a JSON object" }];
  }
  requireNumber(value, "schema_version", pathName, issues);
  if (value.schema_version !== CW_SCHEMA_VERSION) {
    issues.push({ path: `${pathName}.schema_version`, message: `must be ${CW_SCHEMA_VERSION}` });
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
