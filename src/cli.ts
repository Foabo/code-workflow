#!/usr/bin/env node
import { initProject } from "./init.js";
import { preflight, WorkflowAction } from "./preflight.js";
import { listTasks, selectTask } from "./task-store.js";
import {
  appendTrace,
  consumeResumeNote,
  createResumeNote,
  createTask,
  discardTask,
  finishTask,
  updateTaskState
} from "./tasks.js";
import { doctorProject, validateProject } from "./validate.js";
import { TaskLifecycle, TraceEvent } from "./types.js";
import { HarnessName } from "./adapters.js";
import { BaselineDecision, ensureBaselineDelta, syncBaselineDelta } from "./baseline.js";

type Flags = Record<string, string | boolean>;

async function main(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;
  const publicFlags = parseFlags(argv.slice(1)).flags;
  const internalFlags = parseFlags(rest).flags;
  const root = String((command === "internal" ? internalFlags.root : publicFlags.root) ?? process.cwd());

  try {
    switch (command) {
      case "init": {
        const result = await initProject(root, { harnesses: [optionalHarness(publicFlags, "harness") ?? "generic"] });
        printJson(result);
        return 0;
      }
      case "validate": {
        const issues = await validateProject(root);
        printJson({ ok: issues.length === 0, issues });
        return issues.length === 0 ? 0 : 1;
      }
      case "doctor": {
        const report = await doctorProject(root);
        printJson(report);
        return report.ok ? 0 : 1;
      }
      case "tasks": {
        printJson({ tasks: await listTasks(root) });
        return 0;
      }
      case "preflight": {
        const report = await preflight(root, {
          action: requiredWorkflowAction(publicFlags, "action"),
          taskId: optionalString(publicFlags, "task")
        });
        printJson(report);
        return report.ok ? 0 : 1;
      }
      case "internal":
        return await runInternal(subcommand, rest, root);
      default:
        printUsage();
        return command === undefined ? 0 : 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function runInternal(subcommand: string | undefined, args: string[], root: string): Promise<number> {
  const { flags } = parseFlags(args);

  switch (subcommand) {
    case "create-task": {
      const id = requiredString(flags, "id");
      const title = requiredString(flags, "title");
      const task = await createTask(root, {
        id,
        title,
        phase: optionalString(flags, "phase"),
        nextAction: optionalString(flags, "next-action")
      });
      printJson(task);
      return 0;
    }
    case "select-task": {
      const task = await selectTask(root, { taskId: optionalString(flags, "task") });
      printJson(task);
      return 0;
    }
    case "append-trace": {
      const taskId = requiredString(flags, "task");
      const event: TraceEvent = {
        ts: optionalString(flags, "ts") ?? new Date().toISOString(),
        type: requiredString(flags, "type"),
        summary: requiredString(flags, "summary")
      };
      await appendTrace(root, taskId, event);
      printJson({ ok: true });
      return 0;
    }
    case "set-state": {
      const taskId = requiredString(flags, "task");
      const task = await updateTaskState(root, taskId, {
        lifecycle: optionalLifecycle(flags, "lifecycle"),
        phase: optionalString(flags, "phase"),
        nextAction: optionalString(flags, "next-action"),
        blockedReason: optionalNullableString(flags, "blocked-reason"),
        parkedReason: optionalNullableString(flags, "parked-reason"),
        resumeCondition: optionalNullableString(flags, "resume-condition")
      });
      printJson(task);
      return 0;
    }
    case "finish-task": {
      const taskId = requiredString(flags, "task");
      const baselineDecision = optionalBaselineDecision(flags, "baseline");
      if (baselineDecision === "accepted" || baselineDecision === "edited" || baselineDecision === "skipped") {
        await syncBaselineDelta(root, taskId, baselineDecision);
      }
      const task = await finishTask(root, taskId, {
        summary: requiredString(flags, "summary"),
        dirtyWorktreeHandling: optionalDirtyWorktreeHandling(flags, "dirty-worktree"),
        baselineDecision
      });
      printJson(task);
      return 0;
    }
    case "discard-task": {
      const taskId = requiredString(flags, "task");
      await discardTask(root, taskId, {
        confirmed: flags.confirm === true || flags.confirm === "true",
        worktreeHandling: optionalDiscardWorktreeHandling(flags, "worktree") ?? "none"
      });
      printJson({ ok: true });
      return 0;
    }
    case "create-resume": {
      const taskId = requiredString(flags, "task");
      const content = requiredString(flags, "content");
      const task = await createResumeNote(root, taskId, content, optionalNullableString(flags, "resume-condition"));
      printJson(task);
      return 0;
    }
    case "ensure-baseline-delta": {
      const taskId = requiredString(flags, "task");
      const task = await ensureBaselineDelta(root, taskId);
      printJson(task);
      return 0;
    }
    case "sync-baseline-delta": {
      const taskId = requiredString(flags, "task");
      const result = await syncBaselineDelta(root, taskId, requiredBaselineDecision(flags, "decision"));
      printJson(result);
      return 0;
    }
    case "consume-resume": {
      const taskId = requiredString(flags, "task");
      const task = await consumeResumeNote(root, taskId);
      printJson(task);
      return 0;
    }
    default:
      printInternalUsage();
      return 1;
  }
}

function parseFlags(args: string[]): { flags: Flags; positional: string[] } {
  const flags: Flags = {};
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return { flags, positional };
}

function requiredString(flags: Flags, key: string): string {
  const value = flags[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing required --${key}`);
  }
  return value;
}

function optionalString(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function optionalNullableString(flags: Flags, key: string): string | null | undefined {
  const value = flags[key];
  if (value === undefined) {
    return undefined;
  }
  if (value === "null") {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function optionalLifecycle(flags: Flags, key: string): TaskLifecycle | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "open" || value === "blocked" || value === "parked" || value === "closed") {
    return value;
  }
  throw new Error(`--${key} must be one of open, blocked, parked, closed`);
}

function optionalHarness(flags: Flags, key: string): HarnessName | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "generic") {
    return value;
  }
  throw new Error(`--${key} must be generic`);
}

function requiredWorkflowAction(flags: Flags, key: string): WorkflowAction {
  const value = requiredString(flags, key);
  if (
    value === "work" ||
    value === "clarify" ||
    value === "plan" ||
    value === "run" ||
    value === "check" ||
    value === "finish" ||
    value === "resume" ||
    value === "discard" ||
    value === "understand"
  ) {
    return value;
  }
  throw new Error(`--${key} must be a workflow action`);
}

function optionalDirtyWorktreeHandling(
  flags: Flags,
  key: string
): "covered" | "acknowledged" | "clean" | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "covered" || value === "acknowledged" || value === "clean") {
    return value;
  }
  throw new Error(`--${key} must be covered, acknowledged, or clean`);
}

function optionalBaselineDecision(flags: Flags, key: string): "accepted" | "edited" | "skipped" | "none" | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "accepted" || value === "edited" || value === "skipped" || value === "none") {
    return value;
  }
  throw new Error(`--${key} must be accepted, edited, skipped, or none`);
}

function requiredBaselineDecision(flags: Flags, key: string): BaselineDecision {
  const value = requiredString(flags, key);
  if (value === "accepted" || value === "edited" || value === "skipped") {
    return value;
  }
  throw new Error(`--${key} must be accepted, edited, or skipped`);
}

function optionalDiscardWorktreeHandling(
  flags: Flags,
  key: string
): "keep" | "stash" | "revert" | "delete-worktree" | "none" | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "keep" || value === "stash" || value === "revert" || value === "delete-worktree" || value === "none") {
    return value;
  }
  throw new Error(`--${key} must be keep, stash, revert, delete-worktree, or none`);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printUsage(): void {
  console.log(`Usage:
  cw init [--root <path>] [--harness generic]
  cw validate [--root <path>]
  cw doctor [--root <path>]
  cw tasks [--root <path>]
  cw preflight --action <action> [--task <id>] [--root <path>]
  cw internal <helper> [flags]`);
}

function printInternalUsage(): void {
  console.log(`Internal helpers:
  cw internal create-task --id <id> --title <title> [--phase <phase>] [--next-action <text>]
  cw internal select-task [--task <id>]
  cw internal append-trace --task <id> --type <type> --summary <text>
  cw internal set-state --task <id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
  cw internal finish-task --task <id> --summary <text> [--dirty-worktree covered|acknowledged|clean] [--baseline accepted|edited|skipped|none]
  cw internal discard-task --task <id> --confirm [--worktree keep|stash|revert|delete-worktree|none]
  cw internal create-resume --task <id> --content <markdown>
  cw internal ensure-baseline-delta --task <id>
  cw internal sync-baseline-delta --task <id> --decision accepted|edited|skipped
  cw internal consume-resume --task <id>`);
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
