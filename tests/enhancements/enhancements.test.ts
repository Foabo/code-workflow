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

describe("ff enhancements", () => {
  it("keeps init idempotent and records optional enhancements as advisory config", async () => {
    const root = await tempRoot();
    await initProject(root, { codeIntelligence: "configured", externalContext: "detected" });
    await writeFile(path.join(root, ".ff/project/overview.md"), "# Custom overview\n", "utf8");

    const rerun = await initProject(root, { codeIntelligence: "skipped", externalContext: "skipped" });

    assert.ok(rerun.existing.includes(".ff/project/overview.md"));
    assert.ok(rerun.existing.includes(".ff/enhancements.json"));
    assert.ok(rerun.existing.includes(".ff/orchestration.json"));
    assert.equal(await readFile(path.join(root, ".ff/project/overview.md"), "utf8"), "# Custom overview\n");
    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "configured");
    const orchestration = JSON.parse(await readFile(path.join(root, ".ff/orchestration.json"), "utf8")) as Record<string, unknown>;
    assert.equal((orchestration.advisor as Record<string, unknown>).mode, "always-on");
    assert.equal((orchestration.advisor as Record<string, unknown>).enabled_by_default, true);
    assert.equal(((orchestration.roles as Record<string, Record<string, unknown>>).advisor).capability_tier, "high-reasoning");
    assert.equal(((orchestration.roles as Record<string, Record<string, unknown>>).advisor).temperature, 0.1);
    assert.equal(((orchestration.roles as Record<string, Record<string, unknown>>).checker).temperature, 0.2);
    assert.equal((await doctorProject(root)).ok, true);
  });


  it("offers existing codebase-memory-mcp without update or reinstall choices when installed", async () => {
    const root = await tempRoot();
    const fakeBin = await tempRoot();
    const fakeCodebaseMemory = path.join(fakeBin, "codebase-memory-mcp");
    await writeFile(fakeCodebaseMemory, "#!/bin/sh\necho 0.8.1\n", "utf8");
    await chmod(fakeCodebaseMemory, 0o755);

    const cli = await runCli(["init", "."], {
      cwd: root,
      env: { CW_FORCE_INTERACTIVE: "1", PATH: fakeBin },
      answers: ["1", "1", "1", "n", "n"]
    });

    assert.equal(cli.code, 0, cli.stderr);
    assert.match(cli.stdout, /codebase-memory-mcp \(installed\)/);
    assert.doesNotMatch(cli.stdout, /codebase-memory-mcp update/);
    assert.doesNotMatch(cli.stdout, /codebase-memory-mcp reinstall/);
    assert.match(cli.stdout, /Graphify \(experimental, intrusive\)/);
    assert.match(cli.stdout, /CodeGraph \(experimental, intrusive\)/);
    assert.doesNotMatch(cli.stdout, /install\.sh/);
    assert.match(cli.stdout, /Uses the existing install and does not run the installer/);

    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    const codeIndex = enhancements.code_index as Record<string, unknown>;
    assert.equal(codeIndex.provider_id, "codebase-memory-mcp");
    assert.equal(codeIndex.status, "pending");
    assert.equal(JSON.stringify(codeIndex).includes(root), false);
    assert.doesNotMatch(JSON.stringify(codeIndex.commands), /install\.sh/);
    assert.match(JSON.stringify(codeIndex.commands), /index_repository/);
  });


  it("reuses installed codebase-memory-mcp detection for Claude init", async () => {
    const root = await tempRoot();
    const fakeBin = await tempRoot();
    const fakeCodebaseMemory = path.join(fakeBin, "codebase-memory-mcp");
    await writeFile(fakeCodebaseMemory, "#!/bin/sh\necho 0.8.1\n", "utf8");
    await chmod(fakeCodebaseMemory, 0o755);

    const cli = await runCli(["init", ".", "--harness", "claude"], {
      cwd: root,
      env: { CW_FORCE_INTERACTIVE: "1", PATH: fakeBin },
      answers: ["1", "1", "n", "n"]
    });

    assert.equal(cli.code, 0, cli.stderr);
    assert.match(cli.stdout, /codebase-memory-mcp \(installed\)/);
    assert.doesNotMatch(cli.stdout, /codebase-memory-mcp update|codebase-memory-mcp reinstall/);
    assert.match(cli.stdout, /claude-mem \(intrusive\)/);
    assert.match(cli.stdout, /Apply claude-mem setup now/);
    assert.doesNotMatch(cli.stdout, /install\.sh/);

    const result = parseCliJson(cli.stdout);
    assert.equal(((result.adapters as Array<{ harness: string }>)[0]?.harness), "claude");
    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    const codeIndex = enhancements.code_index as Record<string, unknown>;
    assert.equal(codeIndex.provider_id, "codebase-memory-mcp");
    assert.equal(codeIndex.status, "pending");
    assert.doesNotMatch(JSON.stringify(codeIndex.commands), /install\.sh/);
    assert.equal((enhancements.context_memory as Record<string, unknown>).provider_id, "claude-mem");
  });


  it("keeps provider setup pending for --yes init", async () => {
    const root = await tempRoot();
    const home = await tempRoot();

    const cli = await runCli(
      [
        "init",
        "--root",
        root,
        "--harness",
        "codex",
        "--code-index",
        "codebase-memory-mcp",
        "--context-memory",
        "codex-native-memories",
        "--yes"
      ],
      { env: { CW_FORCE_INTERACTIVE: "1", HOME: home } }
    );

    assert.equal(cli.code, 0, cli.stderr);
    assert.doesNotMatch(cli.stdout, /Select coding harness|Code index tool|Context memory tool|Apply .* setup now/);
    await assert.rejects(access(path.join(home, ".codex", "config.toml")));
    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "skipped");
    assert.equal(enhancements.external_context, "skipped");
    assert.equal((enhancements.code_index as Record<string, unknown>).status, "pending");
    assert.equal((enhancements.context_memory as Record<string, unknown>).status, "pending");
    assert.deepEqual(await validateProject(root), []);
  });


  it("records default pending setup for --yes init on Claude, OpenCode, and Pi", async () => {
    const cases = [
      {
        harness: "claude",
        codeIndex: "codebase-memory-mcp",
        contextMemory: "claude-mem",
        absentPath: [".claude-mem"],
        codeIndexTouched: ["~/.local/bin/codebase-memory-mcp", "CLAUDE.md"],
        contextMemoryTouched: ["~/.claude-mem/settings.json", "~/.claude-mem/"]
      },
      {
        harness: "opencode",
        codeIndex: "aft",
        contextMemory: "magic-context",
        absentPath: [".cortexkit"],
        codeIndexTouched: [".cortexkit/aft.jsonc", "opencode.jsonc"],
        contextMemoryTouched: [".cortexkit/magic-context.jsonc", "opencode.jsonc"]
      },
      {
        harness: "pi",
        codeIndex: "aft",
        contextMemory: "magic-context",
        absentPath: [".cortexkit"],
        codeIndexTouched: [".cortexkit/aft.jsonc", ".pi/"],
        contextMemoryTouched: [".cortexkit/magic-context.jsonc", ".pi/"]
      }
    ] as const;

    for (const testCase of cases) {
      const root = await tempRoot();
      const home = await tempRoot();
      const fakeBin = await tempRoot();
      if (testCase.harness === "pi") {
        const fakePi = path.join(fakeBin, "pi");
        await writeFile(fakePi, "#!/bin/sh\necho installed pi-subagents\n", "utf8");
        await chmod(fakePi, 0o755);
      }
      const cli = await runCli(
        ["init", "--root", root, "--harness", testCase.harness, "--yes"],
        {
          env: {
            CW_FORCE_INTERACTIVE: "1",
            HOME: home,
            ...(testCase.harness === "pi" ? { PATH: fakeBin } : {})
          }
        }
      );

      assert.equal(cli.code, 0, cli.stderr);
      assert.doesNotMatch(cli.stdout, /Select coding harness|Code index tool|Context memory tool|Apply .* setup now/);
      const result = parseCliJson(cli.stdout);
      const setup = result.setup as Array<Record<string, unknown>>;
      if (testCase.harness === "pi") {
        const piSetup = setup.find((record) => record.provider_id === "pi-subagents");
        assert.equal(piSetup?.status, "configured");
        assert.deepEqual(piSetup?.commands_run, ["pi install npm:pi-subagents"]);
      } else {
        assert.equal(setup.some((record) => record.provider_id === "pi-subagents"), false);
      }
      const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
      const codeIndex = enhancements.code_index as Record<string, unknown>;
      const contextMemory = enhancements.context_memory as Record<string, unknown>;
      assert.equal(codeIndex.provider_id, testCase.codeIndex);
      assert.equal(codeIndex.status, "pending");
      assert.deepEqual(codeIndex.commands_run, []);
      for (const touchedFile of testCase.codeIndexTouched) {
        assert.ok((codeIndex.touched_files as string[]).includes(touchedFile), `${testCase.harness} code index touches ${touchedFile}`);
      }
      assert.equal(contextMemory.provider_id, testCase.contextMemory);
      assert.equal(contextMemory.status, "pending");
      assert.deepEqual(contextMemory.commands_run, []);
      for (const touchedFile of testCase.contextMemoryTouched) {
        assert.ok(
          (contextMemory.touched_files as string[]).includes(touchedFile),
          `${testCase.harness} context memory touches ${touchedFile}`
        );
      }
      for (const absentPath of testCase.absentPath) {
        await assert.rejects(access(path.join(home, absentPath)));
        await assert.rejects(access(path.join(root, absentPath)));
      }
      assert.deepEqual(await validateProject(root), []);
    }
  });


  it("records experimental Codex code index setup metadata through --yes init", async () => {
    const cases = [
      {
        provider: "graphify",
        touchedFiles: ["AGENTS.md", ".codex/hooks.json", "graphify-out/"],
        commandPattern: /graphify update \./,
        verificationPattern: /graphify --version/
      },
      {
        provider: "codegraph",
        touchedFiles: [".codegraph/", "~/.codegraph/telemetry.json"],
        commandPattern: /codegraph init \./,
        verificationPattern: /codegraph status \./
      }
    ] as const;

    for (const testCase of cases) {
      const root = await tempRoot();
      const cli = await runCli([
        "init",
        "--root",
        root,
        "--harness",
        "codex",
        "--code-index",
        testCase.provider,
        "--context-memory",
        "skipped",
        "--yes"
      ]);

      assert.equal(cli.code, 0, cli.stderr);
      assert.doesNotMatch(cli.stdout, /Apply .* setup now/);
      const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
      const codeIndex = enhancements.code_index as Record<string, unknown>;
      assert.equal(codeIndex.provider_id, testCase.provider);
      assert.equal(codeIndex.status, "pending");
      assert.deepEqual(codeIndex.commands_run, []);
      assert.match(JSON.stringify(codeIndex.commands), testCase.commandPattern);
      assert.match((codeIndex.verification as { command: string }).command, testCase.verificationPattern);
      for (const touchedFile of testCase.touchedFiles) {
        assert.ok((codeIndex.touched_files as string[]).includes(touchedFile), `${testCase.provider} touches ${touchedFile}`);
      }
      assert.deepEqual(await validateProject(root), []);
    }
  });


  it("applies Codex memories setup through CLI confirmation", async () => {
    const root = await tempRoot();
    const home = await tempRoot();
    const configPath = path.join(home, ".codex", "config.toml");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      "[model]\nname = \"gpt-5\"\n\n[features]\nweb_search = true\nmemories = false\n\n[profiles.fast]\nmodel = \"gpt-5\"\n",
      "utf8"
    );

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
        "codex-native-memories"
      ],
      { env: { CW_FORCE_INTERACTIVE: "1", HOME: home }, answers: ["y"] }
    );

    assert.equal(cli.code, 0, cli.stderr);
    assert.equal(
      await readFile(configPath, "utf8"),
      "[model]\nname = \"gpt-5\"\n\n[features]\nweb_search = true\nmemories = true\n\n[profiles.fast]\nmodel = \"gpt-5\"\n"
    );
    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    assert.equal(enhancements.external_context, "configured");
    const contextMemory = enhancements.context_memory as Record<string, unknown>;
    assert.equal(contextMemory.provider_id, "codex-native-memories");
    assert.ok((contextMemory.touched_files as string[]).includes("~/.codex/config.toml"));
    assert.equal(JSON.stringify(contextMemory).includes(home), false);
    assert.deepEqual(contextMemory.verification, {
      command: "verify config patches were written",
      ok: true,
      exit_code: 0
    });
    assert.deepEqual(await validateProject(root), []);
  });


  it("adds Codex memories config through CLI confirmation when the flag is missing", async () => {
    const root = await tempRoot();
    const home = await tempRoot();
    const configPath = path.join(home, ".codex", "config.toml");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      "[model]\nname = \"gpt-5\"\n\n[features]\nweb_search = true\n\n[profiles.fast]\nmodel = \"gpt-5\"\n",
      "utf8"
    );

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
        "codex-native-memories"
      ],
      { env: { CW_FORCE_INTERACTIVE: "1", HOME: home }, answers: ["y"] }
    );

    assert.equal(cli.code, 0, cli.stderr);
    assert.equal(
      await readFile(configPath, "utf8"),
      "[model]\nname = \"gpt-5\"\n\n[features]\nweb_search = true\nmemories = true\n\n[profiles.fast]\nmodel = \"gpt-5\"\n"
    );
    assert.deepEqual(await validateProject(root), []);
  });


  it("applies existing codebase-memory-mcp setup through CLI confirmation", async () => {
    const root = await tempRoot();
    const fakeBin = await tempRoot();
    const logPath = path.join(fakeBin, "commands.log");
    const fakeCodebaseMemory = path.join(fakeBin, "codebase-memory-mcp");
    await writeFile(
      fakeCodebaseMemory,
      `#!/bin/sh\necho "$@" >> ${JSON.stringify(logPath)}\nif [ "$1" = "--version" ]; then echo 0.8.1; fi\nexit 0\n`,
      "utf8"
    );
    await chmod(fakeCodebaseMemory, 0o755);

    const cli = await runCli(
      [
        "init",
        "--root",
        root,
        "--harness",
        "codex",
        "--code-index",
        "codebase-memory-mcp:existing",
        "--context-memory",
        "skipped"
      ],
      { env: { CW_FORCE_INTERACTIVE: "1", PATH: fakeBin }, answers: ["y"] }
    );

    assert.equal(cli.code, 0, cli.stderr);
    const log = await readFile(logPath, "utf8");
    assert.match(log, /cli index_repository/);
    assert.match(log, /--version/);
    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    const codeIndex = enhancements.code_index as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "configured");
    assert.equal(codeIndex.provider_id, "codebase-memory-mcp");
    assert.equal(codeIndex.status, "configured");
    assert.equal(JSON.stringify(codeIndex).includes(root), false);
    assert.doesNotMatch(JSON.stringify(codeIndex.commands), /install\.sh/);
    assert.deepEqual(await validateProject(root), []);
  });


  it("records failed provider setup metadata through CLI setup", async () => {
    const root = await tempRoot();
    const fakeBin = await tempRoot();
    const fakeCodebaseMemory = path.join(fakeBin, "codebase-memory-mcp");
    await writeFile(fakeCodebaseMemory, "#!/bin/sh\necho install failed >&2\nexit 1\n", "utf8");
    await chmod(fakeCodebaseMemory, 0o755);

    const cli = await runCli(
      [
        "init",
        "--root",
        root,
        "--harness",
        "codex",
        "--code-index",
        "codebase-memory-mcp:existing",
        "--context-memory",
        "skipped"
      ],
      { env: { CW_FORCE_INTERACTIVE: "1", PATH: fakeBin }, answers: ["y"] }
    );

    assert.equal(cli.code, 0, cli.stderr);
    const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
    const codeIndex = enhancements.code_index as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "skipped");
    assert.equal(codeIndex.provider_id, "codebase-memory-mcp");
    assert.equal(codeIndex.status, "failed");
    assert.equal(codeIndex.message, "install failed");
    assert.deepEqual(await validateProject(root), []);
  });


  it("does not overwrite malformed enhancement config during CLI provider setup", async () => {
    const root = await tempRoot();
    const home = await tempRoot();
    await initProject(root, { harnesses: ["codex"] });
    const enhancementsPath = path.join(root, ".ff/enhancements.json");
    await writeFile(enhancementsPath, "{", "utf8");

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
        "codex-native-memories"
      ],
      { env: { CW_FORCE_INTERACTIVE: "1", HOME: home }, answers: ["y"] }
    );

    assert.equal(cli.code, 1);
    assert.match(cli.stderr, /cannot read existing enhancement config/);
    assert.equal(await readFile(enhancementsPath, "utf8"), "{");
    await assert.rejects(access(path.join(home, ".codex", "config.toml")));
  });

});
