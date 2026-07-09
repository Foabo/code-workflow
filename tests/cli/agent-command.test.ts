import { spawn } from "node:child_process";
import { mkdir, readFile, symlink } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initProject } from "../../src/index.js";
import { createTaskViaCli, tempRoot } from "../support/kernel.js";

const WORKFLOWS = ["work", "clarify", "plan", "run", "check", "finish", "resume", "discard", "doctor", "understand"] as const;

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

  it("prints help for every real ff-* bin without running workflows", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-wrapper-help", title: "Wrapper help" });

    const taskPath = path.join(root, ".ff/tasks/0001-wrapper-help/task.json");
    const taskBefore = await readFile(taskPath, "utf8");
    const binDir = path.join(root, "bin");
    await mkdir(binDir, { recursive: true });

    for (const workflow of WORKFLOWS) {
      const binPath = path.join(binDir, `ff-${workflow}`);
      await symlink(path.join(process.cwd(), "dist/src/agent-command.js"), binPath);

      const result = await runNodeBin(binPath, ["--root", root, "--task", "0001-wrapper-help", "--help"]);

      assert.equal(result.code, 0, `${workflow}: ${result.stderr}`);
      assert.match(result.stdout, /Usage:/, workflow);
      assert.match(result.stdout, new RegExp(`ff-${workflow}`), workflow);
      if (workflow === "work") {
        assert.match(result.stdout, /--title <text>/);
      }
      if (workflow === "check") {
        assert.match(result.stdout, /--command <cmd>/);
        assert.match(result.stdout, /--baseline-outcome <text>/);
      }
      if (workflow === "finish") {
        assert.match(result.stdout, /--summary <text>/);
        assert.match(result.stdout, /--dirty-worktree/);
      }
      if (workflow === "discard") {
        assert.match(result.stdout, /--confirm/);
        assert.match(result.stdout, /--worktree/);
      }
    }

    assert.equal(await readFile(taskPath, "utf8"), taskBefore);
  });

  it("prints help for the agent-command.js workflow fallback", async () => {
    const result = await runNodeBin(path.join(process.cwd(), "dist/src/agent-command.js"), ["plan", "--help"]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /node dist\/src\/agent-command\.js plan/);
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
