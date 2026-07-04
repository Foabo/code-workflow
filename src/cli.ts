#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { initProject } from "./init.js";
import { preflight, WorkflowAction } from "./preflight.js";
import { listTasks, selectTask } from "./task-store.js";
import {
  appendTrace,
  checkClosureGate,
  consumeResumeNote,
  createResumeNote,
  createTask,
  discardTask,
  finishTask,
  updateTaskState
} from "./tasks.js";
import { doctorProject, validateProject } from "./validate.js";
import { DirtyWorktreeDecision, EnhancementChoice, TaskLifecycle, TraceEvent } from "./types.js";
import { HarnessName } from "./adapters.js";
import { BaselineDecision, ensureBaselineDelta, syncBaselineDelta } from "./baseline.js";
import { updateProject } from "./update.js";

type Flags = Record<string, string | boolean>;
type Choice<T extends string> = {
  value: T;
  label: string;
  detail: string;
};
type PromptSession = {
  choice<T extends string>(question: string, choices: readonly Choice<T>[]): Promise<T>;
  close(): void;
};

const HARNESS_CHOICES = [
  { value: "generic", label: "Generic", detail: "Generate .cw agent command entries." },
  { value: "codex", label: "Codex", detail: "Generate Codex plugin skills and generic command entries." }
] as const satisfies readonly Choice<HarnessName>[];

const ENHANCEMENT_CHOICES = [
  { value: "skipped", label: "Skip", detail: "Leave this enhancement disabled for now." },
  { value: "detected", label: "Detect", detail: "Record that an existing tool was detected." },
  { value: "configured", label: "Configure", detail: "Record that this enhancement is configured." }
] as const satisfies readonly Choice<EnhancementChoice>[];

async function main(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;
  const publicArgs = parseFlags(argv.slice(1));
  const publicFlags = publicArgs.flags;
  const internalFlags = parseFlags(rest).flags;
  const root = initRoot(command, publicFlags, publicArgs.positional, internalFlags);

  try {
    switch (command) {
      case "init": {
        const prompts = createPromptSession();
        try {
          const result = await initProject(root, {
            harnesses: [await initHarness(publicFlags, prompts)],
            codeIntelligence: await initEnhancement(publicFlags, prompts, "code-intelligence", "Code intelligence"),
            externalContext: await initEnhancement(publicFlags, prompts, "external-context", "External context")
          });
          printJson(result);
          return 0;
        } finally {
          prompts?.close();
        }
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
      case "update": {
        const result = await updateProject(root, [optionalHarness(publicFlags, "harness") ?? "generic"]);
        printJson(result);
        return result.validation.ok ? 0 : 1;
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
      const dirtyWorktreeHandling = optionalDirtyWorktreeHandling(flags, "dirty-worktree");
      const gateIssues = await checkClosureGate(root, taskId, {
        summary: requiredString(flags, "summary"),
        dirtyWorktreeHandling,
        baselineDecision
      });
      if (gateIssues.length > 0) {
        throw new Error(`closure gate failed:\n${gateIssues.map((issue) => `- ${issue}`).join("\n")}`);
      }
      if (
        baselineDecision === "accepted" ||
        baselineDecision === "selected" ||
        baselineDecision === "edited" ||
        baselineDecision === "skipped"
      ) {
        await syncBaselineDelta(root, taskId, baselineDecision, {
          selectedFiles: optionalBaselineFiles(flags, "selected-files"),
          editedMarkdown: optionalString(flags, "edited-content")
        });
      }
      const task = await finishTask(root, taskId, {
        summary: requiredString(flags, "summary"),
        dirtyWorktreeHandling,
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
      const result = await syncBaselineDelta(root, taskId, requiredBaselineDecision(flags, "decision"), {
        selectedFiles: optionalBaselineFiles(flags, "selected-files"),
        editedMarkdown: optionalString(flags, "edited-content")
      });
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

function initRoot(command: string | undefined, publicFlags: Flags, publicPositionals: string[], internalFlags: Flags): string {
  if (command === "internal") {
    return String(internalFlags.root ?? process.cwd());
  }
  if (command === "init") {
    return String(publicFlags.root ?? publicPositionals[0] ?? process.cwd());
  }
  return String(publicFlags.root ?? process.cwd());
}

async function initHarness(flags: Flags, prompts: PromptSession | null): Promise<HarnessName> {
  const value = optionalHarness(flags, "harness");
  if (value !== undefined) {
    return value;
  }
  return promptChoice(prompts, "Select coding harness", HARNESS_CHOICES);
}

async function initEnhancement(
  flags: Flags,
  prompts: PromptSession | null,
  key: string,
  label: string
): Promise<EnhancementChoice> {
  const value = optionalEnhancementChoice(flags, key);
  if (value !== undefined) {
    return value;
  }
  return promptChoice(prompts, label, ENHANCEMENT_CHOICES);
}

function createPromptSession(): PromptSession | null {
  if (!isInteractive()) {
    return null;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    async choice<T extends string>(question: string, choices: readonly Choice<T>[]): Promise<T> {
      for (;;) {
        process.stdout.write(`\n${question}\n`);
        choices.forEach((choice, index) => {
          process.stdout.write(`  ${index + 1}. ${choice.label} (${choice.value}) - ${choice.detail}\n`);
        });

        const answer = (await rl.question(`Choose [1]: `)).trim();
        if (answer.length === 0) {
          return choices[0].value;
        }

        const numbered = Number(answer);
        if (Number.isInteger(numbered) && numbered >= 1 && numbered <= choices.length) {
          return choices[numbered - 1].value;
        }

        const named = choices.find((choice) => choice.value === answer);
        if (named !== undefined) {
          return named.value;
        }

        process.stdout.write(`Please choose 1-${choices.length} or one of: ${choices.map((choice) => choice.value).join(", ")}.\n`);
      }
    },
    close(): void {
      rl.close();
    }
  };
}

async function promptChoice<T extends string>(
  prompts: PromptSession | null,
  question: string,
  choices: readonly Choice<T>[]
): Promise<T> {
  return prompts === null ? choices[0].value : await prompts.choice(question, choices);
}

function isInteractive(): boolean {
  return process.env.CW_FORCE_INTERACTIVE === "1" || Boolean(process.stdin.isTTY && process.stdout.isTTY);
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
  if (value === "codex") {
    return value;
  }
  throw new Error(`--${key} must be generic or codex`);
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

function optionalDirtyWorktreeHandling(flags: Flags, key: string): DirtyWorktreeDecision | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "covered" || value === "unrelated" || value === "clean") {
    return value;
  }
  throw new Error(`--${key} must be covered, unrelated, or clean`);
}

function optionalBaselineDecision(flags: Flags, key: string): BaselineDecision | "none" | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "accepted" || value === "selected" || value === "edited" || value === "skipped" || value === "none") {
    return value;
  }
  throw new Error(`--${key} must be accepted, selected, edited, skipped, or none`);
}

function requiredBaselineDecision(flags: Flags, key: string): BaselineDecision {
  const value = requiredString(flags, key);
  if (value === "accepted" || value === "selected" || value === "edited" || value === "skipped") {
    return value;
  }
  throw new Error(`--${key} must be accepted, selected, edited, or skipped`);
}

function optionalEnhancementChoice(flags: Flags, key: string): EnhancementChoice | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "skipped" || value === "detected" || value === "configured") {
    return value;
  }
  throw new Error(`--${key} must be skipped, detected, or configured`);
}

function optionalBaselineFiles(flags: Flags, key: string): Array<"overview.md" | "architecture.md" | "rules.md" | "commands.md"> | undefined {
  const value = optionalString(flags, key);
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }
  return value.split(",").map((item) => {
    const trimmed = item.trim();
    if (trimmed === "overview.md" || trimmed === "architecture.md" || trimmed === "rules.md" || trimmed === "commands.md") {
      return trimmed;
    }
    throw new Error(`--${key} entries must be overview.md, architecture.md, rules.md, or commands.md`);
  });
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
  cw init [path] [--root <path>] [--harness generic|codex] [--code-intelligence skipped|detected|configured] [--external-context skipped|detected|configured]
  cw validate [--root <path>]
  cw doctor [--root <path>]
  cw update [--root <path>] [--harness generic|codex]
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
  cw internal finish-task --task <id> --summary <text> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none]
  cw internal discard-task --task <id> --confirm [--worktree keep|stash|revert|delete-worktree|none]
  cw internal create-resume --task <id> --content <markdown>
  cw internal ensure-baseline-delta --task <id>
  cw internal sync-baseline-delta --task <id> --decision accepted|selected|edited|skipped
  cw internal consume-resume --task <id>`);
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
