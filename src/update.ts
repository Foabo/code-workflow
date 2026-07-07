import { generateAdapter, HarnessName } from "./adapters.js";
import { validateProject } from "./validate.js";
import { ValidationIssue } from "./types.js";

export type UpdateResult = {
  adapters: Awaited<ReturnType<typeof generateAdapter>>[];
  validation: {
    ok: boolean;
    issues: ValidationIssue[];
  };
  restart_notice: string | null;
};

export type UpdateOptions = {
  force?: boolean;
};

export async function updateProject(
  root: string,
  harnesses: HarnessName[] = ["codex"],
  options: UpdateOptions = {}
): Promise<UpdateResult> {
  const adapters = [];
  for (const harness of harnesses) {
    adapters.push(await generateAdapter(root, harness, { overwrite: true, force: options.force === true }));
  }
  const issues = await validateProject(root);
  const ok = issues.length === 0;
  return {
    adapters,
    validation: {
      ok,
      issues
    },
    restart_notice: ok ? restartNotice(harnesses) : null
  };
}

function restartNotice(harnesses: HarnessName[]): string {
  const names = [...new Set(harnesses)].map(harnessNoticeName);
  const target = names.length === 1 ? `${names[0]} agent` : `${names.join(", ")} agents`;
  return `Restart or reload your ${target} so refreshed Flowflow skills and role agents are picked up by the host.`;
}

function harnessNoticeName(harness: HarnessName): string {
  if (harness === "opencode") {
    return "OpenCode";
  }
  if (harness === "pi") {
    return "Pi";
  }
  return harness[0].toUpperCase() + harness.slice(1);
}
