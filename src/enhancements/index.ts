import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HarnessName } from "../harness/index.js";
import { readJsonFile, writeJsonFile } from "../shared/index.js";
import { getFlowflowPaths } from "../project/index.js";
import {
  FLOWFLOW_SCHEMA_VERSION,
  EnhancementCategory,
  EnhancementChoice,
  EnhancementConfigRecord,
  EnhancementProviderRecord
} from "../domain/index.js";

export type EnhancementProviderId =
  | "skipped"
  | "codebase-memory-mcp"
  | "codegraph"
  | "graphify"
  | "codex-native-memories"
  | "claude-mem"
  | "magic-context"
  | "aft";

export type ProviderHarness = HarnessName;
export type ProviderIntrusion = "low" | "medium" | "high";
export type CodebaseMemoryMcpSetupMode = "install" | "use-existing";
export type CodebaseMemoryMcpDetection = {
  installed: boolean;
  binary_path: string | null;
  version: string | null;
  message: string;
};

export type EnhancementProvider = {
  id: Exclude<EnhancementProviderId, "skipped">;
  category: EnhancementCategory;
  label: string;
  detail: string;
  harnesses: ProviderHarness[];
  intrusion: ProviderIntrusion;
  experimental: boolean;
  notes: string[];
};

export type SetupCommand = {
  command: string;
  args: string[];
  cwd?: string;
};

export type SetupConfigPatch = {
  file_path: string;
  description: string;
  content: string;
};

export type EnhancementSetupPlan = {
  category: EnhancementCategory;
  provider_id: EnhancementProviderId;
  label: string;
  detail: string;
  intrusion: "none" | "low" | "medium" | "high";
  experimental: boolean;
  commands: SetupCommand[];
  verification: SetupCommand | null;
  config_patches: SetupConfigPatch[];
  touched_files: string[];
  notes: string[];
};

export type CommandResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export type CommandRunner = (command: SetupCommand) => Promise<CommandResult>;

export type EnhancementSetupResult = EnhancementProviderRecord;

export const ENHANCEMENT_PROVIDERS = [
  {
    id: "codebase-memory-mcp",
    category: "code_index",
    label: "codebase-memory-mcp",
    detail: "Install the local MCP code index and initialize this repository.",
    harnesses: ["codex", "claude"],
    intrusion: "medium",
    experimental: false,
    notes: [
      "Installs a local binary and configures detected coding agents.",
      "May update Codex or other agent configuration files.",
      "Restart the coding agent after setup."
    ]
  },
  {
    id: "graphify",
    category: "code_index",
    label: "Graphify",
    detail: "Experimental graph index for Codex; writes project instructions, hooks, and graph output.",
    harnesses: ["codex"],
    intrusion: "high",
    experimental: true,
    notes: [
      "Experimental provider; do not use as the default Codex code index.",
      "Installs a Python package and writes project Codex instructions and hooks.",
      "Indexing writes graphify-out/ in the repository.",
      "Uninstall may leave an empty .codex/hooks.json file.",
      "Codex usage may require [features].multi_agent = true in ~/.codex/config.toml."
    ]
  },
  {
    id: "codegraph",
    category: "code_index",
    label: "CodeGraph",
    detail: "Experimental local code graph; installs a CLI, wires Codex MCP config, and creates .codegraph/.",
    harnesses: ["codex"],
    intrusion: "medium",
    experimental: true,
    notes: [
      "Experimental provider; do not use as the default Codex code index.",
      "May update Codex MCP configuration.",
      "Creates a per-project .codegraph/ index.",
      "Records telemetry files under the user's home directory.",
      "Full Codex install and uninstall config-write flow has not been fully verified."
    ]
  },
  {
    id: "codex-native-memories",
    category: "context_memory",
    label: "Codex native memories",
    detail: "Enable built-in Codex memories in ~/.codex/config.toml.",
    harnesses: ["codex"],
    intrusion: "low",
    experimental: false,
    notes: [
      "Writes memories = true under the [features] table.",
      "Codex stores memories under the local Codex home directory."
    ]
  },
  {
    id: "claude-mem",
    category: "context_memory",
    label: "claude-mem",
    detail: "Install claude-mem for Claude Code memory capture and recall.",
    harnesses: ["claude"],
    intrusion: "high",
    experimental: false,
    notes: [
      "Runs the claude-mem installer and may modify Claude Code plugin, hook, and settings files.",
      "Requires Node.js, Bun, uv, and local SQLite storage.",
      "Restart Claude Code after setup."
    ]
  },
  {
    id: "magic-context",
    category: "context_memory",
    label: "magic-context",
    detail: "Set up model-backed context memory for OpenCode or Pi.",
    harnesses: ["opencode", "pi"],
    intrusion: "high",
    experimental: false,
    notes: [
      "Requires additional initialization and model configuration before it is useful.",
      "Changes context compression and memory behavior for the selected harness.",
      "Run the provider doctor command after configuring the LLM used for compression."
    ]
  },
  {
    id: "aft",
    category: "code_index",
    label: "AFT",
    detail: "Set up AFT for OpenCode or Pi code actions.",
    harnesses: ["opencode", "pi"],
    intrusion: "high",
    experimental: false,
    notes: [
      "Replaces built-in file and search tools with AFT-backed tools.",
      "Requires explicit initialization and harness config changes after install.",
      "Run the provider doctor command after setup."
    ]
  }
] as const satisfies readonly EnhancementProvider[];

const DEFAULT_PROVIDERS: Partial<Record<`${ProviderHarness}:${EnhancementCategory}`, EnhancementProviderId>> = {
  "codex:code_index": "codebase-memory-mcp",
  "codex:context_memory": "codex-native-memories",
  "claude:code_index": "codebase-memory-mcp",
  "claude:context_memory": "claude-mem",
  "opencode:code_index": "aft",
  "opencode:context_memory": "magic-context",
  "pi:code_index": "aft",
  "pi:context_memory": "magic-context"
};

export function defaultProviderFor(
  category: EnhancementCategory,
  harness: ProviderHarness
): EnhancementProviderId {
  return DEFAULT_PROVIDERS[`${harness}:${category}`] ?? "skipped";
}

export function providerChoicesFor(
  category: EnhancementCategory,
  harness: ProviderHarness
): Array<{ value: EnhancementProviderId; label: string; detail: string }> {
  const providers = ENHANCEMENT_PROVIDERS.filter(
    (provider) => provider.category === category && providerSupportsHarness(provider, harness)
  ).sort((left, right) => providerChoiceOrder(left, right, category, harness));
  return [
    ...providers.map((provider) => ({
      value: provider.id,
      label: providerChoiceLabel(provider),
      detail: providerChoiceDetail(provider)
    })),
    { value: "skipped", label: "Skip", detail: "Do not set this up now." }
  ];
}

export function providerById(providerId: EnhancementProviderId): EnhancementProvider | null {
  if (providerId === "skipped") {
    return null;
  }
  return ENHANCEMENT_PROVIDERS.find((provider) => provider.id === providerId) ?? null;
}

export function validateProviderSelection(
  providerId: string,
  category: EnhancementCategory,
  harness: ProviderHarness
): EnhancementProviderId {
  if (providerId === "skipped") {
    return providerId;
  }
  const provider = providerById(providerId as EnhancementProviderId);
  if (provider === null || provider.category !== category || !providerSupportsHarness(provider, harness)) {
    const allowed = providerChoicesFor(category, harness).map((choice) => choice.value).join(", ");
    throw new Error(`provider for ${category} must be one of: ${allowed}`);
  }
  return provider.id;
}

export async function buildEnhancementSetupPlan(input: {
  root: string;
  harness: ProviderHarness;
  category: EnhancementCategory;
  providerId: EnhancementProviderId;
  homeDir?: string;
  codebaseMemoryMode?: CodebaseMemoryMcpSetupMode;
  codebaseMemoryDetection?: CodebaseMemoryMcpDetection;
}): Promise<EnhancementSetupPlan> {
  if (input.providerId === "skipped") {
    return {
      category: input.category,
      provider_id: "skipped",
      label: "Skip",
      detail: "No provider setup selected.",
      intrusion: "none",
      experimental: false,
      commands: [],
      verification: null,
      config_patches: [],
      touched_files: [],
      notes: []
    };
  }

  const provider = providerById(input.providerId);
  if (provider === null || provider.category !== input.category || !providerSupportsHarness(provider, input.harness)) {
    throw new Error(`${input.providerId} is not available for ${input.category} on ${input.harness}`);
  }

  if (provider.id === "codex-native-memories") {
    return await buildCodexMemoryPlan(input.root, input.homeDir ?? os.homedir(), provider);
  }

  if (provider.id === "claude-mem") {
    return buildClaudeMemPlan(input.root, provider);
  }

  if (provider.id === "codebase-memory-mcp") {
    return buildCodebaseMemoryPlan(
      input.root,
      input.harness,
      provider,
      input.codebaseMemoryMode ?? "install",
      input.codebaseMemoryDetection
    );
  }

  if (provider.id === "codegraph") {
    return buildCodeGraphPlan(input.root, provider);
  }

  if (provider.id === "graphify") {
    return buildGraphifyPlan(input.root, provider);
  }

  if (provider.id === "magic-context") {
    return buildMagicContextPlan(input.root, input.harness, provider);
  }

  if (provider.id === "aft") {
    return buildAftPlan(input.root, input.harness, provider);
  }

  return {
    category: provider.category,
    provider_id: provider.id,
    label: provider.label,
    detail: provider.detail,
    intrusion: provider.intrusion,
    experimental: provider.experimental,
    commands: [],
    verification: null,
    config_patches: [],
    touched_files: [],
    notes: provider.notes
  };
}

export async function applyEnhancementSetup(
  root: string,
  plan: EnhancementSetupPlan,
  options: {
    confirmed: boolean;
    runner?: CommandRunner;
    now?: Date;
  }
): Promise<EnhancementSetupResult> {
  const now = options.now ?? new Date();
  const commands = plan.commands.map(commandToString);
  const touchedFiles = plan.touched_files;

  if (plan.provider_id === "skipped") {
    return await recordEnhancementSetup(root, {
      category: plan.category,
      provider_id: plan.provider_id,
      status: "skipped",
      commands,
      commands_run: [],
      touched_files: touchedFiles,
      message: "Provider setup skipped.",
      verification: null,
      updated_at: now.toISOString()
    });
  }

  if (!options.confirmed) {
    return await recordEnhancementSetup(root, {
      category: plan.category,
      provider_id: plan.provider_id,
      status: "pending",
      commands,
      commands_run: [],
      touched_files: touchedFiles,
      message: "Provider setup is pending interactive confirmation.",
      verification: plan.verification === null
        ? null
        : { command: commandToString(plan.verification), ok: false, exit_code: null },
      updated_at: now.toISOString()
    });
  }

  await readEnhancementConfig(getFlowflowPaths(root).enhancements);

  for (const patch of plan.config_patches) {
    await mkdir(path.dirname(patch.file_path), { recursive: true });
    await writeFile(patch.file_path, patch.content, "utf8");
  }

  const runner = options.runner ?? runLocalCommand;
  const commandsRun: string[] = [];
  for (const command of plan.commands) {
    commandsRun.push(commandToString(command));
    const result = await runSetupCommand(runner, command);
    if (!result.ok) {
      return await recordEnhancementSetup(root, {
        category: plan.category,
        provider_id: plan.provider_id,
        status: "failed",
        commands,
        commands_run: commandsRun,
        touched_files: touchedFiles,
        message: trimMessage(result.stderr) || trimMessage(result.stdout) || "Provider setup command failed.",
        verification: null,
        updated_at: now.toISOString()
      });
    }
  }

  let verification: EnhancementProviderRecord["verification"] = null;
  if (plan.verification !== null) {
    const verificationResult = await runSetupCommand(runner, plan.verification);
    verification = {
      command: commandToString(plan.verification),
      ok: verificationResult.ok,
      exit_code: verificationResult.exitCode
    };
    if (!verificationResult.ok) {
      return await recordEnhancementSetup(root, {
        category: plan.category,
        provider_id: plan.provider_id,
        status: "failed",
        commands,
        commands_run: commandsRun,
        touched_files: touchedFiles,
        message: trimMessage(verificationResult.stderr) || trimMessage(verificationResult.stdout) || "Provider verification failed.",
        verification,
        updated_at: now.toISOString()
      });
    }
  } else if (plan.config_patches.length > 0) {
    const verified = await verifyConfigPatches(plan.config_patches);
    verification = {
      command: "verify config patches were written",
      ok: verified,
      exit_code: verified ? 0 : 1
    };
    if (!verified) {
      return await recordEnhancementSetup(root, {
        category: plan.category,
        provider_id: plan.provider_id,
        status: "failed",
        commands,
        commands_run: commandsRun,
        touched_files: touchedFiles,
        message: "Provider config verification failed.",
        verification,
        updated_at: now.toISOString()
      });
    }
  }

  return await recordEnhancementSetup(root, {
    category: plan.category,
    provider_id: plan.provider_id,
    status: "configured",
    commands,
    commands_run: commandsRun,
    touched_files: touchedFiles,
    message: "Provider setup completed.",
    verification,
    updated_at: now.toISOString()
  });
}

export async function recordEnhancementSetup(
  root: string,
  record: EnhancementProviderRecord
): Promise<EnhancementProviderRecord> {
  const normalizedRecord = normalizeEnhancementProviderRecord(root, record);
  const enhancementsPath = getFlowflowPaths(root).enhancements;
  const config = await readEnhancementConfig(enhancementsPath);
  const next: EnhancementConfigRecord = {
    ...config,
    updated_at: normalizedRecord.updated_at,
    [normalizedRecord.category]: normalizedRecord
  };

  if (normalizedRecord.category === "code_index") {
    next.code_intelligence = legacyChoiceForSetup(normalizedRecord);
  } else {
    next.external_context = legacyChoiceForSetup(normalizedRecord);
  }

  await writeJsonFile(enhancementsPath, next);
  return normalizedRecord;
}

export function normalizeEnhancementProviderRecord(
  root: string,
  record: EnhancementProviderRecord,
  homeDir = os.homedir()
): EnhancementProviderRecord {
  return {
    ...record,
    commands: record.commands.map((command) => normalizeMetadataText(root, command, homeDir)),
    commands_run: record.commands_run.map((command) => normalizeMetadataText(root, command, homeDir)),
    touched_files: record.touched_files.map((filePath) => normalizeMetadataText(root, filePath, homeDir)),
    verification: record.verification === null
      ? null
      : {
        ...record.verification,
        command: normalizeMetadataText(root, record.verification.command, homeDir)
      }
  };
}

export async function detectCodebaseMemoryMcp(envPath = process.env.PATH ?? ""): Promise<CodebaseMemoryMcpDetection> {
  const binaryPath = await findExecutableOnPath("codebase-memory-mcp", envPath);
  if (binaryPath === null) {
    return {
      installed: false,
      binary_path: null,
      version: null,
      message: "codebase-memory-mcp was not found on PATH."
    };
  }

  const versionResult = await runSetupCommand(runLocalCommand, {
    command: binaryPath,
    args: ["--version"]
  });
  const version = trimMessage(versionResult.stdout) || trimMessage(versionResult.stderr) || null;
  return {
    installed: true,
    binary_path: binaryPath,
    version,
    message: versionResult.ok
      ? `Found codebase-memory-mcp${version === null ? "" : ` ${version}`} at ${binaryPath}.`
      : `Found codebase-memory-mcp at ${binaryPath}, but version check failed.`
  };
}

export function enableCodexMemoriesConfig(content: string): string {
  const lines = content.length === 0 ? [] : content.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }

  const featuresStart = lines.findIndex((line) => /^\s*\[features\]\s*(?:#.*)?$/.test(line));
  if (featuresStart === -1) {
    if (lines.length > 0 && lines.at(-1)?.trim() !== "") {
      lines.push("");
    }
    lines.push("[features]", "memories = true");
    return `${lines.join("\n")}\n`;
  }

  const nextSectionRelative = lines
    .slice(featuresStart + 1)
    .findIndex((line) => /^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(line));
  const featuresEnd = nextSectionRelative === -1 ? lines.length : featuresStart + 1 + nextSectionRelative;
  const memoryLine = lines
    .slice(featuresStart + 1, featuresEnd)
    .findIndex((line) => /^\s*memories\s*=/.test(line));

  if (memoryLine === -1) {
    let insertionIndex = featuresEnd;
    while (insertionIndex > featuresStart + 1 && lines[insertionIndex - 1]?.trim() === "") {
      insertionIndex -= 1;
    }
    lines.splice(insertionIndex, 0, "memories = true");
  } else {
    const index = featuresStart + 1 + memoryLine;
    const indent = lines[index]?.match(/^\s*/)?.[0] ?? "";
    lines[index] = `${indent}memories = true`;
  }

  return `${lines.join("\n")}\n`;
}

export function commandToString(command: SetupCommand): string {
  return [command.command, ...command.args].map(shellQuote).join(" ");
}

export async function runLocalCommand(command: SetupCommand): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ ok: exitCode === 0, stdout, stderr, exitCode });
    });
  });
}

async function buildCodexMemoryPlan(
  root: string,
  homeDir: string,
  provider: EnhancementProvider
): Promise<EnhancementSetupPlan> {
  const configPath = path.join(homeDir, ".codex", "config.toml");
  const existing = await readTextIfExists(configPath);
  return {
    category: provider.category,
    provider_id: provider.id,
    label: provider.label,
    detail: provider.detail,
    intrusion: provider.intrusion,
    experimental: provider.experimental,
    commands: [],
    verification: null,
    config_patches: [
      {
        file_path: configPath,
        description: "Set [features].memories = true.",
        content: enableCodexMemoriesConfig(existing ?? "")
      }
    ],
    touched_files: [configPath],
    notes: provider.notes
  };
}

function buildClaudeMemPlan(root: string, provider: EnhancementProvider): EnhancementSetupPlan {
  return {
    category: provider.category,
    provider_id: provider.id,
    label: provider.label,
    detail: provider.detail,
    intrusion: provider.intrusion,
    experimental: provider.experimental,
    commands: [
      {
        command: "npx",
        args: ["claude-mem", "install"],
        cwd: root
      }
    ],
    verification: {
      command: "npx",
      args: ["claude-mem", "--version"],
      cwd: root
    },
    config_patches: [],
    touched_files: [
      "~/.claude/plugins/",
      "~/.claude/settings.json",
      "~/.claude-mem/settings.json",
      "~/.claude-mem/"
    ],
    notes: provider.notes
  };
}

function buildCodebaseMemoryPlan(
  root: string,
  harness: ProviderHarness,
  provider: EnhancementProvider,
  mode: CodebaseMemoryMcpSetupMode,
  detection?: CodebaseMemoryMcpDetection
): EnhancementSetupPlan {
  const commands: SetupCommand[] = [];
  if (mode === "install") {
    commands.push({
      command: "bash",
      args: ["-lc", "curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash"],
      cwd: root
    });
  }
  commands.push({
    command: "codebase-memory-mcp",
    args: ["cli", "index_repository", JSON.stringify({ repo_path: root })],
    cwd: root
  });

  return {
    category: provider.category,
    provider_id: provider.id,
    label: provider.label,
    detail: codebaseMemoryPlanDetail(provider.detail, mode),
    intrusion: provider.intrusion,
    experimental: provider.experimental,
    commands,
    verification: {
      command: "codebase-memory-mcp",
      args: ["--version"],
      cwd: root
    },
    config_patches: [],
    touched_files: codebaseMemoryTouchedFiles(harness),
    notes: [...provider.notes, ...codebaseMemoryModeNotes(mode, detection)]
  };
}

function buildCodeGraphPlan(root: string, provider: EnhancementProvider): EnhancementSetupPlan {
  return {
    category: provider.category,
    provider_id: provider.id,
    label: provider.label,
    detail: provider.detail,
    intrusion: provider.intrusion,
    experimental: provider.experimental,
    commands: [
      {
        command: "npm",
        args: ["install", "-g", "@colbymchenry/codegraph"],
        cwd: root
      },
      {
        command: "codegraph",
        args: ["install", "--target=codex", "--yes"],
        cwd: root
      },
      {
        command: "codegraph",
        args: ["init", "."],
        cwd: root
      }
    ],
    verification: {
      command: "codegraph",
      args: ["status", "."],
      cwd: root
    },
    config_patches: [],
    touched_files: [
      "~/.codex/config.toml",
      ".codegraph/",
      "~/.codegraph/telemetry.json",
      "~/.codegraph/telemetry-queue.jsonl"
    ],
    notes: provider.notes
  };
}

function buildGraphifyPlan(root: string, provider: EnhancementProvider): EnhancementSetupPlan {
  return {
    category: provider.category,
    provider_id: provider.id,
    label: provider.label,
    detail: provider.detail,
    intrusion: provider.intrusion,
    experimental: provider.experimental,
    commands: [
      {
        command: "python3",
        args: ["-m", "pip", "install", "--user", "graphifyy"],
        cwd: root
      },
      {
        command: "graphify",
        args: ["codex", "install"],
        cwd: root
      },
      {
        command: "graphify",
        args: ["update", "."],
        cwd: root
      }
    ],
    verification: {
      command: "graphify",
      args: ["--version"],
      cwd: root
    },
    config_patches: [],
    touched_files: [
      "~/.codex/config.toml",
      "AGENTS.md",
      ".codex/hooks.json",
      "graphify-out/"
    ],
    notes: provider.notes
  };
}

function buildMagicContextPlan(
  root: string,
  harness: ProviderHarness,
  provider: EnhancementProvider
): EnhancementSetupPlan {
  const target = magicContextTarget(harness);
  return {
    category: provider.category,
    provider_id: provider.id,
    label: provider.label,
    detail: `${provider.detail} Target harness: ${target}.`,
    intrusion: provider.intrusion,
    experimental: provider.experimental,
    commands: [
      {
        command: "npx",
        args: ["@cortexkit/magic-context@latest", "setup", "--harness", target],
        cwd: root
      }
    ],
    verification: {
      command: "npx",
      args: ["@cortexkit/magic-context@latest", "doctor"],
      cwd: root
    },
    config_patches: [],
    touched_files: [
      ".cortexkit/magic-context.jsonc",
      ...harnessConfigFiles(target),
      "~/.local/share/cortexkit/magic-context/context.db"
    ],
    notes: provider.notes
  };
}

function buildAftPlan(
  root: string,
  harness: ProviderHarness,
  provider: EnhancementProvider
): EnhancementSetupPlan {
  const target = aftTarget(harness);
  return {
    category: provider.category,
    provider_id: provider.id,
    label: provider.label,
    detail: `${provider.detail} Target harness: ${target}.`,
    intrusion: provider.intrusion,
    experimental: provider.experimental,
    commands: [
      {
        command: "npx",
        args: ["@cortexkit/aft@latest", "setup", "--harness", target],
        cwd: root
      }
    ],
    verification: {
      command: "npx",
      args: ["@cortexkit/aft@latest", "doctor"],
      cwd: root
    },
    config_patches: [],
    touched_files: [
      ".cortexkit/aft.jsonc",
      ...harnessConfigFiles(target)
    ],
    notes: provider.notes
  };
}

function providerSupportsHarness(provider: EnhancementProvider, harness: ProviderHarness): boolean {
  return (provider.harnesses as readonly ProviderHarness[]).includes(harness);
}

function codebaseMemoryTouchedFiles(harness: ProviderHarness): string[] {
  const shared = ["~/.local/bin/codebase-memory-mcp"];
  if (harness === "claude") {
    return [...shared, "~/.claude.json", "CLAUDE.md"];
  }
  return [...shared, "~/.codex/config.toml", ".codex/AGENTS.md"];
}

function providerChoiceOrder(
  left: EnhancementProvider,
  right: EnhancementProvider,
  category: EnhancementCategory,
  harness: ProviderHarness
): number {
  const defaultProvider = defaultProviderFor(category, harness);
  if (left.id === defaultProvider && right.id !== defaultProvider) {
    return -1;
  }
  if (right.id === defaultProvider && left.id !== defaultProvider) {
    return 1;
  }
  if (left.experimental !== right.experimental) {
    return left.experimental ? 1 : -1;
  }
  return left.label.localeCompare(right.label);
}

function magicContextTarget(harness: ProviderHarness): "opencode" | "pi" {
  if (harness === "opencode" || harness === "pi") {
    return harness;
  }
  throw new Error(`magic-context is not available for ${harness}`);
}

function aftTarget(harness: ProviderHarness): "opencode" | "pi" {
  if (harness === "opencode" || harness === "pi") {
    return harness;
  }
  throw new Error(`AFT is not available for ${harness}`);
}

function harnessConfigFiles(harness: "opencode" | "pi"): string[] {
  if (harness === "opencode") {
    return ["opencode.jsonc", "~/.config/opencode/opencode.jsonc"];
  }
  return [".pi/", "~/.config/pi/"];
}

async function readEnhancementConfig(filePath: string): Promise<EnhancementConfigRecord> {
  try {
    await access(filePath);
  } catch {
    return {
      schema_version: FLOWFLOW_SCHEMA_VERSION,
      code_intelligence: "skipped",
      external_context: "skipped",
      updated_at: new Date(0).toISOString()
    };
  }

  try {
    return await readJsonFile<EnhancementConfigRecord>(filePath);
  } catch (error) {
    throw new Error(`cannot read existing enhancement config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verifyConfigPatches(patches: SetupConfigPatch[]): Promise<boolean> {
  for (const patch of patches) {
    try {
      if ((await readFile(patch.file_path, "utf8")) !== patch.content) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

async function runSetupCommand(runner: CommandRunner, command: SetupCommand): Promise<CommandResult> {
  try {
    return await runner(command);
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: null
    };
  }
}

function legacyChoiceForSetup(record: EnhancementProviderRecord): EnhancementChoice {
  return record.status === "configured" ? "configured" : "skipped";
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function trimMessage(value: string): string {
  return value.trim().split(/\r?\n/).slice(0, 3).join("\n");
}

function providerChoiceLabel(provider: EnhancementProvider): string {
  if (provider.experimental) {
    return `${provider.label} (experimental, intrusive)`;
  }
  if (provider.intrusion === "high") {
    return `${provider.label} (intrusive)`;
  }
  return provider.label;
}

function providerChoiceDetail(provider: EnhancementProvider): string {
  if (provider.experimental) {
    return `Experimental and intrusive: ${provider.detail}`;
  }
  if (provider.intrusion === "high") {
    return `Intrusive setup: ${provider.detail}`;
  }
  return provider.detail;
}

function codebaseMemoryPlanDetail(detail: string, mode: CodebaseMemoryMcpSetupMode): string {
  if (mode === "use-existing") {
    return "Use the existing codebase-memory-mcp install and index this repository.";
  }
  return detail;
}

function codebaseMemoryModeNotes(
  mode: CodebaseMemoryMcpSetupMode,
  detection: CodebaseMemoryMcpDetection | undefined
): string[] {
  const detected = detection?.installed === true
    ? [`Detected existing codebase-memory-mcp${detection.version === null ? "" : ` ${detection.version}`} at ${detection.binary_path}.`]
    : [];
  if (mode === "use-existing") {
    return [...detected, "Uses the existing install and does not run the installer."];
  }
  return detected;
}

async function findExecutableOnPath(binaryName: string, envPath: string): Promise<string | null> {
  for (const entry of envPath.split(path.delimiter)) {
    if (entry.length === 0) {
      continue;
    }
    const candidate = path.join(entry, binaryName);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function normalizeMetadataText(root: string, value: string, homeDir: string): string {
  const rootPath = path.resolve(root);
  const homePath = path.resolve(homeDir);
  return replaceAllText(replaceAllText(value, rootPath, "."), homePath, "~");
}

function replaceAllText(value: string, search: string, replacement: string): string {
  if (search.length === 0 || search === path.parse(search).root) {
    return value;
  }
  return value.split(search).join(replacement);
}
