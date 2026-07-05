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

  if (decision === "edited" && (normalized.editedMarkdown === undefined || normalized.editedMarkdown.trim().length === 0)) {
    throw new Error("edited baseline sync requires confirmed current-state content");
  }
  if (decision === "selected" && (normalized.selectedFiles === undefined || normalized.selectedFiles.length === 0)) {
    throw new Error("selected baseline sync requires at least one selected baseline file");
  }

  const confirmed = await previewBaselineMerge(root, taskId, {
    selectedFiles: normalized.selectedFiles,
    editedMarkdown: normalized.editedMarkdown
  });
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

export async function previewBaselineMerge(
  root: string,
  taskId: string,
  options: Pick<BaselineSyncOptions, "selectedFiles" | "editedMarkdown"> = {}
): Promise<{ sections: Partial<Record<BaselineFile, string>>; highImpact: boolean }> {
  if (options.editedMarkdown !== undefined) {
    return previewBaselineDelta(root, taskId, options.editedMarkdown);
  }

  const preview = await previewBaselineDelta(root, taskId);
  const selected = options.selectedFiles === undefined ? null : new Set(options.selectedFiles);
  const merged: Partial<Record<BaselineFile, string>> = {};

  for (const fileName of baselineFiles) {
    if (selected !== null && !selected.has(fileName)) {
      continue;
    }
    const delta = preview.sections[fileName]?.trim();
    if (delta === undefined || delta.length === 0) {
      continue;
    }
    const currentPath = path.join(getCwPaths(root).project, fileName);
    const current = await readFile(currentPath, "utf8");
    merged[fileName] = mergeBaselineMarkdown(current, delta);
  }

  return { sections: merged, highImpact: preview.highImpact };
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
  const sections = parseBaselineDelta(delta);
  return {
    sections,
    highImpact: isHighImpactDelta(sections)
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

function mergeBaselineMarkdown(currentMarkdown: string, deltaMarkdown: string): string {
  const current = currentMarkdown.trim();
  const delta = stripLeadingTitle(deltaMarkdown.trim());
  if (delta.length === 0) {
    return current;
  }

  const sections = splitH2Sections(delta);
  if (sections.length === 0) {
    return appendBlock(current, delta);
  }

  let merged = current;
  for (const section of sections) {
    merged = mergeH2Section(merged, section.heading, section.body);
  }
  return merged.trim();
}

function stripLeadingTitle(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const firstContent = lines.findIndex((line) => line.trim().length > 0);
  if (firstContent === -1 || !/^#\s+/.test(lines[firstContent])) {
    return markdown;
  }
  lines.splice(firstContent, 1);
  while (lines[firstContent]?.trim() === "") {
    lines.splice(firstContent, 1);
  }
  return lines.join("\n").trim();
}

function splitH2Sections(markdown: string): Array<{ heading: string; body: string }> {
  const lines = markdown.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let heading: string | null = null;
  let body: string[] = [];

  function flush(): void {
    if (heading !== null) {
      sections.push({ heading, body: body.join("\n").trim() });
    }
    body = [];
  }

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      flush();
      heading = line.trim();
      continue;
    }
    if (heading !== null) {
      body.push(line);
    }
  }
  flush();

  return sections;
}

function mergeH2Section(currentMarkdown: string, heading: string, body: string): string {
  const bodyToInsert = body.trim();
  if (bodyToInsert.length === 0) {
    return currentMarkdown.trim();
  }

  const lines = currentMarkdown.trim().split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    return appendBlock(currentMarkdown, `${heading}\n\n${bodyToInsert}`);
  }

  let nextHeadingIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      nextHeadingIndex = index;
      break;
    }
  }

  const existingBody = lines.slice(headingIndex + 1, nextHeadingIndex).join("\n");
  const addition = uniqueContentLines(existingBody, bodyToInsert);
  if (addition.length === 0) {
    return currentMarkdown.trim();
  }

  const before = lines.slice(0, nextHeadingIndex);
  const after = lines.slice(nextHeadingIndex);
  const spacer = existingBody.trim().length === 0 ? [""] : ["", ""];
  const afterSpacer = after.length > 0 ? [""] : [];
  return [...before, ...spacer, addition, ...afterSpacer, ...after].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function uniqueContentLines(existing: string, incoming: string): string {
  const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  return incoming
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0 && !existingLines.has(line.trim()))
    .join("\n")
    .trim();
}

function appendBlock(currentMarkdown: string, block: string): string {
  const current = currentMarkdown.trim();
  const addition = block.trim();
  if (current.length === 0 || current.includes(addition)) {
    return current.length === 0 ? addition : current;
  }
  return `${current}\n\n${addition}`.trim();
}

function isHighImpactDelta(sections: Partial<Record<BaselineFile, string>>): boolean {
  return Object.values(sections).some((content) =>
    /\b(architecture|capability|delete|remove|conflict|breaking|low confidence)\b/i.test(content ?? "")
  );
}
