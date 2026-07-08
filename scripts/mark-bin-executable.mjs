import { chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const binEntries = ["dist/src/cli.js", "dist/src/agent-command.js"];

await Promise.all(
  binEntries.map(async (entry) => {
    await chmod(path.join(repoRoot, entry), 0o755);
  })
);
