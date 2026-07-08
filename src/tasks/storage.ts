import { access, appendFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "../shared/index.js";
import { readJsonFile, writeJsonFile } from "../shared/index.js";
import { getFlowflowPaths, TASK_ARCHIVE_DIR_NAME } from "../project/paths.js";
import { TaskLocation, taskDir, taskJsonPath, tracePath } from "./paths.js";
import { assertTaskStateRecord } from "../domain/index.js";
import { TaskStateRecord, TraceEvent } from "../domain/index.js";

export type TaskListScope = TaskLocation | "all";

export type TaskDirectoryEntry = {
  id: string;
  location: TaskLocation;
  dir: string;
};

export type TaskReferenceResolution = {
  id: string;
  location: TaskLocation;
};

export type LegacyTaskMigration = {
  from: string;
  to: string;
  from_location: TaskLocation;
  to_location: TaskLocation;
};

export type LegacyTaskMigrationResult = {
  migrated: LegacyTaskMigration[];
};

export async function listTaskDirectoryEntries(root: string, scope: TaskListScope = "active"): Promise<TaskDirectoryEntry[]> {
  const entries: TaskDirectoryEntry[] = [];
  if (scope === "active" || scope === "all") {
    entries.push(...(await listTaskDirectoryEntriesForLocation(root, "active")));
  }
  if (scope === "archived" || scope === "all") {
    entries.push(...(await listTaskDirectoryEntriesForLocation(root, "archived")));
  }
  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

export async function listTaskIds(root: string, scope: TaskListScope = "active"): Promise<string[]> {
  return (await listTaskDirectoryEntries(root, scope)).map((entry) => entry.id);
}

export async function allocateTaskId(root: string, title: string): Promise<string> {
  const used = await usedNumericPrefixes(root);
  let next = Math.max(0, ...used) + 1;
  while (used.has(next)) {
    next += 1;
  }
  return formatTaskId(next, title);
}

export function formatTaskId(number: number, title: string): string {
  return `${number.toString().padStart(4, "0")}-${slugifyTaskTitle(title)}`;
}

export function isFullNumericTaskId(taskId: string): boolean {
  return /^\d{4}-[a-z0-9][a-z0-9-]*$/.test(taskId);
}

export function isShortNumericTaskReference(reference: string): boolean {
  return /^\d{4}$/.test(reference);
}

export function slugifyTaskTitle(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug.length > 0 ? slug : "task";
}

export async function resolveTaskReference(
  root: string,
  reference: string,
  scope: TaskListScope = "active"
): Promise<TaskReferenceResolution> {
  if (isShortNumericTaskReference(reference)) {
    return resolveShortTaskReference(root, reference, scope);
  }

  const matches = (await listTaskDirectoryEntries(root, scope)).filter((entry) => entry.id === reference);
  if (matches.length === 1) {
    return { id: matches[0].id, location: matches[0].location };
  }
  if (matches.length > 1) {
    throw new Error(`task reference ${reference} is ambiguous: ${matches.map((entry) => entry.id).join(", ")}`);
  }

  if (scope === "active") {
    const archived = (await listTaskDirectoryEntries(root, "archived")).find((entry) => entry.id === reference);
    if (archived !== undefined) {
      throw new Error(`task ${reference} is archived`);
    }
  }

  throw new Error(`no task found for reference ${reference}`);
}

export async function migrateLegacyTaskIds(root: string, now = new Date()): Promise<LegacyTaskMigrationResult> {
  const allEntries = await listTaskDirectoryEntries(root, "all");
  const legacyTasks = [];
  for (const entry of allEntries) {
    if (!entry.id.startsWith("task-")) {
      continue;
    }
    const state = await readTaskStateAt(root, entry.id, entry.location);
    legacyTasks.push({ entry, state });
  }

  legacyTasks.sort((left, right) => {
    const byCreated = left.state.created_at.localeCompare(right.state.created_at);
    return byCreated !== 0 ? byCreated : left.entry.id.localeCompare(right.entry.id);
  });

  const used = await usedNumericPrefixes(root);
  let nextNumber = Math.max(0, ...used) + 1;
  const migrated: LegacyTaskMigration[] = [];
  const ts = now.toISOString();

  for (const { entry, state } of legacyTasks) {
    while (used.has(nextNumber)) {
      nextNumber += 1;
    }
    const nextId = formatTaskId(nextNumber, state.title);
    used.add(nextNumber);
    nextNumber += 1;

    const toLocation: TaskLocation = state.lifecycle === "closed" ? "archived" : "active";
    const fromJsonPath = taskJsonPath(root, entry.id, entry.location);
    const fromTracePath = tracePath(root, entry.id, entry.location);
    const toDir = taskDir(root, nextId, toLocation);
    if (await exists(toDir)) {
      throw new Error(`cannot migrate ${entry.id}; target task already exists: ${nextId}`);
    }

    await writeJsonFile(fromJsonPath, { ...state, id: nextId, updated_at: ts });
    const event: TraceEvent = {
      ts,
      type: "task.migrated",
      summary: `Task id migrated from ${entry.id} to ${nextId}.`,
      data: { from: entry.id, to: nextId }
    };
    await appendFile(fromTracePath, `${JSON.stringify(event)}\n`, "utf8");

    await ensureDir(path.dirname(toDir));
    await rename(entry.dir, toDir);
    migrated.push({ from: entry.id, to: nextId, from_location: entry.location, to_location: toLocation });
  }

  return { migrated };
}

async function resolveShortTaskReference(
  root: string,
  reference: string,
  scope: TaskListScope
): Promise<TaskReferenceResolution> {
  const matches = (await listTaskDirectoryEntries(root, scope)).filter((entry) => entry.id.startsWith(`${reference}-`));
  if (matches.length === 1) {
    return { id: matches[0].id, location: matches[0].location };
  }
  if (matches.length > 1) {
    throw new Error(`task reference ${reference} is ambiguous: ${matches.map((entry) => entry.id).join(", ")}`);
  }

  if (scope === "active") {
    const archivedMatches = (await listTaskDirectoryEntries(root, "archived")).filter((entry) => entry.id.startsWith(`${reference}-`));
    if (archivedMatches.length > 0) {
      throw new Error(`task ${reference} is archived`);
    }
  }

  throw new Error(`no task found for reference ${reference}`);
}

async function listTaskDirectoryEntriesForLocation(root: string, location: TaskLocation): Promise<TaskDirectoryEntry[]> {
  const paths = getFlowflowPaths(root);
  const rootDir = location === "active" ? paths.tasks : paths.tasksArchive;
  if (!(await exists(rootDir))) {
    return [];
  }

  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => location === "archived" || entry.name !== TASK_ARCHIVE_DIR_NAME)
    .map((entry) => ({
      id: entry.name,
      location,
      dir: path.join(rootDir, entry.name)
    }));
}

async function usedNumericPrefixes(root: string): Promise<Set<number>> {
  const used = new Set<number>();
  for (const taskId of await listTaskIds(root, "all")) {
    const match = /^(\d{4})-/.exec(taskId);
    if (match !== null) {
      used.add(Number(match[1]));
    }
  }
  return used;
}

async function readTaskStateAt(root: string, taskId: string, location: TaskLocation): Promise<TaskStateRecord> {
  const state = await readJsonFile<unknown>(taskJsonPath(root, taskId, location));
  assertTaskStateRecord(state, taskJsonDisplayPath(taskId, location));
  return state;
}

function taskJsonDisplayPath(taskId: string, location: TaskLocation): string {
  return location === "archived" ? `.ff/tasks/archived/${taskId}/task.json` : `.ff/tasks/${taskId}/task.json`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
