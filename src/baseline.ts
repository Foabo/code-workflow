import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { appendTrace, readTaskState } from "./tasks.js";
import { getCwPaths, taskDir, taskJsonPath } from "./paths.js";
import { TASK_ARTIFACT_TEMPLATES } from "./templates.js";
import { writeJsonFile } from "./json.js";
import { BaselineDecision, TaskStateRecord } from "./types.js";

const baselineFiles = ["overview.md", "architecture.md", "rules.md", "commands.md"] as const;

export type { BaselineDecision } from "./types.js";

export type BaselineFile = (typeof baselineFiles)[number];

export type BaselineSyncOptions = {
  selectedFiles?: BaselineFile[];
  editedMarkdown?: string;
  now?: Date;
};

export type BaselineSyncResult = {
  decision: BaselineDecision;
  updated: string[];
  preview: Partial<Record<BaselineFile, string>>;
  highImpact: boolean;
};

export async function ensureBaselineDelta(root: string, taskId: string, now = new Date()): Promise<TaskStateRecord> {
  const state = await readTaskState(root, taskId);
  if (state.artifacts.baseline_delta !== null) {
    return state;
  }

  const next: TaskStateRecord = {
    ...state,
    artifacts: { ...state.artifacts, baseline_delta: "baseline-delta.md" },
    updated_at: now.toISOString()
  };
  await writeFile(path.join(taskDir(root, taskId), "baseline-delta.md"), TASK_ARTIFACT_TEMPLATES["baseline-delta.md"], "utf8");
  await writeJsonFile(taskJsonPath(root, taskId), next);
  await appendTrace(root, taskId, {
    ts: next.updated_at,
    type: "baseline_delta.created",
    summary: "Baseline delta created."
  });
  return next;
}

export async function syncBaselineDelta(
  root: string,
  taskId: string,
  decision: BaselineDecision,
  options: BaselineSyncOptions | Date = {}
): Promise<BaselineSyncResult> {
  const normalized = normalizeSyncOptions(options);
  const now = normalized.now;
  const state = await readTaskState(root, taskId);
  if (state.artifacts.baseline_delta === null) {
    return { decision, updated: [], preview: {}, highImpact: false };
  }

  const preview = await previewBaselineDelta(root, taskId, normalized.editedMarkdown);

  if (decision === "skipped") {
    await appendTrace(root, taskId, {
      ts: now.toISOString(),
      type: "baseline_delta.skipped",
      summary: "Baseline delta skipped.",
      data: { decision }
    });
    return { decision, updated: [], preview: preview.sections, highImpact: preview.highImpact };
  }

  if (normalized.editedMarkdown === undefined || normalized.editedMarkdown.trim().length === 0) {
    throw new Error("baseline sync requires confirmed current-state content");
  }
  if (decision === "selected" && (normalized.selectedFiles === undefined || normalized.selectedFiles.length === 0)) {
    throw new Error("selected baseline sync requires at least one selected baseline file");
  }

  const confirmed = await previewBaselineDelta(root, taskId, normalized.editedMarkdown);
  const selected = decision === "selected" ? new Set(normalized.selectedFiles ?? []) : null;
  const updated: string[] = [];

  for (const fileName of baselineFiles) {
    if (selected !== null && !selected.has(fileName)) {
      continue;
    }
    const content = confirmed.sections[fileName]?.trim();
    if (content === undefined || content.length === 0) {
      continue;
    }
    const projectFile = path.join(getCwPaths(root).project, fileName);
    await writeFile(projectFile, `${content}\n`, "utf8");
    updated.push(`.cw/project/${fileName}`);
  }

  if (updated.length === 0) {
    throw new Error("baseline sync requires at least one confirmed baseline section");
  }

  await appendTrace(root, taskId, {
    ts: now.toISOString(),
    type: "baseline_delta.synced",
    summary: updated.length > 0 ? `Baseline delta synced to ${updated.join(", ")}.` : "Baseline delta had no content to sync.",
    data: {
      decision,
      updated,
      selected: normalized.selectedFiles ?? null,
      highImpact: confirmed.highImpact
    }
  });

  return { decision, updated, preview: confirmed.sections, highImpact: confirmed.highImpact };
}

export async function previewBaselineDelta(
  root: string,
  taskId: string,
  editedMarkdown?: string
): Promise<{ sections: Partial<Record<BaselineFile, string>>; highImpact: boolean }> {
  const state = await readTaskState(root, taskId);
  if (state.artifacts.baseline_delta === null) {
    return { sections: {}, highImpact: false };
  }
  const deltaPath = path.join(taskDir(root, taskId), state.artifacts.baseline_delta);
  const delta = editedMarkdown ?? await readFile(deltaPath, "utf8");
  return {
    sections: parseBaselineDelta(delta),
    highImpact: isHighImpactDelta(delta)
  };
}

function parseBaselineDelta(markdown: string): Partial<Record<BaselineFile, string>> {
  const sections: Partial<Record<BaselineFile, string>> = {};
  const lines = markdown.split(/\r?\n/);
  let current: BaselineFile | null = null;
  let buffer: string[] = [];

  function flush(): void {
    if (current !== null) {
      sections[current] = buffer.join("\n").trim();
    }
    buffer = [];
  }

  for (const line of lines) {
    const match = /^##\s+(overview\.md|architecture\.md|rules\.md|commands\.md)\s*$/.exec(line);
    if (match !== null) {
      flush();
      current = match[1] as BaselineFile;
      continue;
    }
    if (current !== null) {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

function normalizeSyncOptions(options: BaselineSyncOptions | Date): Required<Pick<BaselineSyncOptions, "now">> & BaselineSyncOptions {
  if (options instanceof Date) {
    return { now: options };
  }
  return { ...options, now: options.now ?? new Date() };
}

function isHighImpactDelta(markdown: string): boolean {
  return /\b(architecture|capability|delete|remove|conflict|breaking|low confidence)\b/i.test(markdown);
}
