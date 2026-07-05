#!/usr/bin/env node
import path from "node:path";
import { runWorkflowAction, WorkflowCommandAction, WorkflowOptions } from "./workflow.js";

type Flags = Record<string, string | boolean | string[]>;

const commandName = path.basename(process.argv[1] ?? "");
const action = actionFromCommand(commandName, process.argv[2]);
const rawArgs = commandName === "agent-command.js" ? process.argv.slice(3) : process.argv.slice(2);

run(action, rawArgs).then((code) => {
  process.exitCode = code;
});

async function run(workflowAction: WorkflowCommandAction, args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const root = typeof flags.root === "string" ? flags.root : process.cwd();
  try {
    const result = await runWorkflowAction(root, workflowAction, optionsFromFlags(flags));
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function actionFromCommand(command: string, fallback: string | undefined): WorkflowCommandAction {
  const candidate = command.startsWith("cw-") ? command.slice(3) : fallback;
  if (
    candidate === "work" ||
    candidate === "clarify" ||
    candidate === "plan" ||
    candidate === "run" ||
    candidate === "check" ||
    candidate === "finish" ||
    candidate === "resume" ||
    candidate === "discard" ||
    candidate === "doctor" ||
    candidate === "understand"
  ) {
    return candidate;
  }
  throw new Error(`unknown workflow action: ${candidate ?? command}`);
}

function optionsFromFlags(flags: Flags): WorkflowOptions {
  return {
    taskId: stringFlag(flags, "task") ?? stringFlag(flags, "id"),
    title: stringFlag(flags, "title"),
    goal: stringFlag(flags, "goal"),
    scope: stringFlag(flags, "scope"),
    nonGoals: stringFlag(flags, "non-goals"),
    constraints: stringFlag(flags, "constraints"),
    decisions: stringFlag(flags, "decisions"),
    acceptance: arrayFlag(flags, "acceptance"),
    summary: stringFlag(flags, "summary"),
    note: stringFlag(flags, "note"),
    writeFile: stringFlag(flags, "write-file"),
    content: stringFlag(flags, "content"),
    commands: arrayFlag(flags, "command"),
    manualVerification: stringFlag(flags, "manual-verification"),
    baselineOutcome: stringFlag(flags, "baseline-outcome"),
    drift: flags.drift === true || flags.drift === "true",
    decision: decisionFlag(flags, "baseline") ?? decisionFlag(flags, "decision"),
    selectedBaselineFiles: baselineFilesFlag(flags, "selected-baseline"),
    editedBaselineDelta: stringFlag(flags, "edited-baseline"),
    confirmBaselineImpact: flags.confirmBaselineImpact === true || flags["confirm-baseline-impact"] === true ||
      flags.confirmBaselineImpact === "true" || flags["confirm-baseline-impact"] === "true",
    dirtyWorktree: dirtyFlag(flags, "dirty-worktree"),
    worktreeHandling: worktreeFlag(flags, "worktree"),
    confirm: flags.confirm === true || flags.confirm === "true",
    merge: flags.merge === true || flags.merge === "true"
  };
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
    const current = flags[key];
    if (current !== undefined) {
      flags[key] = Array.isArray(current) ? [...current, next] : [String(current), next];
    } else {
      flags[key] = next;
    }
    index += 1;
  }
  return { flags, positional };
}

function stringFlag(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function arrayFlag(flags: Flags, key: string): string[] | undefined {
  const value = flags[key];
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return [value];
  }
  return undefined;
}

function decisionFlag(flags: Flags, key: string): WorkflowOptions["decision"] {
  const value = stringFlag(flags, key);
  if (value === "accepted" || value === "selected" || value === "edited" || value === "skipped" || value === "none") {
    return value;
  }
  return undefined;
}

function dirtyFlag(flags: Flags, key: string): WorkflowOptions["dirtyWorktree"] {
  const value = stringFlag(flags, key);
  if (value === "covered" || value === "unrelated" || value === "clean") {
    return value;
  }
  return undefined;
}

function worktreeFlag(flags: Flags, key: string): WorkflowOptions["worktreeHandling"] {
  const value = stringFlag(flags, key);
  if (value === "keep" || value === "stash" || value === "revert" || value === "delete-worktree" || value === "none") {
    return value;
  }
  return undefined;
}

function baselineFilesFlag(flags: Flags, key: string): WorkflowOptions["selectedBaselineFiles"] {
  return arrayFlag(flags, key)?.map((value) => {
    if (value === "overview.md" || value === "architecture.md" || value === "rules.md" || value === "commands.md") {
      return value;
    }
    throw new Error(`--${key} must be one of overview.md, architecture.md, rules.md, commands.md`);
  });
}
