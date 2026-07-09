import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { initProject } from "../../src/index.js";
import { cliJson, createTaskViaCli, runCli, tempRoot } from "../support/kernel.js";

const TOP_LEVEL_COMMANDS = ["init", "validate", "doctor", "update", "tasks", "preflight", "internal"] as const;
const INTERNAL_HELPERS = [
  "create-task",
  "select-task",
  "append-trace",
  "validate-clarify",
  "set-state",
  "finish-task",
  "discard-task",
  "create-resume",
  "ensure-baseline-delta",
  "sync-baseline-delta",
  "consume-resume",
  "migrate-task-ids",
  "propose-spec",
  "accept-spec"
] as const;

describe("ff CLI help", () => {
  it("prints global help with top-level commands and workflow wrappers", async () => {
    const cli = await runCli(["--help"]);

    assert.equal(cli.code, 0, cli.stderr);
    assert.match(cli.stdout, /Top-level commands:/);
    assert.match(cli.stdout, /Workflow wrappers:/);
    for (const command of TOP_LEVEL_COMMANDS) {
      assert.match(cli.stdout, new RegExp(`\\b${command}\\b`));
    }
    for (const wrapper of ["ff-work", "ff-clarify", "ff-plan", "ff-run", "ff-check", "ff-finish", "ff-resume", "ff-discard", "ff-doctor", "ff-understand"]) {
      assert.match(cli.stdout, new RegExp(wrapper));
    }
  });

  it("prints top-level command help before running the command", async () => {
    for (const command of TOP_LEVEL_COMMANDS) {
      const cli = await runCli([command, "--help"]);

      assert.equal(cli.code, 0, `${command}: ${cli.stderr}`);
      assert.match(cli.stdout, /Usage:/, command);
      assert.match(cli.stdout, new RegExp(`ff ${command}`), command);
      assert.doesNotMatch(cli.stdout, /^\\{/m, command);
    }
  });

  it("prints internal helper help without requiring business flags", async () => {
    const root = await tempRoot();
    await initProject(root);

    for (const helper of INTERNAL_HELPERS) {
      const cli = await runCli(["internal", helper, "--root", root, "--help"]);

      assert.equal(cli.code, 0, `${helper}: ${cli.stderr}`);
      assert.match(cli.stdout, /Usage:/, helper);
      assert.match(cli.stdout, new RegExp(`ff internal ${helper}`), helper);
    }

    const tasks = await cliJson<{ tasks: unknown[] }>(["tasks", "--root", root]);
    assert.equal(tasks.tasks.length, 0);
  });

  it("keeps write-capable internal helpers inert when --help is requested", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-help-side-effects", title: "Help side effects" });

    const tracePath = path.join(root, ".ff/tasks/0001-help-side-effects/trace.jsonl");
    const traceBefore = await readFile(tracePath, "utf8");
    const appendTraceHelp = await runCli([
      "internal",
      "append-trace",
      "--root",
      root,
      "--task",
      "0001-help-side-effects",
      "--type",
      "should.not.write",
      "--summary",
      "Should not write",
      "--help"
    ]);
    assert.equal(appendTraceHelp.code, 0, appendTraceHelp.stderr);
    assert.equal(await readFile(tracePath, "utf8"), traceBefore);

    const createTaskHelp = await runCli([
      "internal",
      "create-task",
      "--root",
      root,
      "--title",
      "Should not be created",
      "--help"
    ]);
    assert.equal(createTaskHelp.code, 0, createTaskHelp.stderr);
    const tasks = await cliJson<{ tasks: Array<{ id: string }> }>(["tasks", "--root", root]);
    assert.deepEqual(tasks.tasks.map((task) => task.id), ["0001-help-side-effects"]);

    await cliJson(["internal", "create-resume", "--root", root, "--task", "0001-help-side-effects", "--content", "Resume note"]);
    const resumePath = path.join(root, ".ff/tasks/0001-help-side-effects/resume.md");
    const resumeBefore = await readFile(resumePath, "utf8");
    const consumeResumeHelp = await runCli([
      "internal",
      "consume-resume",
      "--root",
      root,
      "--task",
      "0001-help-side-effects",
      "--help"
    ]);
    assert.equal(consumeResumeHelp.code, 0, consumeResumeHelp.stderr);
    assert.equal(await readFile(resumePath, "utf8"), resumeBefore);
  });
});
