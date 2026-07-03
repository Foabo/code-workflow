import path from "node:path";
import { ensureDir, writeFileIfMissing } from "./fs.js";
import { getCwPaths } from "./paths.js";
import { PROJECT_BASELINE_TEMPLATES, TASK_ARTIFACT_TEMPLATES } from "./templates.js";
import { CW_SCHEMA_VERSION, VersionRecord } from "./types.js";

export type InitResult = {
  created: string[];
  existing: string[];
};

export async function initProject(root: string, now = new Date()): Promise<InitResult> {
  const paths = getCwPaths(root);
  const created: string[] = [];
  const existing: string[] = [];

  await ensureDir(paths.cw);
  await ensureDir(paths.project);
  await ensureDir(paths.tasks);
  await ensureDir(paths.templates);

  const version: VersionRecord = {
    schema_version: CW_SCHEMA_VERSION,
    cw_version: "0.1.0",
    created_at: now.toISOString()
  };

  if (await writeJsonIfMissing(paths.version, version)) {
    created.push(relative(root, paths.version));
  } else {
    existing.push(relative(root, paths.version));
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

  return { created, existing };
}

async function writeJsonIfMissing(filePath: string, value: unknown): Promise<boolean> {
  return writeFileIfMissing(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath);
}
