import path from "node:path";
import { access, readFile } from "node:fs/promises";
import { expectedGeneratedRoleAgentsForRoot, isGeneratedSkillCurrent } from "./adapters.js";
import { readJsonFile } from "./json.js";
import { getCwPaths, TaskLocation, taskDir } from "./paths.js";
import {
  validateEnhancementConfigRecord,
  validateOrchestrationConfigRecord,
  validateTaskStateRecord,
  validateVersionRecord
} from "./schema.js";
import { listTaskDirectoryEntries } from "./task-storage.js";
import { PROJECT_BASELINE_TEMPLATES, TASK_ARTIFACT_TEMPLATES } from "./templates.js";
import { AGENT_COMMANDS } from "./templates.js";
import { DoctorReport, EnhancementConfigRecord, TaskStateRecord, ValidationIssue } from "./types.js";

export async function validateProject(root: string): Promise<ValidationIssue[]> {
  const paths = getCwPaths(root);
  const issues: ValidationIssue[] = [];

  issues.push(...(await validateRequiredFile(paths.version)));
  if (issues.length === 0) {
    try {
      issues.push(...validateVersionRecord(await readJsonFile(paths.version), ".cw/version.json"));
    } catch (error) {
      issues.push({ path: ".cw/version.json", message: formatError(error) });
    }
  }

  if (await exists(paths.enhancements)) {
    try {
      issues.push(...validateEnhancementConfigRecord(await readJsonFile(paths.enhancements), ".cw/enhancements.json"));
    } catch (error) {
      issues.push({ path: ".cw/enhancements.json", message: formatError(error) });
    }
  }

  if (await exists(paths.orchestration)) {
    try {
      issues.push(...validateOrchestrationConfigRecord(await readJsonFile(paths.orchestration), ".cw/orchestration.json"));
    } catch (error) {
      issues.push({ path: ".cw/orchestration.json", message: formatError(error) });
    }
  }

  for (const fileName of Object.keys(PROJECT_BASELINE_TEMPLATES)) {
    issues.push(...(await validateRequiredFile(path.join(paths.project, fileName))));
  }

  for (const fileName of Object.keys(TASK_ARTIFACT_TEMPLATES)) {
    issues.push(...(await validateRequiredFile(path.join(paths.templates, fileName))));
  }

  for (const entry of await listTaskDirectoryEntries(root, "active")) {
    const taskId = entry.id;
    const taskRoot = entry.dir;
    const taskJson = path.join(taskRoot, "task.json");
    const traceJsonl = path.join(taskRoot, "trace.jsonl");
    issues.push(...(await validateRequiredFile(taskJson)));
    issues.push(...(await validateRequiredFile(traceJsonl)));
    if (await exists(taskJson)) {
      try {
        const state = await readJsonFile<TaskStateRecord>(taskJson);
        issues.push(...validateTaskStateRecord(state, `.cw/tasks/${taskId}/task.json`));
        if (state.id !== taskId) {
          issues.push({ path: `.cw/tasks/${taskId}/task.json.id`, message: "task id must match its directory name" });
        }
        issues.push(...(await validateTaskArtifacts(root, taskId, state, entry.location)));
      } catch (error) {
        issues.push({ path: `.cw/tasks/${taskId}/task.json`, message: formatError(error) });
      }
    }
    if (await exists(traceJsonl)) {
      issues.push(...(await validateTraceJsonl(root, taskId, traceJsonl)));
    }
  }

  return issues;
}

export async function doctorProject(root: string): Promise<DoctorReport> {
  const issues = await validateProject(root);
  const warnings: ValidationIssue[] = [];
  const enhancements = await readEnhancementStatus(root);

  for (const entry of await listTaskDirectoryEntries(root, "active")) {
    const taskId = entry.id;
    const taskJson = path.join(entry.dir, "task.json");
    if (!(await exists(taskJson))) {
      continue;
    }
    try {
      const state = await readJsonFile<TaskStateRecord>(taskJson);
      if (state.lifecycle !== "closed" && state.next_action.trim().length === 0) {
        warnings.push({ path: `.cw/tasks/${taskId}/task.json.next_action`, message: "unfinished task needs a next action" });
      }
      if (state.lifecycle === "closed" && state.artifacts.resume !== null) {
        warnings.push({ path: `.cw/tasks/${taskId}/task.json.artifacts.resume`, message: "closed task should not keep a resume note" });
      }
      if (state.lifecycle === "blocked" && state.blocked_reason === null) {
        warnings.push({ path: `.cw/tasks/${taskId}/task.json.blocked_reason`, message: "blocked task should record a reason" });
      }
      if (state.lifecycle === "parked" && state.parked_reason === null) {
        warnings.push({ path: `.cw/tasks/${taskId}/task.json.parked_reason`, message: "parked task should record a reason" });
      }
    } catch {
      continue;
    }
  }

  warnings.push(...(await generatedAdapterWarnings(root)));

  return { ok: issues.length === 0 && warnings.length === 0, issues, warnings, enhancements };
}

async function readEnhancementStatus(root: string): Promise<DoctorReport["enhancements"]> {
  const enhancementsPath = getCwPaths(root).enhancements;
  if (!(await exists(enhancementsPath))) {
    return { code_intelligence: null, external_context: null };
  }
  try {
    const config = await readJsonFile<EnhancementConfigRecord>(enhancementsPath);
    const status: NonNullable<DoctorReport["enhancements"]> = {
      code_intelligence: config.code_intelligence,
      external_context: config.external_context
    };
    if (config.code_index !== undefined) {
      status.code_index = config.code_index;
    }
    if (config.context_memory !== undefined) {
      status.context_memory = config.context_memory;
    }
    return status;
  } catch {
    return { code_intelligence: null, external_context: null };
  }
}

async function validateTaskArtifacts(
  root: string,
  taskId: string,
  state: TaskStateRecord,
  location: TaskLocation
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const taskRoot = taskDir(root, taskId, location);
  for (const artifactPath of Object.values(state.artifacts)) {
    if (artifactPath === null) {
      continue;
    }
    issues.push(...(await validateRequiredFile(path.join(taskRoot, artifactPath))));
  }
  return issues;
}

async function generatedAdapterWarnings(root: string): Promise<ValidationIssue[]> {
  const warnings: ValidationIssue[] = [];
  if (await exists(path.join(root, ".agents", "skills"))) {
    warnings.push(...(await generatedSkillWarnings(root, ".agents/skills")));
  }
  if (await exists(path.join(root, ".claude", "skills"))) {
    warnings.push(...(await generatedSkillWarnings(root, ".claude/skills")));
  }
  if (await exists(path.join(root, ".codex", "agents"))) {
    warnings.push(...(await generatedRoleAgentWarnings(root, "codex")));
  }
  if (await exists(path.join(root, ".claude", "agents"))) {
    warnings.push(...(await generatedRoleAgentWarnings(root, "claude")));
  }
  if (await exists(path.join(root, ".opencode", "agents"))) {
    warnings.push(...(await generatedRoleAgentWarnings(root, "opencode")));
  }
  if (await exists(path.join(root, ".pi", "agents"))) {
    warnings.push(...(await generatedRoleAgentWarnings(root, "pi")));
  }
  if (await exists(path.join(root, ".cursor", "agents"))) {
    warnings.push(...(await generatedRoleAgentWarnings(root, "cursor")));
  }
  return warnings;
}

async function generatedSkillWarnings(root: string, skillsPath: ".agents/skills" | ".claude/skills"): Promise<ValidationIssue[]> {
  const warnings: ValidationIssue[] = [];
  for (const command of AGENT_COMMANDS) {
    const filePath = path.join(root, skillsPath, command, "SKILL.md");
    const displayPath = `${skillsPath}/${command}/SKILL.md`;
    if (!(await exists(filePath))) {
      warnings.push({ path: displayPath, message: "generated skill entry is missing" });
      continue;
    }
    const content = await readFile(filePath, "utf8");
    if (!isGeneratedSkillCurrent(command, content, skillsPath)) {
      warnings.push({ path: displayPath, message: "generated skill entry appears stale" });
    }
  }
  return warnings;
}

async function generatedRoleAgentWarnings(
  root: string,
  harness: "codex" | "claude" | "opencode" | "pi" | "cursor"
): Promise<ValidationIssue[]> {
  const warnings: ValidationIssue[] = [];
  for (const expected of await expectedGeneratedRoleAgentsForRoot(root, harness)) {
    const filePath = path.join(root, expected.path);
    if (!(await exists(filePath))) {
      warnings.push({ path: expected.path, message: "generated role agent is missing" });
      continue;
    }
    const content = await readFile(filePath, "utf8");
    if (content !== expected.content) {
      warnings.push({ path: expected.path, message: "generated role agent appears stale" });
    }
  }
  return warnings;
}

async function validateTraceJsonl(root: string, taskId: string, filePath: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const text = await readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const [index, line] of lines.entries()) {
    try {
      const value = JSON.parse(line) as unknown;
      if (!isTraceEventShape(value)) {
        issues.push({ path: `.cw/tasks/${taskId}/trace.jsonl:${index + 1}`, message: "trace event must include ts, type, and summary strings" });
      }
    } catch (error) {
      issues.push({ path: `.cw/tasks/${taskId}/trace.jsonl:${index + 1}`, message: formatError(error) });
    }
  }
  return issues;
}

async function validateRequiredFile(filePath: string): Promise<ValidationIssue[]> {
  if (await exists(filePath)) {
    return [];
  }
  return [{ path: filePath, message: "missing required file" }];
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isTraceEventShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.ts === "string" && typeof record.type === "string" && typeof record.summary === "string";
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
