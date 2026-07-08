import { createHash } from "node:crypto";
import { access, chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  doctorProject,
  initProject,
  runWorkflowAction,
  updateProject,
  validateProject
} from "../../src/index.js";
import type { WorkflowOptions } from "../../src/index.js";
import {
  acceptClarifyViaWorkflow,
  appendTraceViaCli,
  assertInOrder,
  cliJson,
  consumeResumeNoteViaCli,
  createResumeNoteViaCli,
  createTaskViaCli,
  discardTaskViaCli,
  ensureBaselineDeltaViaCli,
  finishTaskViaCli,
  listTasksViaCli,
  migrateTasksViaCli,
  parseCliJson,
  parseJsonOutput,
  readTaskStateFile,
  readTrace,
  runCli,
  runPreflightViaCli,
  runValidateClarifyViaCli,
  selectTaskViaCli,
  setTaskStateViaCli,
  syncBaselineDeltaViaCli,
  tempRoot,
  writeLegacyTask
} from "../support/kernel.js";

describe("ff project", () => {
  it("validates expanded orchestration reasoning effort values and rejects minimal", async () => {
    const root = await tempRoot();
    await initProject(root);
    const orchestrationPath = path.join(root, ".ff/orchestration.json");
    const orchestration = JSON.parse(await readFile(orchestrationPath, "utf8")) as Record<string, unknown>;
    const roles = orchestration.roles as Record<string, Record<string, unknown>>;
    const harnessOverrides = orchestration.harness_overrides as Record<string, Record<string, Record<string, unknown>>>;

    roles.advisor.reasoning_effort = "xhigh";
    roles.planner.reasoning_effort = "auto";
    roles.planner.temperature = 0.2;
    roles["baseline-writer"].reasoning_effort = "none";
    harnessOverrides.codex = {
      advisor: { model: "gpt-5.5", reasoning_effort: "xhigh" },
      reviewer: { reasoning_effort: null }
    };
    harnessOverrides.opencode = {
      advisor: { temperature: 0.1 }
    };
    await writeFile(orchestrationPath, JSON.stringify(orchestration, null, 2), "utf8");

    assert.deepEqual(await validateProject(root), []);

    roles.advisor.reasoning_effort = "minimal";
    await writeFile(orchestrationPath, JSON.stringify(orchestration, null, 2), "utf8");
    const issues = await validateProject(root);
    assert.ok(
      issues.some((issue) => issue.path === ".ff/orchestration.json.roles.advisor.reasoning_effort" && /xhigh/.test(issue.message))
    );

    roles.advisor.reasoning_effort = "xhigh";
    roles.advisor.temperature = 2.1;
    await writeFile(orchestrationPath, JSON.stringify(orchestration, null, 2), "utf8");
    const temperatureIssues = await validateProject(root);
    assert.ok(
      temperatureIssues.some(
        (issue) => issue.path === ".ff/orchestration.json.roles.advisor.temperature" && /0 to 2/.test(issue.message)
      )
    );
  });


  it("accepts a positional root for CLI init", async () => {
    const parent = await tempRoot();
    const target = path.join(parent, "target");
    await mkdir(target);

    const cli = await runCli(["init", "target"], { cwd: parent });

    assert.equal(cli.code, 0, cli.stderr);
    const result = parseCliJson(cli.stdout);
    assert.ok((result.created as string[]).includes(".ff/version.json"));
    await access(path.join(target, ".ff/version.json"));
    await assert.rejects(access(path.join(parent, ".ff/version.json")));
  });


  it("prompts for missing init choices in an interactive CLI session", async () => {
    const root = await tempRoot();
    const emptyPath = await tempRoot();

    const cli = await runCli(["init", "."], {
      cwd: root,
      env: { CW_FORCE_INTERACTIVE: "1", PATH: emptyPath },
      answers: ["1", "1", "1", "n", "n"]
    });

    assert.equal(cli.code, 0, cli.stderr);
    assert.match(cli.stdout, /Select coding harness/);
    assert.match(cli.stdout, /Codex/);
    assert.match(cli.stdout, /Claude/);
    assert.match(cli.stdout, /OpenCode/);
    assert.match(cli.stdout, /Pi/);
    assert.match(cli.stdout, /Cursor/);
    assert.doesNotMatch(cli.stdout, /Generic|Detect|Configure|Use existing/);
    assert.match(cli.stdout, /Code index tool/);
    assert.match(cli.stdout, /Context memory tool/);
    assert.match(cli.stdout, /codebase-memory-mcp/);
    assert.match(cli.stdout, /Graphify \(experimental, intrusive\)/);
    assert.match(cli.stdout, /CodeGraph \(experimental, intrusive\)/);
    assert.match(cli.stdout, /Codex native memories/);
    assert.match(cli.stdout, /setup preview/);
    assert.match(cli.stdout, /Apply codebase-memory-mcp setup now/);
    const result = parseCliJson(cli.stdout);
    assert.equal(((result.adapters as Array<{ harness: string }>)[0]?.harness), "codex");
    assert.ok(((result.adapters as Array<{ created: string[] }>)[0]?.created ?? []).includes(".agents/skills/ff-work/SKILL.md"));
    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "skipped");
    assert.equal(enhancements.external_context, "skipped");
    assert.equal((enhancements.code_index as Record<string, unknown>).provider_id, "codebase-memory-mcp");
    assert.equal((enhancements.code_index as Record<string, unknown>).status, "pending");
    assert.equal((enhancements.context_memory as Record<string, unknown>).provider_id, "codex-native-memories");
    assert.equal((enhancements.context_memory as Record<string, unknown>).status, "pending");
  });


  it("skips init prompts when explicit CLI flags are provided", async () => {
    const root = await tempRoot();

    const cli = await runCli(
      [
        "init",
        "--root",
        root,
        "--harness",
        "codex",
        "--code-index",
        "skipped",
        "--context-memory",
        "skipped"
      ],
      { env: { CW_FORCE_INTERACTIVE: "1" } }
    );

    assert.equal(cli.code, 0, cli.stderr);
    assert.doesNotMatch(cli.stdout, /Select coding harness|Code index tool|Context memory tool/);
    const result = parseCliJson(cli.stdout);
    assert.equal(((result.adapters as Array<{ harness: string }>)[0]?.harness), "codex");
    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "skipped");
    assert.equal(enhancements.external_context, "skipped");
    assert.equal((enhancements.code_index as Record<string, unknown>).status, "skipped");
    assert.equal((enhancements.context_memory as Record<string, unknown>).status, "skipped");
  });

});
