#!/usr/bin/env node
import { initProject } from "./init.js";
import { appendTrace, consumeResumeNote, createResumeNote, createTask, updateTaskState } from "./tasks.js";
import { doctorProject, validateProject } from "./validate.js";
import { TaskLifecycle, TraceEvent } from "./types.js";

type Flags = Record<string, string | boolean>;

async function main(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;
  const publicFlags = parseFlags(argv.slice(1)).flags;
  const internalFlags = parseFlags(rest).flags;
  const root = String((command === "internal" ? internalFlags.root : publicFlags.root) ?? process.cwd());

  try {
    switch (command) {
      case "init": {
        const result = await initProject(root);
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
    case "create-resume": {
      const taskId = requiredString(flags, "task");
      const content = requiredString(flags, "content");
      const task = await createResumeNote(root, taskId, content, optionalNullableString(flags, "resume-condition"));
      printJson(task);
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

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printUsage(): void {
  console.log(`Usage:
  cw init [--root <path>]
  cw validate [--root <path>]
  cw doctor [--root <path>]
  cw internal <helper> [flags]`);
}

function printInternalUsage(): void {
  console.log(`Internal helpers:
  cw internal create-task --id <id> --title <title> [--phase <phase>] [--next-action <text>]
  cw internal append-trace --task <id> --type <type> --summary <text>
  cw internal set-state --task <id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
  cw internal create-resume --task <id> --content <markdown>
  cw internal consume-resume --task <id>`);
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
