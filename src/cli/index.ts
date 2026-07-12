#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { readFile } from "node:fs/promises";
import {
  applyEnhancementSetup,
  buildEnhancementSetupPlan,
  CodebaseMemoryMcpDetection,
  CodebaseMemoryMcpSetupMode,
  commandToString,
  defaultProviderFor,
  detectCodebaseMemoryMcp,
  EnhancementProviderId,
  providerChoicesFor,
  runLocalCommand,
  SetupCommand,
  validateProviderSelection
} from "../enhancements/index.js";
import { ClarifyGateStage, latestProposalIdentity, proposalHash, proposalIdFromHash, readTraceEvents, validateClarifyGate } from "../workflow/index.js";
import { initProject } from "../project/index.js";
import { preflight, WorkflowAction } from "../workflow/index.js";
import { listTasks, selectTask } from "../tasks/index.js";
import {
  appendTrace,
  assertCodeContext,
  buildWorkPacketObserved,
  checkClosureGate,
  consumeResumeNote,
  createResumeNote,
  createTask,
  discardTask,
  finishTask,
  migrateTasks,
  parseWorkPacketRole,
  refreshContextPackage,
  toWorkPacketHandoff,
  updateTaskState
} from "../tasks/index.js";
import { resolveTaskReference } from "../tasks/index.js";
import { doctorProject, validateProject } from "../project/index.js";
import {
  DirtyWorktreeDecision,
  EnhancementCategory,
  EnhancementChoice,
  EnhancementProviderRecord,
  EnhancementSetupStatus,
  TaskLifecycle,
  TraceEvent
} from "../domain/index.js";
import { HarnessName } from "../harness/index.js";
import { BaselineDecision, ensureBaselineDelta, syncBaselineDelta } from "../baseline/index.js";
import { updateProject } from "../harness/index.js";
import {
  renderGlobalHelp,
  renderInternalHelperHelp,
  renderInternalOverviewHelp,
  renderTopLevelCommandHelp
} from "./help.js";

type Flags = Record<string, string | boolean>;
type Choice<T extends string> = {
  value: T;
  label: string;
  detail: string;
};
type PromptSession = {
  choice<T extends string>(question: string, choices: readonly Choice<T>[]): Promise<T>;
  confirm(question: string, defaultValue?: boolean): Promise<boolean>;
  close(): void;
};
type InitEnhancementSelection = {
  category: EnhancementCategory;
  providerId: EnhancementProviderId;
  codebaseMemoryMode?: CodebaseMemoryMcpSetupMode;
  codebaseMemoryDetection?: CodebaseMemoryMcpDetection;
  legacyChoice: EnhancementChoice;
  legacyOnly: boolean;
};
type ProviderPromptValue =
  | EnhancementProviderId
  | "codebase-memory-mcp:existing";
type PiSubagentsSelection = "install" | "skipped";
type PiSubagentsSetupRecord = {
  category: "agent_orchestration";
  provider_id: "pi-subagents";
  status: EnhancementSetupStatus;
  commands: string[];
  commands_run: string[];
  touched_files: string[];
  message: string;
  verification: {
    command: string;
    ok: boolean;
    exit_code: number | null;
  } | null;
  updated_at: string;
};
type InitSetupRecord = EnhancementProviderRecord | PiSubagentsSetupRecord;

const HARNESS_CHOICES = [
  { value: "codex", label: "Codex", detail: "Generate repo-local agent skills." },
  { value: "claude", label: "Claude", detail: "Generate repo-local Claude skills." },
  { value: "opencode", label: "OpenCode", detail: "Generate repo-local agent skills." },
  { value: "pi", label: "Pi", detail: "Generate repo-local agent skills." },
  { value: "cursor", label: "Cursor", detail: "Generate repo-local agent skills and Cursor agents." }
] as const satisfies readonly Choice<HarnessName>[];

export async function main(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;
  const publicArgs = parseFlags(argv.slice(1));
  const publicFlags = publicArgs.flags;
  const internalFlags = parseFlags(rest).flags;
  const root = initRoot(command, publicFlags, publicArgs.positional, internalFlags);

  try {
    if (command === undefined || command === "--help") {
      console.log(renderGlobalHelp());
      return 0;
    }
    if (command !== "internal" && flagEnabled(publicFlags, "help")) {
      const help = renderTopLevelCommandHelp(command);
      if (help === null) {
        printUsage();
        return 1;
      }
      console.log(help);
      return 0;
    }

    switch (command) {
      case "init": {
        const prompts = flagEnabled(publicFlags, "yes") ? null : createPromptSession();
        try {
          const harness = await initHarness(publicFlags, prompts);
          const codeIndex = await initProvider(
            publicFlags,
            prompts,
            "code-index",
            "code-intelligence",
            "Code index tool",
            "code_index",
            harness
          );
          const contextMemory = await initProvider(
            publicFlags,
            prompts,
            "context-memory",
            "external-context",
            "Context memory tool",
            "context_memory",
            harness
          );
          const piSubagents = initPiSubagents(publicFlags, harness);
          const result = await initProject(root, {
            harnesses: [harness],
            codeIntelligence: codeIndex.legacyChoice,
            externalContext: contextMemory.legacyChoice
          });
          const setup = await runInitSetup(root, harness, [codeIndex, contextMemory], prompts, piSubagents);
          printJson({ ...result, setup });
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
        const result = await updateProject(root, [optionalHarness(publicFlags, "harness") ?? "codex"], {
          force: flagEnabled(publicFlags, "force")
        });
        printJson(result);
        return result.validation.ok ? 0 : 1;
      }
      case "tasks": {
        const scope = flagEnabled(publicFlags, "all") ? "all" : flagEnabled(publicFlags, "archived") ? "archived" : "active";
        printJson({ tasks: await listTasks(root, { scope }) });
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

  if (subcommand === undefined || subcommand === "--help" || flagEnabled(flags, "help")) {
    if (subcommand === undefined || subcommand === "--help") {
      console.log(renderInternalOverviewHelp());
      return 0;
    }
    const help = renderInternalHelperHelp(subcommand);
    if (help === null) {
      printInternalUsage();
      return 1;
    }
    console.log(help);
    return 0;
  }

  switch (subcommand) {
    case "create-task": {
      const title = requiredString(flags, "title");
      const task = await createTask(root, {
        id: optionalString(flags, "id"),
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
      const taskId = await requiredActiveTaskId(root, flags);
      const event: TraceEvent = {
        ts: optionalString(flags, "ts") ?? new Date().toISOString(),
        type: requiredString(flags, "type"),
        summary: requiredString(flags, "summary"),
        data: optionalJsonObject(flags, "data-json")
      };
      await appendTrace(root, taskId, event);
      printJson({ ok: true });
      return 0;
    }
    case "validate-clarify": {
      let task: Awaited<ReturnType<typeof selectTask>> | null = null;
      try {
        task = await selectTask(root, { taskId: optionalString(flags, "task") });
      } catch (error) {
        if (flagEnabled(flags, "watchdog")) {
          printJson({ ok: true, skipped: true, reason: error instanceof Error ? error.message : String(error) });
          return 0;
        }
        throw error;
      }
      const stage = flagEnabled(flags, "watchdog")
        ? "watchdog"
        : optionalClarifyGateStage(flags, "stage") ?? "advance";
      const report = validateClarifyGate({
        task,
        events: await readTraceEvents(root, task.id),
        stage,
        attemptId: optionalString(flags, "attempt-id"),
        proposalId: optionalString(flags, "proposal-id"),
        proposalHash: optionalString(flags, "proposal-hash")
      });
      printJson(report);
      return report.ok ? 0 : 1;
    }
    case "set-state": {
      const taskId = await requiredActiveTaskId(root, flags);
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
      const taskId = await requiredActiveTaskId(root, flags);
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
      const taskId = await requiredActiveTaskId(root, flags);
      await discardTask(root, taskId, {
        confirmed: flags.confirm === true || flags.confirm === "true",
        worktreeHandling: optionalDiscardWorktreeHandling(flags, "worktree") ?? "none"
      });
      printJson({ ok: true });
      return 0;
    }
    case "create-resume": {
      const taskId = await requiredActiveTaskId(root, flags);
      const content = requiredString(flags, "content");
      const task = await createResumeNote(root, taskId, content, optionalNullableString(flags, "resume-condition"));
      printJson(task);
      return 0;
    }
    case "ensure-baseline-delta": {
      const taskId = await requiredActiveTaskId(root, flags);
      const task = await ensureBaselineDelta(root, taskId);
      printJson(task);
      return 0;
    }
    case "sync-baseline-delta": {
      const taskId = await requiredActiveTaskId(root, flags);
      const result = await syncBaselineDelta(root, taskId, requiredBaselineDecision(flags, "decision"), {
        selectedFiles: optionalBaselineFiles(flags, "selected-files"),
        editedMarkdown: optionalString(flags, "edited-content")
      });
      printJson(result);
      return 0;
    }
    case "consume-resume": {
      const taskId = await requiredActiveTaskId(root, flags);
      const task = await consumeResumeNote(root, taskId);
      printJson(task);
      return 0;
    }
    case "build-work-packet": {
      const taskId = await requiredActiveTaskId(root, flags);
      const role = parseWorkPacketRole(requiredString(flags, "role"));
      const codeContextFile = optionalString(flags, "code-context-file");
      let codeContext;
      if (codeContextFile !== undefined) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(await readFile(codeContextFile, "utf8"));
        } catch (error) {
          throw new Error(`code context file could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
        }
        assertCodeContext(parsed, "code context file");
        codeContext = parsed;
      }
      const packet = await buildWorkPacketObserved(root, taskId, { role, codeContext });
      printJson(toWorkPacketHandoff(packet));
      return 0;
    }
    case "refresh-context-package": {
      const taskId = await requiredActiveTaskId(root, flags);
      const result = await refreshContextPackage(root, taskId);
      printJson(result);
      return 0;
    }
    case "migrate-task-ids": {
      const result = await migrateTasks(root);
      printJson(result);
      return 0;
    }
    case "propose-spec": {
      const taskId = await requiredActiveTaskId(root, flags);
      const specFile = requiredString(flags, "spec-file");
      const content = await readFile(specFile, "utf8");
      const hash = proposalHash(content);
      const proposalId = proposalIdFromHash(hash);
      const attemptId = `a-${Date.now().toString(36)}-${hash.slice(0, 8)}`;
      const identityData = { attempt_id: attemptId, proposal_id: proposalId, proposal_hash: hash };
      const summary = `Proposed spec recorded from ${specFile}.`;
      await appendTrace(root, taskId, { ts: new Date().toISOString(), type: "brainstorm.done", summary: "Brainstorm Pass complete; propose-spec recorded proposal identity.", data: identityData });
      await appendTrace(root, taskId, { ts: new Date().toISOString(), type: "spec.proposed", summary, data: identityData });
      printJson({ ok: true, identity: { attemptId, proposalId, proposalHash: hash } });
      return 0;
    }
    case "accept-spec": {
      const taskId = await requiredActiveTaskId(root, flags);
      const advisorUnavailable = flagEnabled(flags, "advisor-unavailable");
      const verdict = optionalString(flags, "verdict");
      if (advisorUnavailable && verdict !== undefined) {
        throw new Error("accept-spec: --advisor-unavailable and --verdict are mutually exclusive");
      }
      if (!advisorUnavailable && verdict === undefined) {
        throw new Error("accept-spec: --verdict is required (or pass --advisor-unavailable for the fallback path)");
      }
      if (verdict !== undefined && verdict !== "pass" && verdict !== "concern" && verdict !== "blocker") {
        throw new Error(`accept-spec: --verdict must be pass, concern, or blocker (got ${verdict})`);
      }
      const events = await readTraceEvents(root, taskId);
      const identity = latestProposalIdentity(events);
      if (identity === null) {
        throw new Error("accept-spec: no current spec.proposed event with valid identity in the trace; run propose-spec first");
      }
      const identityData = { attempt_id: identity.attemptId, proposal_id: identity.proposalId, proposal_hash: identity.proposalHash };
      if (advisorUnavailable) {
        const harness = requiredString(flags, "harness");
        const failureReason = requiredString(flags, "failure-reason");
        const fallbackChecklistResult = requiredString(flags, "fallback-checklist-result");
        await appendTrace(root, taskId, { ts: new Date().toISOString(), type: "advisor.unavailable", summary: "Advisor unavailable; degraded checklist recorded.", data: { ...identityData, attempted: true, harness, failure_reason: failureReason, fallback_checklist_result: fallbackChecklistResult } });
      } else {
        const advisorData: Record<string, unknown> = { ...identityData, verdict };
        if (flagEnabled(flags, "concerns-resolved")) {
          advisorData.concerns_resolved = true;
        }
        const deferredReason = optionalString(flags, "deferred-reason");
        if (deferredReason !== undefined) {
          advisorData.deferred_reason = deferredReason;
        }
        if (flagEnabled(flags, "user-risk-acceptance")) {
          advisorData.user_risk_acceptance = true;
        }
        if (flagEnabled(flags, "blockers-resolved")) {
          advisorData.blockers_resolved = true;
        }
        if (flagEnabled(flags, "user-override")) {
          advisorData.user_override = true;
        }
        if (verdict === "concern" && !advisorData.concerns_resolved && advisorData.deferred_reason === undefined && !advisorData.user_risk_acceptance) {
          throw new Error("accept-spec: --verdict concern requires --concerns-resolved, --deferred-reason, or --user-risk-acceptance");
        }
        if (verdict === "blocker" && !advisorData.blockers_resolved && !advisorData.user_override) {
          throw new Error("accept-spec: --verdict blocker requires --blockers-resolved or --user-override");
        }
        await appendTrace(root, taskId, { ts: new Date().toISOString(), type: "advisor.reviewed", summary: `Advisor review recorded (verdict ${verdict}).`, data: advisorData });
      }
      await appendTrace(root, taskId, { ts: new Date().toISOString(), type: "spec.accepted", summary: "Spec explicitly accepted via accept-spec.", data: { ...identityData, explicit: true } });
      printJson({ ok: true, identity: { attemptId: identity.attemptId, proposalId: identity.proposalId, proposalHash: identity.proposalHash } });
      return 0;
    }
    default:
      printInternalUsage();
      return 1;
  }
}

async function requiredActiveTaskId(root: string, flags: Flags): Promise<string> {
  return (await resolveTaskReference(root, requiredString(flags, "task"), "active")).id;
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

async function initProvider(
  flags: Flags,
  prompts: PromptSession | null,
  key: string,
  legacyKey: string,
  label: string,
  category: EnhancementCategory,
  harness: HarnessName
): Promise<InitEnhancementSelection> {
  const explicit = optionalProviderSelection(flags, key, legacyKey, category, harness);
  if (explicit !== undefined) {
    return explicit;
  }
  if (prompts === null) {
    return defaultProviderSelection(category, harness);
  }
  const prompt = await providerPromptChoices(category, harness);
  const value = await promptChoice(prompts, label, prompt.choices);
  return providerSelectionFromPromptValue(value, category, harness, prompt.codebaseMemoryDetection);
}

async function runInitSetup(
  root: string,
  harness: HarnessName,
  selections: InitEnhancementSelection[],
  prompts: PromptSession | null,
  piSubagents: PiSubagentsSelection
): Promise<InitSetupRecord[]> {
  const results: InitSetupRecord[] = [];
  if (harness === "pi") {
    results.push(await setupPiSubagents(root, piSubagents, prompts));
  }
  for (const selection of selections) {
    if (selection.legacyOnly) {
      results.push({
        category: selection.category,
        provider_id: "legacy-configured",
        status: selection.legacyChoice === "skipped" ? "skipped" : "configured",
        commands: [],
        commands_run: [],
        touched_files: [],
        message: "Legacy enhancement flag accepted; no provider setup was run.",
        verification: null,
        updated_at: new Date().toISOString()
      });
      continue;
    }

    const plan = await buildEnhancementSetupPlan({
      root,
      harness,
      category: selection.category,
      providerId: selection.providerId,
      codebaseMemoryMode: selection.codebaseMemoryMode,
      codebaseMemoryDetection: selection.codebaseMemoryDetection
    });
    const confirmed = await confirmSetupPlan(plan, prompts);
    results.push(await applyEnhancementSetup(root, plan, { confirmed }));
  }
  return results;
}

async function setupPiSubagents(
  root: string,
  selection: PiSubagentsSelection,
  prompts: PromptSession | null
): Promise<PiSubagentsSetupRecord> {
  const command: SetupCommand = { command: "pi", args: ["install", "npm:pi-subagents"], cwd: root };
  const commandText = commandToString(command);
  const now = new Date().toISOString();
  const touchedFiles = [".pi/agents/", "Pi package registry"];

  if (selection === "skipped") {
    return {
      category: "agent_orchestration",
      provider_id: "pi-subagents",
      status: "skipped",
      commands: [commandText],
      commands_run: [],
      touched_files: touchedFiles,
      message: "Pi subagents setup skipped.",
      verification: null,
      updated_at: now
    };
  }

  if (prompts !== null) {
    process.stdout.write("\nPi subagents setup preview\n");
    process.stdout.write("Category: agent_orchestration\n");
    process.stdout.write("Intrusion: low\n");
    process.stdout.write("Commands:\n");
    process.stdout.write(`  - ${commandText}\n`);
    const confirmed = await prompts.confirm("Install pi-subagents now?", true);
    if (!confirmed) {
      return {
        category: "agent_orchestration",
        provider_id: "pi-subagents",
        status: "skipped",
        commands: [commandText],
        commands_run: [],
        touched_files: touchedFiles,
        message: "Pi subagents setup skipped by user.",
        verification: null,
        updated_at: now
      };
    }
  }

  try {
    const result = await runLocalCommand(command);
    return {
      category: "agent_orchestration",
      provider_id: "pi-subagents",
      status: result.ok ? "configured" : "failed",
      commands: [commandText],
      commands_run: [commandText],
      touched_files: touchedFiles,
      message: result.ok
        ? "pi-subagents installed."
        : trimSetupMessage(result.stderr) || trimSetupMessage(result.stdout) || "pi-subagents install command failed.",
      verification: {
        command: commandText,
        ok: result.ok,
        exit_code: result.exitCode
      },
      updated_at: now
    };
  } catch (error) {
    return {
      category: "agent_orchestration",
      provider_id: "pi-subagents",
      status: "failed",
      commands: [commandText],
      commands_run: [commandText],
      touched_files: touchedFiles,
      message: error instanceof Error ? error.message : String(error),
      verification: {
        command: commandText,
        ok: false,
        exit_code: null
      },
      updated_at: now
    };
  }
}

function trimSetupMessage(value: string): string {
  return value.trim().split(/\r?\n/).filter((line) => line.trim().length > 0).slice(-1)[0]?.trim() ?? "";
}

async function confirmSetupPlan(
  plan: Awaited<ReturnType<typeof buildEnhancementSetupPlan>>,
  prompts: PromptSession | null
): Promise<boolean> {
  if (plan.provider_id === "skipped") {
    return false;
  }
  if (prompts === null) {
    return false;
  }
  printSetupPlan(plan);
  return await prompts.confirm(`Apply ${plan.label} setup now?`, false);
}

function printSetupPlan(plan: Awaited<ReturnType<typeof buildEnhancementSetupPlan>>): void {
  process.stdout.write(`\n${plan.label} setup preview\n`);
  process.stdout.write(`Category: ${plan.category}\n`);
  process.stdout.write(`Intrusion: ${plan.intrusion}\n`);
  if (plan.experimental) {
    process.stdout.write("Experimental: yes\n");
  }
  if (plan.notes.length > 0) {
    process.stdout.write("Notes:\n");
    plan.notes.forEach((note) => {
      process.stdout.write(`  - ${note}\n`);
    });
  }
  if (plan.touched_files.length > 0) {
    process.stdout.write("Files that may change:\n");
    plan.touched_files.forEach((filePath) => {
      process.stdout.write(`  - ${filePath}\n`);
    });
  }
  if (plan.config_patches.length > 0) {
    process.stdout.write("Config patches:\n");
    plan.config_patches.forEach((patch) => {
      process.stdout.write(`  - ${patch.file_path}: ${patch.description}\n`);
    });
  }
  if (plan.commands.length > 0) {
    process.stdout.write("Commands:\n");
    plan.commands.forEach((command) => {
      process.stdout.write(`  - ${commandToString(command)}\n`);
    });
  }
  if (plan.verification !== null) {
    process.stdout.write(`Verification: ${commandToString(plan.verification)}\n`);
  }
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
          process.stdout.write(`  ${index + 1}. ${choice.label} - ${choice.detail}\n`);
        });

        const answer = (await rl.question(`Choose [1]: `)).trim();
        if (answer.length === 0) {
          return choices[0].value;
        }

        const numbered = Number(answer);
        if (Number.isInteger(numbered) && numbered >= 1 && numbered <= choices.length) {
          return choices[numbered - 1].value;
        }

        const named = choices.find((choice) => choice.value === answer || choice.label.toLowerCase() === answer.toLowerCase());
        if (named !== undefined) {
          return named.value;
        }

        process.stdout.write(`Please choose 1-${choices.length} or one of: ${choices.map((choice) => choice.value).join(", ")}.\n`);
      }
    },
    async confirm(question: string, defaultValue = false): Promise<boolean> {
      const suffix = defaultValue ? "Y/n" : "y/N";
      for (;;) {
        const answer = (await rl.question(`${question} [${suffix}]: `)).trim().toLowerCase();
        if (answer.length === 0) {
          return defaultValue;
        }
        if (answer === "y" || answer === "yes") {
          return true;
        }
        if (answer === "n" || answer === "no") {
          return false;
        }
        process.stdout.write("Please answer yes or no.\n");
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

function flagEnabled(flags: Flags, key: string): boolean {
  const value = flags[key];
  return value === true || value === "true" || value === "1";
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

function optionalJsonObject(flags: Flags, key: string): Record<string, unknown> | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--${key} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function optionalClarifyGateStage(flags: Flags, key: string): ClarifyGateStage | undefined {
  const value = optionalString(flags, key);
  if (value === undefined) {
    return undefined;
  }
  if (value === "proposal" || value === "accept" || value === "advance" || value === "watchdog") {
    return value;
  }
  throw new Error(`--${key} must be proposal, accept, advance, or watchdog`);
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
  if (value === "codex" || value === "claude" || value === "opencode" || value === "pi" || value === "cursor") {
    return value;
  }
  throw new Error(`--${key} must be codex, claude, opencode, pi, or cursor`);
}

function initPiSubagents(flags: Flags, harness: HarnessName): PiSubagentsSelection {
  const value = optionalString(flags, "pi-subagents");
  if (value === undefined) {
    return harness === "pi" ? "install" : "skipped";
  }
  if (harness !== "pi") {
    throw new Error("--pi-subagents is only available with --harness pi");
  }
  if (value === "install" || value === "skipped") {
    return value;
  }
  throw new Error("--pi-subagents must be install or skipped");
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

function optionalProviderSelection(
  flags: Flags,
  key: string,
  legacyKey: string,
  category: EnhancementCategory,
  harness: HarnessName
): InitEnhancementSelection | undefined {
  const value = optionalString(flags, key);
  if (value !== undefined) {
    return providerSelectionFromValue(value, key, category, harness);
  }

  const legacyValue = optionalString(flags, legacyKey);
  if (legacyValue !== undefined) {
    return providerSelectionFromValue(legacyValue, legacyKey, category, harness);
  }

  return undefined;
}

function providerSelectionFromValue(
  value: string,
  key: string,
  category: EnhancementCategory,
  harness: HarnessName
): InitEnhancementSelection {
  if (value === "configured" || (key !== "code-index" && key !== "context-memory" && value === "detected")) {
    return { category, providerId: "skipped", legacyChoice: value as EnhancementChoice, legacyOnly: true };
  }
  const codebaseMode = codebaseMemoryModeFromValue(value, category);
  if (codebaseMode !== null) {
    return {
      category,
      providerId: "codebase-memory-mcp",
      codebaseMemoryMode: codebaseMode,
      legacyChoice: "skipped",
      legacyOnly: false
    };
  }
  const providerId = validateProviderSelection(value, category, harness);
  return {
    category,
    providerId,
    legacyChoice: "skipped",
    legacyOnly: false
  };
}

async function providerPromptChoices(
  category: EnhancementCategory,
  harness: HarnessName
): Promise<{ choices: Choice<ProviderPromptValue>[]; codebaseMemoryDetection?: CodebaseMemoryMcpDetection }> {
  const choices = providerChoicesFor(category, harness) as Choice<ProviderPromptValue>[];
  if (category !== "code_index" || (harness !== "codex" && harness !== "claude")) {
    return { choices };
  }

  const detection = await detectCodebaseMemoryMcp();
  if (!detection.installed) {
    return { choices };
  }

  const experimentalChoices = choices.filter((choice) => choice.value !== "codebase-memory-mcp" && choice.value !== "skipped");
  return {
    codebaseMemoryDetection: detection,
    choices: [
      {
        value: "codebase-memory-mcp",
        label: "codebase-memory-mcp (installed)",
        detail: `${detection.version ?? "existing install"} found; use it and index this repository.`
      },
      ...experimentalChoices,
      { value: "skipped", label: "Skip", detail: "Do not set this up now." }
    ]
  };
}

function providerSelectionFromPromptValue(
  value: ProviderPromptValue,
  category: EnhancementCategory,
  harness: HarnessName,
  codebaseMemoryDetection: CodebaseMemoryMcpDetection | undefined
): InitEnhancementSelection {
  if (value === "codebase-memory-mcp" && codebaseMemoryDetection?.installed === true) {
    return {
      category,
      providerId: "codebase-memory-mcp",
      codebaseMemoryMode: "use-existing",
      codebaseMemoryDetection,
      legacyChoice: "skipped",
      legacyOnly: false
    };
  }
  const codebaseMode = codebaseMemoryModeFromValue(value, category);
  if (codebaseMode !== null) {
    return {
      category,
      providerId: "codebase-memory-mcp",
      codebaseMemoryMode: codebaseMode,
      codebaseMemoryDetection,
      legacyChoice: "skipped",
      legacyOnly: false
    };
  }
  const providerId = validateProviderSelection(value, category, harness);
  return {
    category,
    providerId,
    legacyChoice: "skipped",
    legacyOnly: false
  };
}

function defaultProviderSelection(category: EnhancementCategory, harness: HarnessName): InitEnhancementSelection {
  return {
    category,
    providerId: defaultProviderFor(category, harness),
    legacyChoice: "skipped",
    legacyOnly: false
  };
}

function codebaseMemoryModeFromValue(value: string, category: EnhancementCategory): CodebaseMemoryMcpSetupMode | null {
  if (category !== "code_index") {
    return null;
  }
  if (value === "codebase-memory-mcp:existing") {
    return "use-existing";
  }
  return null;
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
  console.log(renderGlobalHelp());
}

function printInternalUsage(): void {
  console.log(renderInternalOverviewHelp());
}
