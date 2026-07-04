import { generateAdapter, HarnessName } from "./adapters.js";
import { validateProject } from "./validate.js";
import { ValidationIssue } from "./types.js";

export type UpdateResult = {
  adapters: Awaited<ReturnType<typeof generateAdapter>>[];
  validation: {
    ok: boolean;
    issues: ValidationIssue[];
  };
};

export async function updateProject(root: string, harnesses: HarnessName[] = ["codex"]): Promise<UpdateResult> {
  const adapters = [];
  for (const harness of harnesses) {
    adapters.push(await generateAdapter(root, harness, { overwrite: true }));
  }
  const issues = await validateProject(root);
  return {
    adapters,
    validation: {
      ok: issues.length === 0,
      issues
    }
  };
}
