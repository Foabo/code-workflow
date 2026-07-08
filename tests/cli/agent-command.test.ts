import { spawn } from "node:child_process";
import { mkdir, symlink } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initProject } from "../../src/index.js";
import { createTaskViaCli, tempRoot } from "../support/kernel.js";

describe("ff agent command bin dispatch", () => {
  it("dispatches from a real ff-* bin name", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-bin-dispatch", title: "Bin dispatch" });

    const binDir = path.join(root, "bin");
    await mkdir(binDir, { recursive: true });
    const binPath = path.join(binDir, "ff-plan");
    await symlink(path.join(process.cwd(), "dist/src/agent-command.js"), binPath);

    const result = await runNodeBin(binPath, ["--root", root, "--task", "0001-bin-dispatch"]);

    assert.equal(result.code, 0, result.stderr);
    const output = JSON.parse(result.stdout) as { action: string; task: { lifecycle: string; phase: string } };
    assert.equal(output.action, "plan");
    assert.equal(output.task.lifecycle, "blocked");
    assert.equal(output.task.phase, "clarify");
  });
});

async function runNodeBin(scriptPath: string, args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [scriptPath, ...args], {
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

  return await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
