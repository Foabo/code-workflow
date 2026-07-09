import { spawn } from "node:child_process";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { runWorkflowAction } from "../../src/index.js";
import type {
  BaselineFile,
  BaselineDecision,
  DirtyWorktreeDecision,
  TaskStateRecord,
  WorkflowCommandAction,
  WorkflowOptions,
  WorkflowResult
} from "../../src/index.js";

export async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "ff-kernel-"));
}

export async function runCli(
  args: string[],
  options: { cwd?: string; env?: Record<string, string>; input?: string; answers?: string[] } = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [path.join(process.cwd(), "dist/src/cli.js"), ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  const answers = [...(options.answers ?? [])];
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    if ((stdout.endsWith("Choose [1]: ") || stdout.endsWith("[y/N]: ") || stdout.endsWith("[Y/n]: ")) && answers.length > 0) {
      child.stdin.write(`${answers.shift()}\n`);
    }
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  if (options.answers === undefined) {
    child.stdin.end(options.input ?? "");
  }

  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 5000);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      child.stdin.destroy();
      resolve({ code, stdout, stderr });
    });
  });
}

export function parseCliJson(stdout: string): Record<string, unknown> {
  const marker = "{\n  \"created\"";
  const offset = stdout.lastIndexOf(marker);
  assert.notEqual(offset, -1, stdout);
  return JSON.parse(stdout.slice(offset)) as Record<string, unknown>;
}

export type TaskSummary = Pick<TaskStateRecord, "id" | "title" | "lifecycle" | "phase" | "next_action" | "updated_at">;
export type PreflightAction = Exclude<WorkflowCommandAction, "doctor">;
export type PreflightReport = {
  ok: boolean;
  action: PreflightAction;
  task: TaskStateRecord | null;
  issues: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
  git: unknown;
};
export type BaselineSyncResult = {
  decision: BaselineDecision;
  updated: string[];
  preview: Partial<Record<BaselineFile, string>>;
  highImpact: boolean;
};
export type LegacyTaskMigrationResult = {
  migrated: Array<{
    from: string;
    to: string;
    from_location: "active" | "archived";
    to_location: "active" | "archived";
  }>;
};

export async function cliJson<T>(args: string[]): Promise<T> {
  const cli = await runCli(args);
  if (cli.code !== 0) {
    throw new Error((cli.stderr || cli.stdout).trim());
  }
  return parseJsonOutput<T>(cli.stdout);
}

export function parseJsonOutput<T>(stdout: string): T {
  const text = stdout.trim();
  assert.notEqual(text.length, 0, stdout);
  return JSON.parse(text) as T;
}

export async function createTaskViaCli(
  root: string,
  input: { id?: string; title: string; phase?: string; nextAction?: string; now?: Date }
): Promise<TaskStateRecord> {
  const args = ["internal", "create-task", "--root", root, "--title", input.title];
  if (input.id !== undefined) {
    args.push("--id", input.id);
  }
  if (input.phase !== undefined) {
    args.push("--phase", input.phase);
  }
  if (input.nextAction !== undefined) {
    args.push("--next-action", input.nextAction);
  }
  return cliJson<TaskStateRecord>(args);
}

export async function setTaskStateViaCli(
  root: string,
  taskId: string,
  input: {
    lifecycle?: TaskStateRecord["lifecycle"];
    phase?: string;
    nextAction?: string;
    blockedReason?: string | null;
    parkedReason?: string | null;
    resumeCondition?: string | null;
    now?: Date;
  }
): Promise<TaskStateRecord> {
  const args = ["internal", "set-state", "--root", root, "--task", taskId];
  if (input.lifecycle !== undefined) {
    args.push("--lifecycle", input.lifecycle);
  }
  if (input.phase !== undefined) {
    args.push("--phase", input.phase);
  }
  if (input.nextAction !== undefined) {
    args.push("--next-action", input.nextAction);
  }
  if (input.blockedReason !== undefined) {
    args.push("--blocked-reason", input.blockedReason ?? "null");
  }
  if (input.parkedReason !== undefined) {
    args.push("--parked-reason", input.parkedReason ?? "null");
  }
  if (input.resumeCondition !== undefined) {
    args.push("--resume-condition", input.resumeCondition ?? "null");
  }
  return cliJson<TaskStateRecord>(args);
}

export async function readTaskStateFile(root: string, taskId: string): Promise<TaskStateRecord> {
  return JSON.parse(await readFile(path.join(root, ".ff/tasks", taskId, "task.json"), "utf8")) as TaskStateRecord;
}

export async function selectTaskViaCli(root: string, input: { taskId?: string } = {}): Promise<TaskStateRecord> {
  const args = ["internal", "select-task", "--root", root];
  if (input.taskId !== undefined) {
    args.push("--task", input.taskId);
  }
  return cliJson<TaskStateRecord>(args);
}

export async function listTasksViaCli(root: string, input: { scope?: "active" | "archived" | "all" } = {}): Promise<TaskSummary[]> {
  const args = ["tasks", "--root", root];
  if (input.scope === "archived") {
    args.push("--archived");
  } else if (input.scope === "all") {
    args.push("--all");
  }
  return (await cliJson<{ tasks: TaskSummary[] }>(args)).tasks;
}

export async function runPreflightViaCli(root: string, input: { action: PreflightAction; taskId?: string }): Promise<PreflightReport> {
  const args = ["preflight", "--root", root, "--action", input.action];
  if (input.taskId !== undefined) {
    args.push("--task", input.taskId);
  }
  return cliJson<PreflightReport>(args);
}

export async function createResumeNoteViaCli(
  root: string,
  taskId: string,
  content: string,
  resumeCondition?: string | null
): Promise<TaskStateRecord> {
  const args = ["internal", "create-resume", "--root", root, "--task", taskId, "--content", content];
  if (resumeCondition !== undefined) {
    args.push("--resume-condition", resumeCondition ?? "null");
  }
  return cliJson<TaskStateRecord>(args);
}

export async function consumeResumeNoteViaCli(root: string, taskId: string): Promise<TaskStateRecord> {
  return cliJson<TaskStateRecord>(["internal", "consume-resume", "--root", root, "--task", taskId]);
}

export async function refreshContextPackageViaCli(root: string, taskId: string): Promise<Record<string, unknown>> {
  return cliJson<Record<string, unknown>>(["internal", "refresh-context-package", "--root", root, "--task", taskId]);
}

export async function ensureBaselineDeltaViaCli(root: string, taskId: string): Promise<TaskStateRecord> {
  return cliJson<TaskStateRecord>(["internal", "ensure-baseline-delta", "--root", root, "--task", taskId]);
}

export async function syncBaselineDeltaViaCli(
  root: string,
  taskId: string,
  decision: BaselineDecision,
  options: { selectedFiles?: BaselineFile[]; editedMarkdown?: string } = {}
): Promise<BaselineSyncResult> {
  const args = ["internal", "sync-baseline-delta", "--root", root, "--task", taskId, "--decision", decision];
  if (options.selectedFiles !== undefined) {
    args.push("--selected-files", options.selectedFiles.join(","));
  }
  if (options.editedMarkdown !== undefined) {
    args.push("--edited-content", options.editedMarkdown);
  }
  return cliJson<BaselineSyncResult>(args);
}

export async function finishTaskViaCli(
  root: string,
  taskId: string,
  input: {
    summary: string;
    dirtyWorktreeHandling?: DirtyWorktreeDecision;
    baselineDecision?: BaselineDecision | "none";
    now?: Date;
  }
): Promise<TaskStateRecord> {
  const args = ["internal", "finish-task", "--root", root, "--task", taskId, "--summary", input.summary];
  if (input.dirtyWorktreeHandling !== undefined) {
    args.push("--dirty-worktree", input.dirtyWorktreeHandling);
  }
  if (input.baselineDecision !== undefined) {
    args.push("--baseline", input.baselineDecision);
  }
  return cliJson<TaskStateRecord>(args);
}

export async function discardTaskViaCli(
  root: string,
  taskId: string,
  input: { confirmed: boolean; worktreeHandling: "keep" | "stash" | "revert" | "delete-worktree" | "none"; now?: Date }
): Promise<void> {
  const args = ["internal", "discard-task", "--root", root, "--task", taskId, "--worktree", input.worktreeHandling];
  if (input.confirmed) {
    args.push("--confirm");
  }
  await cliJson<{ ok: true }>(args);
}

export async function appendTraceViaCli(
  root: string,
  taskId: string,
  input: { type: string; summary: string; data?: Record<string, unknown> }
): Promise<void> {
  const args = ["internal", "append-trace", "--root", root, "--task", taskId, "--type", input.type, "--summary", input.summary];
  if (input.data !== undefined) {
    args.push("--data-json", JSON.stringify(input.data));
  }
  await cliJson<{ ok: true }>(args);
}

export async function runValidateClarifyViaCli(
  root: string,
  taskId: string,
  stage: "proposal" | "accept" | "advance" | "watchdog",
  extraArgs: string[] = []
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return runCli([
    "internal",
    "validate-clarify",
    "--root",
    root,
    "--task",
    taskId,
    "--stage",
    stage,
    ...extraArgs
  ]);
}

export async function acceptClarifyViaWorkflow(
  root: string,
  input: WorkflowOptions & { taskId: string; goal: string }
): Promise<WorkflowResult> {
  const proposed = await runWorkflowAction(root, "clarify", input);
  const identity = proposed.details?.identity as
    | { attemptId: string; proposalId: string; proposalHash: string }
    | undefined;
  assert.equal(proposed.task?.phase, "clarify");
  assert.ok(identity, "clarify proposal identity is returned");
  await appendTraceViaCli(root, input.taskId, {
    type: "advisor.reviewed",
    summary: "Advisor approved current Proposed Spec.",
    data: {
      attempt_id: identity.attemptId,
      proposal_id: identity.proposalId,
      proposal_hash: identity.proposalHash,
      verdict: "pass"
    }
  });
  return runWorkflowAction(root, "clarify", { ...input, confirm: true });
}

export function assertInOrder(text: string, fragments: string[]): void {
  let cursor = -1;
  for (const fragment of fragments) {
    const next = text.indexOf(fragment, cursor + 1);
    assert.notEqual(next, -1, `Expected to find "${fragment}" after offset ${cursor}`);
    cursor = next;
  }
}

export async function migrateTasksViaCli(root: string, _now?: Date): Promise<LegacyTaskMigrationResult> {
  return cliJson<LegacyTaskMigrationResult>(["internal", "migrate-task-ids", "--root", root]);
}

export async function readTrace(root: string, taskId: string): Promise<Array<Record<string, unknown>>> {
  const text = await readFile(path.join(root, ".ff/tasks", taskId, "trace.jsonl"), "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

export async function writeLegacyTask(
  root: string,
  input: { id: string; title: string; lifecycle: "open" | "closed"; createdAt: string }
): Promise<void> {
  const dir = path.join(root, ".ff/tasks", input.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "spec.md"), "# Spec\n", "utf8");
  await writeFile(path.join(dir, "plan.md"), "# Plan\n", "utf8");
  await writeFile(path.join(dir, "task.md"), "# Task\n", "utf8");
  await writeFile(path.join(dir, "trace.jsonl"), "", "utf8");
  await writeFile(
    path.join(dir, "task.json"),
    `${JSON.stringify({
      id: input.id,
      title: input.title,
      lifecycle: input.lifecycle,
      phase: input.lifecycle === "closed" ? "finish" : "run",
      next_action: input.lifecycle === "closed" ? "Task is closed" : "Execute implementation",
      health_flags: [],
      artifacts: {
        spec: "spec.md",
        plan: "plan.md",
        task: "task.md",
        baseline_delta: null,
        resume: null
      },
      invalidated_artifacts: [],
      blocked_reason: null,
      parked_reason: null,
      resume_condition: null,
      created_at: input.createdAt,
      updated_at: input.createdAt,
      schema_version: 1
    }, null, 2)}\n`,
    "utf8"
  );
}
