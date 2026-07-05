import path from "node:path";
import { AdapterResult, generateAdapter, HarnessName } from "./adapters.js";
import { ensureDir, writeFileIfMissing } from "./fs.js";
import { defaultOrchestrationConfig } from "./orchestration.js";
import { getCwPaths } from "./paths.js";
import { PROJECT_BASELINE_TEMPLATES, TASK_ARTIFACT_TEMPLATES } from "./templates.js";
import { CW_SCHEMA_VERSION, EnhancementChoice, EnhancementConfigRecord, VersionRecord } from "./types.js";

export type InitResult = {
  created: string[];
  existing: string[];
  adapters: Array<{
    harness: AdapterResult["harness"];
    created: string[];
    existing: string[];
  }>;
};

export type InitOptions = {
  harnesses?: HarnessName[];
  codeIntelligence?: EnhancementChoice;
  externalContext?: EnhancementChoice;
  now?: Date;
};

type NormalizedInitOptions = {
  harnesses: HarnessName[];
  codeIntelligence: EnhancementChoice;
  externalContext: EnhancementChoice;
  now: Date;
};

export async function initProject(root: string, options: InitOptions | Date = {}): Promise<InitResult> {
  const normalized = normalizeOptions(options);
  const paths = getCwPaths(root);
  const created: string[] = [];
  const existing: string[] = [];
  const adapters: InitResult["adapters"] = [];

  await ensureDir(paths.cw);
  await ensureDir(paths.project);
  await ensureDir(paths.tasks);
  await ensureDir(paths.templates);

  const version: VersionRecord = {
    schema_version: CW_SCHEMA_VERSION,
    cw_version: "0.1.0",
    created_at: normalized.now.toISOString()
  };

  if (await writeJsonIfMissing(paths.version, version)) {
    created.push(relative(root, paths.version));
  } else {
    existing.push(relative(root, paths.version));
  }

  const enhancements: EnhancementConfigRecord = {
    schema_version: CW_SCHEMA_VERSION,
    code_intelligence: normalized.codeIntelligence,
    external_context: normalized.externalContext,
    updated_at: normalized.now.toISOString()
  };

  if (await writeJsonIfMissing(paths.enhancements, enhancements)) {
    created.push(relative(root, paths.enhancements));
  } else {
    existing.push(relative(root, paths.enhancements));
  }

  if (await writeJsonIfMissing(paths.orchestration, defaultOrchestrationConfig(normalized.now))) {
    created.push(relative(root, paths.orchestration));
  } else {
    existing.push(relative(root, paths.orchestration));
  }

  for (const [fileName, content] of Object.entries(PROJECT_BASELINE_TEMPLATES)) {
    const filePath = path.join(paths.project, fileName);
    if (await writeFileIfMissing(filePath, content)) {
      created.push(relative(root, filePath));
    } else {
      existing.push(relative(root, filePath));
    }
  }

  for (const [fileName, content] of Object.entries(TASK_ARTIFACT_TEMPLATES)) {
    const filePath = path.join(paths.templates, fileName);
    if (await writeFileIfMissing(filePath, content)) {
      created.push(relative(root, filePath));
    } else {
      existing.push(relative(root, filePath));
    }
  }

  for (const harness of normalized.harnesses) {
    adapters.push(await generateAdapter(root, harness));
  }

  return { created, existing, adapters };
}

async function writeJsonIfMissing(filePath: string, value: unknown): Promise<boolean> {
  return writeFileIfMissing(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath);
}

function normalizeOptions(options: InitOptions | Date): NormalizedInitOptions {
  if (options instanceof Date) {
    return { harnesses: [], codeIntelligence: "skipped", externalContext: "skipped", now: options };
  }
  return {
    harnesses: options.harnesses ?? [],
    codeIntelligence: options.codeIntelligence ?? "skipped",
    externalContext: options.externalContext ?? "skipped",
    now: options.now ?? new Date()
  };
}
