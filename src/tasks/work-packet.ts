import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ValidationIssue } from "../domain/index.js";
import { getGitStatus } from "../shared/index.js";
import { appendTrace, readTaskState } from "./lifecycle.js";
import { taskDir } from "./paths.js";

const execFileAsync = promisify(execFile);

export const WORK_PACKET_ROLES = [
  "advisor",
  "planner",
  "implementer",
  "checker",
  "reviewer",
  "baseline-writer"
] as const;

export type WorkPacketRole = (typeof WORK_PACKET_ROLES)[number];
export type CodeDiscoveryStrategy = "graph" | "index" | "rg" | "file-list" | "direct-read" | "none";
export type CodeIndexProviderStatus = "configured" | "failed" | "skipped" | "unconfigured";
export type CodeIndexToolVisibility = "visible" | "missing" | "unknown";
export type CodeDiscoveryFallbackReason =
  | "call-failed"
  | "provider-failed"
  | "provider-skipped"
  | "provider-unconfigured"
  | "tool-missing"
  | null;
export type CodeContext = {
  strategy: CodeDiscoveryStrategy;
  provider_status: CodeIndexProviderStatus;
  tool_visibility: CodeIndexToolVisibility;
  tool_calls: Array<{
    tool: string;
    query: string;
    status: "success" | "failed" | "skipped";
    result_summary?: string;
    error?: string;
  }>;
  files: string[];
  symbols: Array<{
    name: string;
    path: string;
    line?: number;
    relationship?: string;
  }>;
  snippets: Array<{
    path: string;
    start_line: number;
    end_line: number;
    content: string;
  }>;
  fallback_reason: CodeDiscoveryFallbackReason;
};

export type WorkPacketEnvelope = {
  schema_version: 1;
  task_id: string;
  role: WorkPacketRole;
  phase: string;
  packet: Record<string, unknown>;
  packet_bytes: number;
  handoff_payload: string;
  handoff_payload_bytes: number;
  source_bytes: number;
  reduction_percent: number;
  fingerprint: string;
  code_context: CodeContext;
};

export type WorkPacketHandoff = Pick<
  WorkPacketEnvelope,
  "schema_version" | "task_id" | "role" | "phase" | "fingerprint" | "handoff_payload"
>;

export const WORK_PACKET_MAX_HANDOFF_BYTES = 128 * 1024;

const BASELINE_FILES = ["overview.md", "architecture.md", "rules.md", "commands.md"] as const;
const STRATEGIES = new Set<CodeDiscoveryStrategy>(["graph", "index", "rg", "file-list", "direct-read", "none"]);
const PROVIDER_STATUSES = new Set<CodeIndexProviderStatus>(["configured", "failed", "skipped", "unconfigured"]);
const TOOL_VISIBILITIES = new Set<CodeIndexToolVisibility>(["visible", "missing", "unknown"]);
const FALLBACK_REASONS = new Set<Exclude<CodeDiscoveryFallbackReason, null>>([
  "call-failed",
  "provider-failed",
  "provider-skipped",
  "provider-unconfigured",
  "tool-missing"
]);

export class WorkPacketBudgetError extends Error {
  readonly role: WorkPacketRole;
  readonly bytes: number;
  readonly budget: number;
  readonly components: Readonly<Record<string, number>>;

  constructor(role: WorkPacketRole, bytes: number, budget: number, components: Readonly<Record<string, number>>) {
    super(
      `work packet handoff for ${role} is ${bytes} UTF-8 bytes; safety limit is ${budget}; `
      + `components=${JSON.stringify(components)}`
    );
    this.name = "WorkPacketBudgetError";
    this.role = role;
    this.bytes = bytes;
    this.budget = budget;
    this.components = components;
  }
}

export class WorkPacketContextError extends Error {
  readonly role: WorkPacketRole;

  constructor(role: WorkPacketRole, message: string) {
    super(`work packet for ${role} has insufficient context: ${message}`);
    this.name = "WorkPacketContextError";
    this.role = role;
  }
}

export function parseWorkPacketRole(value: string): WorkPacketRole {
  if ((WORK_PACKET_ROLES as readonly string[]).includes(value)) {
    return value as WorkPacketRole;
  }
  throw new Error(`invalid work packet role ${value}; expected ${WORK_PACKET_ROLES.join(", ")}`);
}

export function validateCodeContext(value: unknown, pathName = "code context"): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: pathName, message: "must be a JSON object" }];
  }
  const issues: ValidationIssue[] = [];
  if (typeof value.strategy !== "string" || !STRATEGIES.has(value.strategy as CodeDiscoveryStrategy)) {
    issues.push({ path: `${pathName}.strategy`, message: "must be a supported code discovery strategy" });
  }
  if (typeof value.provider_status !== "string" || !PROVIDER_STATUSES.has(value.provider_status as CodeIndexProviderStatus)) {
    issues.push({ path: `${pathName}.provider_status`, message: "must be configured, failed, skipped, or unconfigured" });
  }
  if (typeof value.tool_visibility !== "string" || !TOOL_VISIBILITIES.has(value.tool_visibility as CodeIndexToolVisibility)) {
    issues.push({ path: `${pathName}.tool_visibility`, message: "must be visible, missing, or unknown" });
  }
  validateArray(value, "tool_calls", pathName, issues, validateToolCall);
  validateStringArray(value, "files", pathName, issues);
  if (Array.isArray(value.files)) {
    value.files.forEach((file, index) => validateCodePath(file, `${pathName}.files[${index}]`, issues));
  }
  validateArray(value, "symbols", pathName, issues, validateSymbol);
  validateArray(value, "snippets", pathName, issues, validateSnippet);
  if (value.fallback_reason !== null && (
    typeof value.fallback_reason !== "string"
    || !FALLBACK_REASONS.has(value.fallback_reason as Exclude<CodeDiscoveryFallbackReason, null>)
  )) {
    issues.push({ path: `${pathName}.fallback_reason`, message: "must be a supported fallback reason or null" });
  }
  validateCodeDiscoveryCombination(value, pathName, issues);
  return issues;
}

export function assertCodeContext(value: unknown, pathName = "code context"): asserts value is CodeContext {
  const issues = validateCodeContext(value, pathName);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
}

export async function buildWorkPacket(
  root: string,
  taskId: string,
  input: { role: WorkPacketRole; codeContext?: CodeContext }
): Promise<WorkPacketEnvelope> {
  const state = await readTaskState(root, taskId);
  const dir = taskDir(root, taskId);
  const codeContext = input.codeContext ?? emptyCodeContext();
  assertCodeContext(codeContext);

  const needsSpec = input.role !== "baseline-writer";
  const needsTask = input.role === "implementer";
  const needsTrace = input.role === "advisor" || input.role === "checker" || input.role === "reviewer";
  const needsGit = input.role === "checker" || input.role === "reviewer";
  const spec = needsSpec ? await readFile(path.join(dir, state.artifacts.spec), "utf8") : "";
  const task = needsTask ? await readFile(path.join(dir, state.artifacts.task), "utf8") : "";
  const traceEvents = needsTrace ? await readRelevantTrace(path.join(dir, "trace.jsonl")) : [];
  const baselineDelta = input.role !== "baseline-writer" || state.artifacts.baseline_delta === null
    ? null
    : await readFile(path.join(dir, state.artifacts.baseline_delta), "utf8");
  const baselineNames = input.role === "planner"
    ? [...BASELINE_FILES]
    : input.role === "baseline-writer"
      ? baselineTargets(baselineDelta)
      : [];
  const baselines = await readBaselines(root, baselineNames);
  const git = needsGit ? await readGitContext(root, state.id, codeContext.files) : { changedFiles: [], diff: "" };
  const sources = { taskId: state.id, spec, task, traceEvents, baselines, baselineDelta, git };
  const sourceBytes = sourceByteLength(sources, codeContext);
  const packet = selectPacket(input.role, state, sources);

  const packetBytes = byteLength(packet);
  const handoffPayload = renderHandoffPayload(input.role, packet, codeContext);
  const handoffPayloadBytes = Buffer.byteLength(handoffPayload, "utf8");
  const components = handoffPayloadComponents(packet, codeContext, handoffPayloadBytes);
  if (handoffPayloadBytes > WORK_PACKET_MAX_HANDOFF_BYTES) {
    throw new WorkPacketBudgetError(input.role, handoffPayloadBytes, WORK_PACKET_MAX_HANDOFF_BYTES, components);
  }
  const fingerprint = sha256(stableJson({
    task_id: state.id,
    role: input.role,
    phase: state.phase,
    packet,
    code_context: codeContext
  }));

  return {
    schema_version: 1,
    task_id: state.id,
    role: input.role,
    phase: state.phase,
    packet,
    packet_bytes: packetBytes,
    handoff_payload: handoffPayload,
    handoff_payload_bytes: handoffPayloadBytes,
    source_bytes: sourceBytes,
    reduction_percent: sourceBytes === 0 ? 0 : roundPercent((1 - handoffPayloadBytes / sourceBytes) * 100),
    fingerprint,
    code_context: codeContext
  };
}

export async function buildWorkPacketObserved(
  root: string,
  taskId: string,
  input: { role: WorkPacketRole; codeContext?: CodeContext }
): Promise<WorkPacketEnvelope> {
  const result = await buildWorkPacket(root, taskId, input);
  await appendTrace(root, taskId, {
    ts: new Date().toISOString(),
    type: "handoff.packet-built",
    summary: `Built ${result.role} work packet (${result.packet_bytes} bytes).`,
    data: {
      role: result.role,
      packet_bytes: result.packet_bytes,
      handoff_payload_bytes: result.handoff_payload_bytes,
      source_bytes: result.source_bytes,
      reduction_percent: result.reduction_percent,
      included_section_count: Object.keys(result.packet).length,
      code_strategy: result.code_context.strategy,
      fallback_reason: result.code_context.fallback_reason
    }
  });
  return result;
}

export function toWorkPacketHandoff(packet: WorkPacketEnvelope): WorkPacketHandoff {
  return {
    schema_version: packet.schema_version,
    task_id: packet.task_id,
    role: packet.role,
    phase: packet.phase,
    fingerprint: packet.fingerprint,
    handoff_payload: packet.handoff_payload
  };
}

type PacketSources = {
  taskId: string;
  spec: string;
  task: string;
  traceEvents: Array<Record<string, unknown>>;
  baselines: Record<string, string>;
  baselineDelta: string | null;
  git: { changedFiles: string[]; diff: string };
};

function selectPacket(
  role: WorkPacketRole,
  state: Awaited<ReturnType<typeof readTaskState>>,
  sources: PacketSources
): Record<string, unknown> {
  const spec = markdownSections(sources.spec);
  const taskSections = markdownSections(sources.task);
  const acceptanceCriteria = checklistLines(spec["Acceptance Criteria"] ?? "");
  const common = {
    task: {
      id: state.id,
      title: state.title,
      phase: state.phase,
      next_action: state.next_action
    }
  };

  switch (role) {
    case "advisor":
      return {
        ...common,
        proposal_identity: latestProposalIdentity(sources.traceEvents),
        contract: contractSections(spec, ["Goal", "Scope", "Constraints", "Decisions", "Acceptance Criteria"]),
        open_risks: riskLines(spec)
      };
    case "planner":
      return {
        ...common,
        contract: contractSections(spec, ["Goal", "Scope", "Non-goals", "Constraints", "Decisions", "Acceptance Criteria"]),
        baseline: sources.baselines
      };
    case "implementer": {
      const nextItems = nextUncheckedItems(sources.task, 1);
      return {
        ...common,
        assignment: nextItems,
        acceptance_criteria: relevantAcceptanceCriteria(nextItems, acceptanceCriteria),
        boundaries: contractSections(spec, ["Non-goals", "Constraints"]),
        verification: checklistLines(taskSections.Verification ?? "")
      };
    }
    case "checker":
      return {
        task: { id: state.id, phase: state.phase },
        context_status: checkerContextStatus(sources),
        acceptance_criteria: acceptanceCriteria,
        changed_files: sources.git.changedFiles,
        diff: sources.git.diff,
        verification_evidence: verificationEvents(sources.traceEvents),
        remaining_risks: riskLines(spec)
      };
    case "reviewer":
      return {
        task: { id: state.id, phase: state.phase },
        context_status: checkerContextStatus(sources),
        review_contract: contractSections(spec, ["Goal", "Constraints", "Decisions", "Acceptance Criteria"]),
        changed_files: sources.git.changedFiles,
        diff: sources.git.diff,
        verification_evidence: verificationEvents(sources.traceEvents),
        remaining_risks: riskLines(spec)
      };
    case "baseline-writer":
      if (sources.baselineDelta === null) {
        throw new WorkPacketContextError(role, "baseline-delta.md is missing");
      }
      if (Object.keys(sources.baselines).length === 0) {
        throw new WorkPacketContextError(role, "baseline delta has no recognized target Baseline section");
      }
      return {
        ...common,
        context_status: "ready",
        baseline_delta: sources.baselineDelta,
        target_baseline: sources.baselines
      };
  }
}

function renderHandoffPayload(
  role: WorkPacketRole,
  packet: Record<string, unknown>,
  codeContext: CodeContext
): string {
  return [
    `Role: ff-${role}`,
    "Complete only the bounded assignment represented by this packet. Return degraded or insufficient-context when required evidence is missing.",
    "Work packet:",
    JSON.stringify(packet),
    "Validated code context:",
    JSON.stringify(codeContext)
  ].join("\n");
}

function handoffPayloadComponents(
  packet: Record<string, unknown>,
  codeContext: CodeContext,
  totalBytes: number
): Readonly<Record<string, number>> {
  const components = {
    packet: Buffer.byteLength(JSON.stringify(packet), "utf8"),
    code_context: Buffer.byteLength(JSON.stringify(codeContext), "utf8")
  };
  return {
    ...components,
    framing: totalBytes - Object.values(components).reduce((total, bytes) => total + bytes, 0)
  };
}

async function readRelevantTrace(tracePath: string): Promise<Array<Record<string, unknown>>> {
  const text = await readFile(tracePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((event) => event.type !== "handoff.packet-built" && event.type !== "context_package.refreshed");
}

async function readBaselines(root: string, files: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    files.map(async (file) => [file, await readFile(path.join(root, ".ff/project", file), "utf8")] as const)
  );
  return Object.fromEntries(entries);
}

async function readGitContext(root: string, taskId: string, boundedPaths: string[]): Promise<{ changedFiles: string[]; diff: string }> {
  const status = await getGitStatus(root);
  if (status.kind !== "dirty") {
    return { changedFiles: [], diff: "" };
  }
  const allowed = boundedPaths.filter(isSafeRepositoryPath);
  if (allowed.length === 0) {
    return { changedFiles: [], diff: "" };
  }
  const changedFiles = status.entries
    .map((entry) => statusPath(entry))
    .filter((file) => !isExcludedTaskGeneratedPath(file))
    .filter((file) => !file.startsWith(`.ff/tasks/${taskId}/`))
    .filter((file) => allowed.some((candidate) => file === candidate || file.startsWith(`${candidate.replace(/\/$/, "")}/`)))
    .sort();
  if (changedFiles.length === 0) {
    return { changedFiles: [], diff: "" };
  }
  try {
    const options = { cwd: root, maxBuffer: 8 * 1024 * 1024 };
    const [unstaged, staged, untracked] = await Promise.all([
      execFileAsync("git", ["diff", "--no-ext-diff", "--unified=1", "--", ...changedFiles], options),
      execFileAsync("git", ["diff", "--cached", "--no-ext-diff", "--unified=1", "--", ...changedFiles], options),
      readUntrackedDiff(root, status.entries, new Set(changedFiles))
    ]);
    return { changedFiles, diff: [unstaged.stdout, staged.stdout, untracked].filter(Boolean).join("\n") };
  } catch {
    return { changedFiles, diff: "" };
  }
}

function isSafeRepositoryPath(file: string): boolean {
  return file.length > 0
    && !path.isAbsolute(file)
    && !file.includes("\\")
    && !file.split("/").includes("..");
}

async function readUntrackedDiff(root: string, entries: string[], allowedFiles: ReadonlySet<string>): Promise<string> {
  const blocks: string[] = [];
  for (const entry of entries) {
    if (!entry.startsWith("?? ")) {
      continue;
    }
    const file = statusPath(entry);
    if (!allowedFiles.has(file)) {
      continue;
    }
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) {
      continue;
    }
    try {
      const content = await readFile(absolute, "utf8");
      if (content.includes("\0")) {
        continue;
      }
      blocks.push(`diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ new file @@\n${content}`);
    } catch {
      continue;
    }
  }
  return blocks.join("\n");
}

function sourceByteLength(sources: PacketSources, codeContext: CodeContext): number {
  return Buffer.byteLength([
    sources.spec,
    sources.task,
    stableJson(sources.traceEvents),
    stableJson(sources.baselines),
    sources.baselineDelta ?? "",
    sources.git.diff,
    stableJson(codeContext)
  ].join("\n"), "utf8");
}

function baselineTargets(delta: string | null): string[] {
  if (delta === null) {
    return [];
  }
  const valid = new Set<string>(BASELINE_FILES);
  return [...delta.matchAll(/^##\s+(.+?)\s*$/gm)]
    .map((match) => match[1])
    .filter((file) => valid.has(file));
}

function markdownSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading !== null) {
      current = heading[1];
      sections[current] = "";
      continue;
    }
    if (current !== null) {
      sections[current] += `${line}\n`;
    }
  }
  return Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.trim()]));
}

function contractSections(sections: Record<string, string>, names: string[]): Record<string, string> {
  return Object.fromEntries(names.filter((name) => sections[name]?.length > 0).map((name) => [name, sections[name]]));
}

function checklistLines(markdown: string): string[] {
  return markdown.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^- \[[ xX]\]/.test(line));
}

function nextUncheckedItems(markdown: string, count: number): string[] {
  return markdown.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^- \[ \]/.test(line)).slice(0, count);
}

function relevantAcceptanceCriteria(items: string[], criteria: string[]): string[] {
  const keywords = new Set(items.flatMap((item) => (item.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? [])));
  const matched = criteria.filter((criterion) => {
    const lower = criterion.toLowerCase();
    return [...keywords].some((keyword) => lower.includes(keyword));
  });
  return matched.length > 0 ? matched : criteria.slice(0, 1);
}

function riskLines(spec: Record<string, string>): string[] {
  return [spec.Constraints ?? "", spec["Non-goals"] ?? ""]
    .flatMap((section) => section.split(/\r?\n/))
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

function verificationEvents(events: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return events
    .filter((event) => typeof event.type === "string" && /^(check\.|verification\.|run\.verified)/.test(event.type))
    .map((event) => ({ type: event.type, summary: event.summary, data: event.data }));
}

function latestProposalIdentity(events: Array<Record<string, unknown>>): Record<string, unknown> | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if ((event.type === "spec.proposed" || event.type === "spec.accepted") && isRecord(event.data)) {
      return {
        attempt_id: event.data.attempt_id,
        proposal_id: event.data.proposal_id,
        proposal_hash: event.data.proposal_hash
      };
    }
  }
  return null;
}

function checkerContextStatus(sources: PacketSources): "ready" | "insufficient-context" {
  return sources.git.diff.length > 0 && verificationEvents(sources.traceEvents).length > 0 ? "ready" : "insufficient-context";
}

function emptyCodeContext(): CodeContext {
  return {
    strategy: "none",
    provider_status: "unconfigured",
    tool_visibility: "unknown",
    tool_calls: [],
    files: [],
    symbols: [],
    snippets: [],
    fallback_reason: "provider-unconfigured"
  };
}

function validateCodeDiscoveryCombination(
  value: Record<string, unknown>,
  pathName: string,
  issues: ValidationIssue[]
): void {
  if ((value.strategy === "graph" || value.strategy === "index") && (
    value.provider_status !== "configured"
    || value.tool_visibility !== "visible"
    || value.fallback_reason !== null
  )) {
    issues.push({
      path: `${pathName}.strategy`,
      message: "graph or index requires a configured provider, visible tool, and null fallback reason"
    });
  }
  const expectedReason: Partial<Record<CodeIndexProviderStatus, CodeDiscoveryFallbackReason>> = {
    failed: "provider-failed",
    skipped: "provider-skipped",
    unconfigured: "provider-unconfigured"
  };
  const providerStatus = value.provider_status as CodeIndexProviderStatus;
  if (expectedReason[providerStatus] !== undefined && value.fallback_reason !== expectedReason[providerStatus]) {
    issues.push({ path: `${pathName}.fallback_reason`, message: `must be ${expectedReason[providerStatus]} for provider status ${providerStatus}` });
  }
  if (value.provider_status === "configured" && value.tool_visibility === "missing" && value.fallback_reason !== "tool-missing") {
    issues.push({ path: `${pathName}.fallback_reason`, message: "must be tool-missing when the configured tool is missing" });
  }
}

function validateArray(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  issues: ValidationIssue[],
  validator: (value: unknown, pathName: string, issues: ValidationIssue[]) => void
): void {
  const value = record[key];
  if (!Array.isArray(value)) {
    issues.push({ path: `${pathName}.${key}`, message: "must be an array" });
    return;
  }
  value.forEach((item, index) => validator(item, `${pathName}.${key}[${index}]`, issues));
}

function validateStringArray(record: Record<string, unknown>, key: string, pathName: string, issues: ValidationIssue[]): void {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    issues.push({ path: `${pathName}.${key}`, message: "must be an array of non-empty strings" });
  }
}

function validateToolCall(value: unknown, pathName: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path: pathName, message: "must be a JSON object" });
    return;
  }
  requireStrings(value, ["tool", "query"], pathName, issues);
  if (value.status !== "success" && value.status !== "failed" && value.status !== "skipped") {
    issues.push({ path: `${pathName}.status`, message: "must be success, failed, or skipped" });
  }
  optionalString(value, "result_summary", pathName, issues);
  optionalString(value, "error", pathName, issues);
}

function validateSymbol(value: unknown, pathName: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path: pathName, message: "must be a JSON object" });
    return;
  }
  requireStrings(value, ["name", "path"], pathName, issues);
  validateCodePath(value.path, `${pathName}.path`, issues);
  optionalNumber(value, "line", pathName, issues);
  optionalString(value, "relationship", pathName, issues);
}

function validateSnippet(value: unknown, pathName: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path: pathName, message: "must be a JSON object" });
    return;
  }
  requireStrings(value, ["path", "content"], pathName, issues);
  validateCodePath(value.path, `${pathName}.path`, issues);
  for (const key of ["start_line", "end_line"]) {
    if (!Number.isInteger(value[key]) || Number(value[key]) < 1) {
      issues.push({ path: `${pathName}.${key}`, message: "must be a positive integer" });
    }
  }
  if (Number(value.end_line) < Number(value.start_line)) {
    issues.push({ path: `${pathName}.end_line`, message: "must be greater than or equal to start_line" });
  }
}

function requireStrings(record: Record<string, unknown>, keys: string[], pathName: string, issues: ValidationIssue[]): void {
  for (const key of keys) {
    if (typeof record[key] !== "string" || record[key].length === 0) {
      issues.push({ path: `${pathName}.${key}`, message: "must be a non-empty string" });
    }
  }
}

function optionalString(record: Record<string, unknown>, key: string, pathName: string, issues: ValidationIssue[]): void {
  if (record[key] !== undefined && typeof record[key] !== "string") {
    issues.push({ path: `${pathName}.${key}`, message: "must be a string when provided" });
  }
}

function optionalNumber(record: Record<string, unknown>, key: string, pathName: string, issues: ValidationIssue[]): void {
  if (record[key] !== undefined && typeof record[key] !== "number") {
    issues.push({ path: `${pathName}.${key}`, message: "must be a number when provided" });
  }
}

function validateCodePath(value: unknown, pathName: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string") {
    return;
  }
  if (!isSafeRepositoryPath(value)) {
    issues.push({ path: pathName, message: "must be a safe repository-relative path" });
  }
  if (value === ".ff/tasks" || value.startsWith(".ff/tasks/")) {
    issues.push({ path: pathName, message: "task artifacts are not code context" });
  }
}

function statusPath(entry: string): string {
  const raw = entry.slice(3).trim();
  const renamed = raw.includes(" -> ") ? raw.slice(raw.lastIndexOf(" -> ") + 4) : raw;
  return renamed.replace(/^"|"$/g, "");
}

function isExcludedTaskGeneratedPath(file: string): boolean {
  return /(?:^|\/)evidence\//.test(file)
    || /(?:^|\/)context-package(?:\.manifest)?\.(?:md|json)$/.test(file)
    || /(?:^|\/)work-packet(?:\.manifest)?\.json$/.test(file);
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
