import path from "node:path";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { appendTrace, readTaskState } from "./tasks.js";
import { getCwPaths, taskDir, taskJsonPath } from "./paths.js";
import { TASK_ARTIFACT_TEMPLATES } from "./templates.js";
import { writeJsonFile } from "./json.js";
import { TaskStateRecord } from "./types.js";

const baselineFiles = ["overview.md", "architecture.md", "rules.md", "commands.md"] as const;

export type BaselineDecision = "accepted" | "edited" | "skipped";

export type BaselineSyncResult = {
  decision: BaselineDecision;
  updated: string[];
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
  now = new Date()
): Promise<BaselineSyncResult> {
  const state = await readTaskState(root, taskId);
  if (state.artifacts.baseline_delta === null) {
    return { decision, updated: [] };
  }
  if (decision === "skipped") {
    await appendTrace(root, taskId, {
      ts: now.toISOString(),
      type: "baseline_delta.skipped",
      summary: "Baseline delta skipped."
    });
    return { decision, updated: [] };
  }

  const deltaPath = path.join(taskDir(root, taskId), state.artifacts.baseline_delta);
  const delta = await readFile(deltaPath, "utf8");
  const sections = parseBaselineDelta(delta);
  const updated: string[] = [];

  for (const fileName of baselineFiles) {
    const content = sections[fileName]?.trim();
    if (content === undefined || content.length === 0) {
      continue;
    }
    const projectFile = path.join(getCwPaths(root).project, fileName);
    await appendFile(projectFile, `\n## From ${taskId}\n\n${content}\n`, "utf8");
    updated.push(`.cw/project/${fileName}`);
  }

  await appendTrace(root, taskId, {
    ts: now.toISOString(),
    type: "baseline_delta.synced",
    summary: updated.length > 0 ? `Baseline delta synced to ${updated.join(", ")}.` : "Baseline delta had no content to sync.",
    data: { decision, updated }
  });

  return { decision, updated };
}

function parseBaselineDelta(markdown: string): Partial<Record<(typeof baselineFiles)[number], string>> {
  const sections: Partial<Record<(typeof baselineFiles)[number], string>> = {};
  const lines = markdown.split(/\r?\n/);
  let current: (typeof baselineFiles)[number] | null = null;
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
      current = match[1] as (typeof baselineFiles)[number];
      continue;
    }
    if (current !== null) {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}
