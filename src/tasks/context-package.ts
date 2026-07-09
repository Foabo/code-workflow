import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getFlowflowPaths } from "../project/index.js";
import { readJsonFile } from "../shared/index.js";
import { TaskStateRecord, TraceEvent } from "../domain/index.js";
import { readTaskState } from "./lifecycle.js";
import { taskDir } from "./paths.js";

const execFileAsync = promisify(execFile);
const PROJECT_BASELINE_FILES = ["overview.md", "architecture.md", "rules.md", "commands.md"] as const;
const TASK_INPUT_FILES = ["spec.md", "plan.md", "task.md", "trace.jsonl", "task.json"] as const;
const CONTEXT_PACKAGE_GENERATOR_VERSION = 1;

export type ContextPackageStatus = "created" | "current" | "refreshed";
export type ContextPackageDiffCategory = "included" | "excluded" | "uncertain";

export type ContextPackageManifest = {
  schema_version: 1;
  generator_version: number;
  task_id: string;
  package_path: string;
  manifest_path: string;
  generated_at: string;
  status: ContextPackageStatus;
  inputs: {
    files: ContextPackageFileFingerprint[];
    git_status: string[];
    git_status_hash: string;
    diff_hash: string;
  };
  diff: Record<ContextPackageDiffCategory, ContextPackageDiffEntry[]>;
  metrics: ContextPackageMetrics;
};

export type ContextPackageFileFingerprint = {
  path: string;
  sha256: string | null;
  bytes: number;
  missing: boolean;
};

export type ContextPackageDiffEntry = {
  status: string;
  path: string;
  reason: string;
};

export type ContextPackageMetrics = {
  package_bytes: number;
  role_handoff_raw_bytes: number;
  role_handoff_savings_percent: number;
  review_check_raw_bytes: number;
  review_check_savings_percent: number;
};

export type RefreshContextPackageResult = {
  ok: true;
  status: ContextPackageStatus;
  stale: boolean;
  package_path: string;
  manifest_path: string;
  metrics: ContextPackageMetrics;
  diff: Record<ContextPackageDiffCategory, ContextPackageDiffEntry[]>;
};

type PackageDraft = {
  markdown: string;
  manifest: ContextPackageManifest;
};
type ContextPackageGitStatus =
  | { kind: "clean" }
  | { kind: "dirty"; entries: string[] }
  | { kind: "not-git-repository" };

export function contextPackagePath(root: string, taskId: string): string {
  return path.join(taskDir(root, taskId), "context-package.md");
}

export function contextPackageManifestPath(root: string, taskId: string): string {
  return path.join(taskDir(root, taskId), "context-package.manifest.json");
}

export async function refreshContextPackage(root: string, taskId: string, now = new Date()): Promise<RefreshContextPackageResult> {
  const draft = await buildContextPackageDraft(root, taskId, now);
  const packagePath = contextPackagePath(root, taskId);
  const manifestPath = contextPackageManifestPath(root, taskId);
  const existing = await readExistingManifest(manifestPath);
  const existingPackagePresent = await exists(packagePath);
  const stale = existing === null || !existingPackagePresent || inputSignature(existing) !== inputSignature(draft.manifest);
  const status: ContextPackageStatus = existing === null || !existingPackagePresent ? "created" : stale ? "refreshed" : "current";
  const manifest: ContextPackageManifest = stale || existing === null ? {
    ...draft.manifest,
    status
  } : {
    ...existing,
    status
  };

  if (stale) {
    await writeFile(packagePath, draft.markdown, "utf8");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  } else if (existing !== null && existing.status !== status) {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  return {
    ok: true,
    status,
    stale,
    package_path: relativeToRoot(root, packagePath),
    manifest_path: relativeToRoot(root, manifestPath),
    metrics: manifest.metrics,
    diff: manifest.diff
  };
}

async function buildContextPackageDraft(root: string, taskId: string, now: Date): Promise<PackageDraft> {
  const state = await readTaskState(root, taskId);
  const dir = taskDir(root, taskId);
  const packagePath = contextPackagePath(root, taskId);
  const manifestPath = contextPackageManifestPath(root, taskId);
  const files = await fingerprintInputs(root, taskId);
  const taskFiles = await readTaskFiles(dir, state);
  const traceEvents = parseTrace(taskFiles.trace);
  const projectBaseline = await readProjectBaseline(root);
  const gitStatus = await normalizeGitStatusForGeneratedOutputs(
    root,
    taskId,
    await getDetailedGitStatus(root),
    [packagePath, manifestPath]
  );
  const gitEntries = gitStatus.kind === "dirty" ? gitStatus.entries : [];
  const diff = categorizeGitEntries(taskId, gitEntries);
  const diffText = stripGeneratedPackageDiff(taskId, await readDiffText(root));
  const gitEntriesForFingerprint = gitEntries.filter((entry) => !isGeneratedPackageStatusEntry(taskId, entry));
  const markdownWithoutMetrics = renderContextPackage({
    state,
    taskFiles,
    traceEvents,
    projectBaseline,
    gitStatusText: renderGitStatus(gitStatus),
    diff,
    metrics: null
  });
  const rawBytes = rawInputBytes(files);
  const reviewRawBytes = rawBytes + Buffer.byteLength(diffText, "utf8") + Buffer.byteLength(JSON.stringify(gitStatus), "utf8");
  const packageBytesWithoutMetrics = Buffer.byteLength(markdownWithoutMetrics, "utf8");
  const metrics = {
    package_bytes: packageBytesWithoutMetrics,
    role_handoff_raw_bytes: rawBytes,
    role_handoff_savings_percent: savingsPercent(rawBytes, packageBytesWithoutMetrics),
    review_check_raw_bytes: reviewRawBytes,
    review_check_savings_percent: savingsPercent(reviewRawBytes, packageBytesWithoutMetrics)
  };
  const markdown = renderContextPackage({
    state,
    taskFiles,
    traceEvents,
    projectBaseline,
    gitStatusText: renderGitStatus(gitStatus),
    diff,
    metrics
  });
  const packageBytes = Buffer.byteLength(markdown, "utf8");
  const finalMetrics = {
    ...metrics,
    package_bytes: packageBytes,
    role_handoff_savings_percent: savingsPercent(rawBytes, packageBytes),
    review_check_savings_percent: savingsPercent(reviewRawBytes, packageBytes)
  };

  return {
    markdown: renderContextPackage({
      state,
      taskFiles,
      traceEvents,
      projectBaseline,
      gitStatusText: renderGitStatus(gitStatus),
      diff,
      metrics: finalMetrics
    }),
    manifest: {
      schema_version: 1,
      generator_version: CONTEXT_PACKAGE_GENERATOR_VERSION,
      task_id: taskId,
      package_path: relativeToRoot(root, packagePath),
      manifest_path: relativeToRoot(root, manifestPath),
      generated_at: now.toISOString(),
      status: "created",
      inputs: {
        files,
        git_status: gitEntries,
        git_status_hash: sha256(JSON.stringify({ kind: gitStatus.kind, entries: gitEntriesForFingerprint })),
        diff_hash: sha256(diffText)
      },
      diff,
      metrics: finalMetrics
    }
  };
}

async function fingerprintInputs(root: string, taskId: string): Promise<ContextPackageFileFingerprint[]> {
  const dir = taskDir(root, taskId);
  const paths = getFlowflowPaths(root);
  const taskInputs = TASK_INPUT_FILES.map((fileName) => path.join(dir, fileName));
  const baselineInputs = PROJECT_BASELINE_FILES.map((fileName) => path.join(paths.project, fileName));
  return Promise.all([...taskInputs, ...baselineInputs].map((filePath) => fingerprintFile(root, filePath)));
}

async function fingerprintFile(root: string, filePath: string): Promise<ContextPackageFileFingerprint> {
  try {
    const content = await readFile(filePath);
    return {
      path: relativeToRoot(root, filePath),
      sha256: sha256(content),
      bytes: content.byteLength,
      missing: false
    };
  } catch {
    return {
      path: relativeToRoot(root, filePath),
      sha256: null,
      bytes: 0,
      missing: true
    };
  }
}

async function readTaskFiles(dir: string, state: TaskStateRecord): Promise<{ spec: string; plan: string; task: string; trace: string }> {
  return {
    spec: await readFile(path.join(dir, state.artifacts.spec), "utf8"),
    plan: await readFile(path.join(dir, state.artifacts.plan), "utf8"),
    task: await readFile(path.join(dir, state.artifacts.task), "utf8"),
    trace: await readFile(path.join(dir, "trace.jsonl"), "utf8")
  };
}

async function readProjectBaseline(root: string): Promise<Record<(typeof PROJECT_BASELINE_FILES)[number], string>> {
  const paths = getFlowflowPaths(root);
  const entries = await Promise.all(
    PROJECT_BASELINE_FILES.map(async (fileName) => {
      const filePath = path.join(paths.project, fileName);
      return [fileName, await readFile(filePath, "utf8")] as const;
    })
  );
  return Object.fromEntries(entries) as Record<(typeof PROJECT_BASELINE_FILES)[number], string>;
}

function renderContextPackage(input: {
  state: TaskStateRecord;
  taskFiles: { spec: string; plan: string; task: string; trace: string };
  traceEvents: TraceEvent[];
  projectBaseline: Record<(typeof PROJECT_BASELINE_FILES)[number], string>;
  gitStatusText: string;
  diff: Record<ContextPackageDiffCategory, ContextPackageDiffEntry[]>;
  metrics: ContextPackageMetrics | null;
}): string {
  const acceptance = extractChecklistItems(section(input.taskFiles.spec, "Acceptance Criteria"));
  const decisions = section(input.taskFiles.spec, "Decisions");
  const constraints = section(input.taskFiles.spec, "Constraints");
  const recentTrace = input.traceEvents.slice(-8);
  return `# Context Package

## Task Brief

- Task: ${input.state.id}
- Title: ${input.state.title}
- Lifecycle: ${input.state.lifecycle}
- Phase: ${input.state.phase}
- Next action: ${input.state.next_action}
- Proposal identity: ${latestProposalIdentityFromTrace(input.traceEvents) ?? "none found"}

## Contract Summary

### Goal

${compact(section(input.taskFiles.spec, "Goal"))}

### Scope

${compact(section(input.taskFiles.spec, "Scope"))}

### Non-goals

${compact(section(input.taskFiles.spec, "Non-goals"))}

### Constraints

${compact(constraints)}

### Decisions

${compact(decisions)}

### Acceptance Criteria

${acceptance.length === 0 ? "- No acceptance criteria found; read spec.md before proceeding." : acceptance.map((item) => `- ${item}`).join("\n")}

## Implementation State

### Plan Summary

${compact(section(input.taskFiles.plan, "Approach"))}

### Remaining Task Items

${extractUncheckedItems(input.taskFiles.task).map((item) => `- ${item}`).join("\n") || "- No unchecked task items found."}

## Project Baseline Summary

${PROJECT_BASELINE_FILES.map((fileName) => `### ${fileName}\n\n${compact(input.projectBaseline[fileName])}`).join("\n\n")}

## Recent Trace

${recentTrace.length === 0 ? "- No trace events found." : recentTrace.map((event) => `- ${event.ts} ${event.type}: ${event.summary}`).join("\n")}

## Git Status

\`\`\`text
${input.gitStatusText}
\`\`\`

## Diff Classification

### Included

${renderDiffEntries(input.diff.included)}

### Excluded Or Unrelated

${renderDiffEntries(input.diff.excluded)}

### Uncertain

${renderDiffEntries(input.diff.uncertain)}

${input.diff.uncertain.length > 0 ? "Uncertain entries require reading the original git status and diff before making a verdict.\n" : ""}
## Review And Check Instructions

- Do not give a spec verdict from diff summary alone.
- Compare diff, task brief, accepted spec, acceptance criteria, and verification evidence together.
- If this package is missing required sections, stale, or has uncertain diff entries, read the original .ff files and git information before deciding.
- Clarify/advisor review must use the current spec.md and proposal identity; this package is only navigation material.

## Metrics

${input.metrics === null ? "- Metrics are computed after package rendering." : renderMetrics(input.metrics)}
`;
}

function renderMetrics(metrics: ContextPackageMetrics): string {
  return [
    `- Package bytes: ${metrics.package_bytes}`,
    `- Role handoff raw bytes: ${metrics.role_handoff_raw_bytes}`,
    `- Role handoff savings percent: ${metrics.role_handoff_savings_percent}`,
    `- Review/check raw bytes: ${metrics.review_check_raw_bytes}`,
    `- Review/check savings percent: ${metrics.review_check_savings_percent}`
  ].join("\n");
}

function renderDiffEntries(entries: ContextPackageDiffEntry[]): string {
  if (entries.length === 0) {
    return "- None.";
  }
  const uniqueReasons = [...new Set(entries.map((entry) => entry.reason))];
  const reasonLines = uniqueReasons.length === 1
    ? [`- Rule: ${uniqueReasons[0]}`]
    : uniqueReasons.map((reason) => `- Rule: ${reason}`);
  return [...reasonLines, ...entries.map((entry) => `- ${entry.status} ${entry.path}`)].join("\n");
}

function categorizeGitEntries(taskId: string, entries: string[]): Record<ContextPackageDiffCategory, ContextPackageDiffEntry[]> {
  const result: Record<ContextPackageDiffCategory, ContextPackageDiffEntry[]> = {
    included: [],
    excluded: [],
    uncertain: []
  };
  for (const entry of entries) {
    const parsed = parseGitStatusEntry(entry);
    if (isCurrentTaskPath(taskId, parsed.path)) {
      result.included.push({ ...parsed, reason: "current task artifact or generated package" });
    } else if (parsed.path.startsWith(".ff/tasks/")) {
      result.excluded.push({ ...parsed, reason: "different Flowflow task path" });
    } else {
      result.uncertain.push({ ...parsed, reason: "outside the current task path; read original git diff before verdict" });
    }
  }
  return result;
}

function isCurrentTaskPath(taskId: string, filePath: string): boolean {
  return filePath === `.ff/tasks/${taskId}` || filePath.startsWith(`.ff/tasks/${taskId}/`);
}

function isGeneratedPackageStatusEntry(taskId: string, entry: string): boolean {
  const parsed = parseGitStatusEntry(entry);
  return parsed.path === `.ff/tasks/${taskId}/context-package.md` ||
    parsed.path === `.ff/tasks/${taskId}/context-package.manifest.json`;
}

function parseGitStatusEntry(entry: string): { status: string; path: string } {
  const status = entry.slice(0, 2).trim() || entry.slice(0, 2);
  const rawPath = entry.slice(3).trim();
  const renameParts = rawPath.split(" -> ");
  return { status, path: renameParts.at(-1) ?? rawPath };
}

async function getDetailedGitStatus(root: string): Promise<ContextPackageGitStatus> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain", "-uall"], { cwd: root });
    const entries = stdout.split(/\r?\n/).filter(Boolean);
    return entries.length === 0 ? { kind: "clean" } : { kind: "dirty", entries };
  } catch {
    return { kind: "not-git-repository" };
  }
}

async function normalizeGitStatusForGeneratedOutputs(
  root: string,
  taskId: string,
  status: ContextPackageGitStatus,
  outputPaths: string[]
): Promise<ContextPackageGitStatus> {
  if (status.kind === "not-git-repository") {
    return status;
  }

  const entries = status.kind === "dirty" ? [...status.entries] : [];
  const seenPaths = new Set(entries.map((entry) => parseGitStatusEntry(entry).path));
  for (const outputPath of outputPaths) {
    const relativePath = relativeToRoot(root, outputPath);
    if (seenPaths.has(relativePath) || await exists(outputPath)) {
      continue;
    }
    entries.push(`?? ${relativePath}`);
    seenPaths.add(relativePath);
  }

  if (entries.length === 0) {
    return { kind: "clean" };
  }

  return { kind: "dirty", entries: sortGitStatusEntries(entries) };
}

function sortGitStatusEntries(entries: string[]): string[] {
  return [...entries].sort((left, right) => {
    const leftPath = parseGitStatusEntry(left).path;
    const rightPath = parseGitStatusEntry(right).path;
    return leftPath.localeCompare(rightPath);
  });
}

async function readDiffText(root: string): Promise<string> {
  const parts = await Promise.all([
    gitOutput(root, ["diff", "--stat"]),
    gitOutput(root, ["diff", "--cached", "--stat"])
  ]);
  return parts.join("\n");
}

function stripGeneratedPackageDiff(taskId: string, diffText: string): string {
  return diffText
    .split(/\r?\n/)
    .filter((line) => !line.includes(`.ff/tasks/${taskId}/context-package.md`))
    .filter((line) => !line.includes(`.ff/tasks/${taskId}/context-package.manifest.json`))
    .join("\n");
}

async function gitOutput(root: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: root });
    return stdout;
  } catch {
    return "";
  }
}

function parseTrace(text: string): TraceEvent[] {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TraceEvent);
}

function latestProposalIdentityFromTrace(events: TraceEvent[]): string | null {
  for (const event of [...events].reverse()) {
    if (event.type !== "spec.proposed" || event.data === undefined) {
      continue;
    }
    const proposalId = event.data.proposal_id;
    const proposalHash = event.data.proposal_hash;
    if (typeof proposalId === "string" && typeof proposalHash === "string") {
      return `${proposalId} / ${proposalHash}`;
    }
  }
  return null;
}

function extractUncheckedItems(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^- \[ \]/.test(line))
    .map((line) => line.replace(/^- \[ \]\s*/, "").trim());
}

function extractChecklistItems(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^- \[[ xX]\]/.test(line))
    .map((line) => line.replace(/^- \[[ xX]\]\s*/, "").trim());
}

function section(markdown: string, title: string): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start === -1) {
    return "";
  }
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
}

function compact(markdown: string): string {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
  const text = lines.join("\n");
  if (text.length <= 1200) {
    return text || "No content found; read the source artifact before proceeding.";
  }
  return `${text.slice(0, 1200).trimEnd()}\n...`;
}

function rawInputBytes(files: ContextPackageFileFingerprint[]): number {
  return files.reduce((sum, file) => sum + file.bytes, 0);
}

function savingsPercent(rawBytes: number, packageBytes: number): number {
  if (rawBytes <= 0) {
    return 0;
  }
  return Number((((rawBytes - packageBytes) / rawBytes) * 100).toFixed(2));
}

function renderGitStatus(status: ContextPackageGitStatus): string {
  if (status.kind === "clean") {
    return "clean";
  }
  if (status.kind === "not-git-repository") {
    return "not-git-repository";
  }
  return status.entries.join("\n");
}

async function readExistingManifest(filePath: string): Promise<ContextPackageManifest | null> {
  try {
    return await readJsonFile<ContextPackageManifest>(filePath);
  } catch {
    return null;
  }
}

function inputSignature(manifest: ContextPackageManifest): string {
  return sha256(JSON.stringify({
    generator_version: manifest.generator_version,
    files: manifest.inputs.files,
    git_status_hash: manifest.inputs.git_status_hash,
    diff_hash: manifest.inputs.diff_hash
  }));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function relativeToRoot(root: string, filePath: string): string {
  return path.relative(root, filePath);
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
