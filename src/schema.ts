import { CW_SCHEMA_VERSION, TaskLifecycle, TaskStateRecord, ValidationIssue, VersionRecord } from "./types.js";

const lifecycles = new Set<TaskLifecycle>(["open", "blocked", "parked", "closed"]);

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

export function assertVersionRecord(value: unknown, pathName?: string): asserts value is VersionRecord {
  throwIfIssues(validateVersionRecord(value, pathName));
}

export function assertTaskStateRecord(value: unknown, pathName?: string): asserts value is TaskStateRecord {
  throwIfIssues(validateTaskStateRecord(value, pathName));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
