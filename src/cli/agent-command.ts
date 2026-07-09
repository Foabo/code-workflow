#!/usr/bin/env node
import path from "node:path";
import { runWorkflowAction, WorkflowCommandAction, WorkflowOptions } from "../workflow/index.js";
import { hasHelpFlag, renderWorkflowCommandHelp, renderWorkflowOverviewHelp } from "./help.js";

type Flags = Record<string, string | boolean | string[]>;

export async function main(argv = process.argv): Promise<number> {
  const commandName = path.basename(argv[1] ?? "");
  if (commandName === "agent-command.js" && argv[2] === "--help") {
    console.log(renderWorkflowOverviewHelp());
    return 0;
  }
  const action = actionFromCommand(commandName, argv[2]);
  const rawArgs = commandName === "agent-command.js" ? argv.slice(3) : argv.slice(2);
  if (hasHelpFlag(rawArgs)) {
    const help = renderWorkflowCommandHelp(action);
    if (help === null) {
      console.log(renderWorkflowOverviewHelp());
      return 1;
    }
    console.log(help);
    return 0;
  }
  return await run(action, rawArgs);
}

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
  const candidate = command.startsWith("ff-") ? command.slice(3) : fallback;
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
    merge: flags.merge === true || flags.merge === "true",
    attemptId: stringFlag(flags, "attempt-id"),
    proposalId: stringFlag(flags, "proposal-id")
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
