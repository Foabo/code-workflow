import { spawn } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  doctorProject,
  initProject,
  runWorkflowAction,
  updateProject,
  validateProject
} from "../src/index.js";
import type {
  BaselineFile,
  BaselineDecision,
  DirtyWorktreeDecision,
  TaskStateRecord,
  WorkflowCommandAction,
  WorkflowOptions
} from "../src/index.js";

describe("cw kernel", () => {
  it("initializes a project with version, baseline, task templates, and valid structure", async () => {
    const root = await tempRoot();

    const result = await initProject(root, new Date("2026-07-03T00:00:00.000Z"));

    assert.ok(result.created.includes(".cw/version.json"));
    assert.ok(result.created.includes(".cw/project/overview.md"));
    assert.ok(result.created.includes(".cw/enhancements.json"));
    assert.ok(result.created.includes(".cw/templates/spec.md"));
    assert.deepEqual(result.adapters, []);
    await assert.rejects(access(path.join(root, ".cw/agent-commands")));
    assert.deepEqual(await validateProject(root), []);
    const doctor = await doctorProject(root);
    assert.equal(doctor.ok, true);
    assert.deepEqual(doctor.enhancements, { code_intelligence: "skipped", external_context: "skipped" });
  });

  it("keeps init idempotent and records optional enhancements as advisory config", async () => {
    const root = await tempRoot();
    await initProject(root, { codeIntelligence: "configured", externalContext: "detected" });
    await writeFile(path.join(root, ".cw/project/overview.md"), "# Custom overview\n", "utf8");

    const rerun = await initProject(root, { codeIntelligence: "skipped", externalContext: "skipped" });

    assert.ok(rerun.existing.includes(".cw/project/overview.md"));
    assert.ok(rerun.existing.includes(".cw/enhancements.json"));
    assert.equal(await readFile(path.join(root, ".cw/project/overview.md"), "utf8"), "# Custom overview\n");
    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "configured");
    assert.equal((await doctorProject(root)).ok, true);
  });

  it("generates repo-local agent skills for the Codex harness", async () => {
    const root = await tempRoot();

    const result = await initProject(root, { harnesses: ["codex"] });

    assert.equal(result.adapters[0]?.harness, "codex");
    assert.ok(result.adapters[0]?.created.includes(".agents/skills/cw-work/SKILL.md"));
    await assert.rejects(access(path.join(root, ".cw/agent-commands")));
    await assert.rejects(access(path.join(root, ".agents/plugins/marketplace.json")));
    await assert.rejects(access(path.join(root, ".codex/skills/cw-work/SKILL.md")));
    await assert.rejects(access(path.join(root, "plugins/cw-workflow/.codex-plugin/plugin.json")));
    const skill = await readFile(path.join(root, ".agents/skills/cw-work/SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: cw-work/m);
    assert.match(skill, /Treat `\.cw` as Repo Truth/);
    assert.match(skill, /cw preflight --action work/);
    assert.match(skill, /routine progress command/);
    assert.match(skill, /Repeated `\/cw-work` calls/);
    assert.match(skill, /Use task truth to choose the next responsibility/);
    assert.match(skill, /Do not close tasks from `cw-work`/);
    assert.match(skill, /user or environment permission/);
    assert.match(skill, /continue inline with the same responsibilities/);
    assert.match(skill, /Implementer subagents may write code/);
    assert.match(skill, /Checker subagents must return spec drift/);
    assert.doesNotMatch(skill, /generated-by-cw/);
    const clarifySkill = await readFile(path.join(root, ".agents/skills/cw-clarify/SKILL.md"), "utf8");
    assert.match(clarifySkill, /challenge pass/);
    assert.match(clarifySkill, /Smaller tasks are faster/);
    assert.match(clarifySkill, /shorter path/);
    assert.match(clarifySkill, /expand-then-grill/);
    assert.match(clarifySkill, /one question at a time/);
    assert.match(clarifySkill, /would this wording let an agent skip challenge/);
    assert.match(clarifySkill, /Proposed Spec/);
    assert.doesNotMatch(clarifySkill, /fast path/);
    const planSkill = await readFile(path.join(root, ".agents/skills/cw-plan/SKILL.md"), "utf8");
    assert.match(planSkill, /spec quality gate/);
    assert.match(planSkill, /Do not modify spec\.md during planning/);
    assert.match(planSkill, /one concrete next question/);
    assert.match(planSkill, /vertical slices/);
    assert.match(planSkill, /Post-plan artifact cross-review/);
    assert.match(planSkill, /independent reviewer subagent/);
    assert.match(planSkill, /user or environment permission allow delegation/);
    assert.match(planSkill, /run the same check inline/);
    assert.match(planSkill, /behavior-review checks/);
    assert.match(planSkill, /deterministic tests separate from behavior review/);
    const runSkill = await readFile(path.join(root, ".agents/skills/cw-run/SKILL.md"), "utf8");
    assert.match(runSkill, /accepted task contract/);
    assert.match(runSkill, /requirement drift/);
    assert.match(runSkill, /Behavior changes require test evidence/);
    assert.match(runSkill, /External TDD, domain modeling, implement, Superpowers, or subagent skills may help when installed/);
    const checkSkill = await readFile(path.join(root, ".agents/skills/cw-check/SKILL.md"), "utf8");
    assert.match(checkSkill, /Artifact alignment review/);
    assert.match(checkSkill, /Implementation evidence review/);
    assert.match(checkSkill, /environment, action, and result/);
    assert.match(checkSkill, /final broad review/);
    const finishSkill = await readFile(path.join(root, ".agents/skills/cw-finish/SKILL.md"), "utf8");
    assert.match(finishSkill, /closure packet/);
    assert.match(finishSkill, /does not create commits/);
    assert.match(finishSkill, /current-state descriptions/);
    assert.match(finishSkill, /CLI core must not call an LLM/);
    const resumeSkill = await readFile(path.join(root, ".agents/skills/cw-resume/SKILL.md"), "utf8");
    assert.match(resumeSkill, /user-triggered continuation/);
    assert.match(resumeSkill, /task artifacts remain the task truth/);
    assert.match(resumeSkill, /kernel consumes it automatically after a later workflow action records material progress/);
    const doctorSkill = await readFile(path.join(root, ".agents/skills/cw-doctor/SKILL.md"), "utf8");
    assert.match(doctorSkill, /repository-level diagnosis/);
    assert.match(doctorSkill, /issues before warnings/);
    assert.match(doctorSkill, /read-only by default/);
    const understandSkill = await readFile(path.join(root, ".agents/skills/cw-understand/SKILL.md"), "utf8");
    assert.match(understandSkill, /draft-first repository observation/);
    assert.match(understandSkill, /Separate observed facts from inferences/);
    assert.match(understandSkill, /never overwrite \.cw\/project\/\*/);

    await writeFile(path.join(root, ".agents/skills/cw-work/SKILL.md"), "stale", "utf8");
    const staleReport = await doctorProject(root);
    assert.equal(staleReport.ok, false);
    assert.ok(staleReport.warnings.some((warning) => warning.path === ".agents/skills/cw-work/SKILL.md"));

    const update = await updateProject(root, ["codex"]);
    assert.equal(update.validation.ok, true);
    assert.match(await readFile(path.join(root, ".agents/skills/cw-work/SKILL.md"), "utf8"), /cw preflight --action work/);
  });

  it("generates Claude, OpenCode, and Pi harness entries", async () => {
    const claudeRoot = await tempRoot();
    const opencodeRoot = await tempRoot();
    const piRoot = await tempRoot();

    const claude = await initProject(claudeRoot, { harnesses: ["claude"] });
    const opencode = await initProject(opencodeRoot, { harnesses: ["opencode"] });
    const pi = await initProject(piRoot, { harnesses: ["pi"] });

    assert.equal(claude.adapters[0]?.harness, "claude");
    assert.ok(claude.adapters[0]?.created.includes(".claude/skills/cw-work/SKILL.md"));
    await assert.rejects(access(path.join(claudeRoot, ".cw/agent-commands")));
    await assert.rejects(access(path.join(claudeRoot, ".claude/commands")));
    const claudeSkill = await readFile(path.join(claudeRoot, ".claude/skills/cw-work/SKILL.md"), "utf8");
    assert.match(claudeSkill, /^---\nname: cw-work/m);
    assert.match(claudeSkill, /Claude/);
    assert.match(claudeSkill, /cw preflight --action work/);

    assert.equal(opencode.adapters[0]?.harness, "opencode");
    assert.ok(opencode.adapters[0]?.created.includes(".agents/skills/cw-work/SKILL.md"));
    await assert.rejects(access(path.join(opencodeRoot, ".cw/agent-commands")));
    await assert.rejects(access(path.join(opencodeRoot, ".opencode/commands")));
    const opencodeSkill = await readFile(path.join(opencodeRoot, ".agents/skills/cw-work/SKILL.md"), "utf8");
    assert.match(opencodeSkill, /^---\nname: cw-work/m);
    assert.match(opencodeSkill, /OpenCode/);
    assert.match(opencodeSkill, /cw preflight --action work/);

    assert.equal(pi.adapters[0]?.harness, "pi");
    assert.ok(pi.adapters[0]?.created.includes(".agents/skills/cw-work/SKILL.md"));
    await assert.rejects(access(path.join(piRoot, ".cw/agent-commands")));
    await assert.rejects(access(path.join(piRoot, ".pi/skills")));
    const piSkill = await readFile(path.join(piRoot, ".agents/skills/cw-work/SKILL.md"), "utf8");
    assert.match(piSkill, /^---\nname: cw-work/m);
    assert.match(piSkill, /Pi/);
    assert.match(piSkill, /cw preflight --action work/);
  });

  it("accepts a positional root for CLI init", async () => {
    const parent = await tempRoot();
    const target = path.join(parent, "target");
    await mkdir(target);

    const cli = await runCli(["init", "target"], { cwd: parent });

    assert.equal(cli.code, 0, cli.stderr);
    const result = parseCliJson(cli.stdout);
    assert.ok((result.created as string[]).includes(".cw/version.json"));
    await access(path.join(target, ".cw/version.json"));
    await assert.rejects(access(path.join(parent, ".cw/version.json")));
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
    assert.ok(((result.adapters as Array<{ created: string[] }>)[0]?.created ?? []).includes(".agents/skills/cw-work/SKILL.md"));
    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "skipped");
    assert.equal(enhancements.external_context, "skipped");
    assert.equal((enhancements.code_index as Record<string, unknown>).provider_id, "codebase-memory-mcp");
    assert.equal((enhancements.code_index as Record<string, unknown>).status, "pending");
    assert.equal((enhancements.context_memory as Record<string, unknown>).provider_id, "codex-native-memories");
    assert.equal((enhancements.context_memory as Record<string, unknown>).status, "pending");
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

    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
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
    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
    const codeIndex = enhancements.code_index as Record<string, unknown>;
    assert.equal(codeIndex.provider_id, "codebase-memory-mcp");
    assert.equal(codeIndex.status, "pending");
    assert.doesNotMatch(JSON.stringify(codeIndex.commands), /install\.sh/);
    assert.equal((enhancements.context_memory as Record<string, unknown>).provider_id, "claude-mem");
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
    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
    assert.equal(enhancements.code_intelligence, "skipped");
    assert.equal(enhancements.external_context, "skipped");
    assert.equal((enhancements.code_index as Record<string, unknown>).status, "skipped");
    assert.equal((enhancements.context_memory as Record<string, unknown>).status, "skipped");
  });

  it("accepts explicit Claude, OpenCode, and Pi harness flags", async () => {
    const cases = [
      { harness: "claude", generatedPath: ".claude/skills/cw-work/SKILL.md" },
      { harness: "opencode", generatedPath: ".agents/skills/cw-work/SKILL.md" },
      { harness: "pi", generatedPath: ".agents/skills/cw-work/SKILL.md" }
    ] as const;

    for (const testCase of cases) {
      const root = await tempRoot();
      const cli = await runCli(
        [
          "init",
          "--root",
          root,
          "--harness",
          testCase.harness,
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
      assert.equal(((result.adapters as Array<{ harness: string }>)[0]?.harness), testCase.harness);
      await access(path.join(root, testCase.generatedPath));
      const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
      assert.equal((enhancements.code_index as Record<string, unknown>).status, "skipped");
      assert.equal((enhancements.context_memory as Record<string, unknown>).status, "skipped");
      assert.deepEqual(await validateProject(root), []);
    }
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
    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
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
      const cli = await runCli(
        ["init", "--root", root, "--harness", testCase.harness, "--yes"],
        { env: { CW_FORCE_INTERACTIVE: "1", HOME: home } }
      );

      assert.equal(cli.code, 0, cli.stderr);
      assert.doesNotMatch(cli.stdout, /Select coding harness|Code index tool|Context memory tool|Apply .* setup now/);
      const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
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
      const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
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
    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
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
    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
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
    const enhancements = JSON.parse(await readFile(path.join(root, ".cw/enhancements.json"), "utf8")) as Record<string, unknown>;
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
    const enhancementsPath = path.join(root, ".cw/enhancements.json");
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

  it("creates a task with core artifacts and append-only trace events", async () => {
    const root = await tempRoot();
    await initProject(root);

    const state = await createTaskViaCli(root, {
      id: "0001-auth-rate-limit",
      title: "Add auth rate limiting",
      now: new Date("2026-07-03T01:00:00.000Z")
    });

    assert.deepEqual(
      {
        id: state.id,
        lifecycle: state.lifecycle,
        phase: state.phase,
        artifacts: state.artifacts
      },
      {
      id: "0001-auth-rate-limit",
      lifecycle: "open",
      phase: "clarify",
      artifacts: {
        spec: "spec.md",
        plan: "plan.md",
        task: "task.md",
        baseline_delta: null,
        resume: null
      }
      }
    );

    assert.match(await readFile(path.join(root, ".cw/tasks/0001-auth-rate-limit/spec.md"), "utf8"), /# Spec/);
    const trace = await readTrace(root, "0001-auth-rate-limit");
    assert.equal(trace.length, 1);
    assert.equal(trace[0]?.type, "task.created");
    assert.deepEqual(await validateProject(root), []);
  });

  it("generates numeric task ids without reusing active or archived prefixes", async () => {
    const root = await tempRoot();
    await initProject(root);
    await mkdir(path.join(root, ".cw/tasks/archived/0007-old-task"), { recursive: true });

    const generated = await createTaskViaCli(root, {
      title: "Ship docs",
      now: new Date("2026-07-03T01:00:00.000Z")
    });

    assert.equal(generated.id, "0008-ship-docs");
    assert.match(await readFile(path.join(root, ".cw/tasks/0008-ship-docs/spec.md"), "utf8"), /# Spec/);
    await assert.rejects(
      createTaskViaCli(root, {
        id: "0007-reused-number",
        title: "Reused number"
      }),
      /task number 0007/
    );
  });

  it("updates task state and records the change in trace", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-update-docs", title: "Update docs" });

    const updated = await setTaskStateViaCli(root, "0001-update-docs", {
      phase: "run",
      nextAction: "Execute the implementation checklist",
      now: new Date("2026-07-03T02:00:00.000Z")
    });

    assert.equal(updated.phase, "run");
    assert.equal(updated.next_action, "Execute the implementation checklist");
    const trace = await readTrace(root, "0001-update-docs");
    assert.deepEqual(
      {
        type: trace.at(-1)?.type,
        summary: trace.at(-1)?.summary
      },
      {
      type: "task.state.updated",
      summary: "phase clarify -> run; next action updated"
      }
    );
  });

  it("lists tasks, selects a single task, and reports ambiguous selection", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-one", title: "One", now: new Date("2026-07-03T01:00:00.000Z") });

    assert.equal((await selectTaskViaCli(root)).id, "0001-one");
    assert.deepEqual((await listTasksViaCli(root)).map((task) => task.id), ["0001-one"]);

    await createTaskViaCli(root, { id: "0002-two", title: "Two", now: new Date("2026-07-03T02:00:00.000Z") });
    await assert.rejects(selectTaskViaCli(root), /multiple matching tasks/);
    assert.equal((await selectTaskViaCli(root, { taskId: "0002-two" })).id, "0002-two");
    assert.equal((await selectTaskViaCli(root, { taskId: "0002" })).id, "0002-two");
    await assert.rejects(selectTaskViaCli(root, { taskId: "9999" }), /no task found/);
    await mkdir(path.join(root, ".cw/tasks/0002-two-duplicate"), { recursive: true });
    await assert.rejects(selectTaskViaCli(root, { taskId: "0002" }), /ambiguous/);
  });

  it("runs preflight for a selected task", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-preflight-test", title: "Preflight test" });

    const report = await runPreflightViaCli(root, { action: "run", taskId: "0001-preflight-test" });

    assert.equal(report.ok, true);
    assert.equal(report.task?.id, "0001-preflight-test");
  });

  it("returns actionable status when work selects an existing task", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-existing-work", title: "Existing work" });
    await setTaskStateViaCli(root, "0001-existing-work", {
      phase: "check",
      nextAction: "Run verification and review"
    });

    const result = await runWorkflowAction(root, "work", { taskId: "0001-existing-work" });

    assert.equal(result.task?.id, "0001-existing-work");
    assert.match(result.message, /phase check/);
    assert.equal(result.details?.phase, "check");
    assert.equal(result.details?.nextAction, "Run verification and review");
    assert.match(String(result.details?.recommendedAction), /apply cw-check behavior next/);
  });

  it("resolves numeric task references in internal CLI commands", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-cli-reference", title: "CLI reference" });

    const cli = await runCli([
      "internal",
      "set-state",
      "--root",
      root,
      "--task",
      "0001",
      "--phase",
      "run",
      "--next-action",
      "Execute the implementation checklist"
    ]);

    assert.equal(cli.code, 0, cli.stderr);
    assert.equal((await readTaskStateFile(root, "0001-cli-reference")).phase, "run");
  });

  it("blocks clarification and planning when required task facts are missing", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-needs-input", title: "Needs input" });

    const clarify = await runWorkflowAction(root, "clarify", { taskId: "0001-needs-input" });

    assert.equal(clarify.task?.lifecycle, "blocked");
    assert.equal(clarify.task?.phase, "clarify");
    assert.match(clarify.task?.blocked_reason ?? "", /goal/);

    await setTaskStateViaCli(root, "0001-needs-input", {
      lifecycle: "open",
      blockedReason: null,
      phase: "plan",
      nextAction: "Try planning"
    });
    const plan = await runWorkflowAction(root, "plan", { taskId: "0001-needs-input" });

    assert.equal(plan.task?.lifecycle, "blocked");
    assert.equal(plan.task?.phase, "clarify");
    assert.match(plan.task?.blocked_reason ?? "", /spec quality gate/);
    assert.match(plan.task?.next_action ?? "", /concrete outcome/);
  });

  it("blocks planning with a concrete next question when acceptance criteria are missing", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-missing-acceptance", title: "Missing acceptance" });
    await writeFile(
      path.join(root, ".cw/tasks/0001-missing-acceptance/spec.md"),
      "# Spec\n\n## Goal\n\nCreate a README file.\n\n## Scope\n\nAdd project documentation.\n\n## Non-goals\n\n\n## Constraints\n\n\n## Decisions\n\n\n## Acceptance Criteria\n",
      "utf8"
    );
    await setTaskStateViaCli(root, "0001-missing-acceptance", {
      lifecycle: "open",
      blockedReason: null,
      phase: "plan",
      nextAction: "Try planning"
    });

    const plan = await runWorkflowAction(root, "plan", { taskId: "0001-missing-acceptance" });

    assert.equal(plan.task?.lifecycle, "blocked");
    assert.equal(plan.task?.phase, "clarify");
    assert.match(plan.task?.blocked_reason ?? "", /Acceptance Criteria/);
    assert.match(plan.task?.next_action ?? "", /observable result/);
  });

  it("creates and consumes a task-local resume note", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-resume-test", title: "Resume test" });

    const withResume = await createResumeNoteViaCli(root, "0001-resume-test", "# Resume\n\nContinue from check.\n", "User resumes work");
    assert.equal(withResume.artifacts.resume, "resume.md");
    assert.equal(withResume.resume_condition, "User resumes work");
    await assert.rejects(
      createResumeNoteViaCli(root, "0001-resume-test", "# Resume\n\nSecond note.\n"),
      /already has a resume note/
    );

    const consumed = await consumeResumeNoteViaCli(root, "0001-resume-test");
    assert.equal(consumed.artifacts.resume, null);
    assert.equal(consumed.resume_condition, null);
    const stored = await readTaskStateFile(root, "0001-resume-test");
    assert.equal(stored.artifacts.resume, null);
    assert.equal(stored.resume_condition, null);
  });

  it("loads resume context without consuming the resume note", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-resume-flow", title: "Resume flow", phase: "run", nextAction: "Continue run" });
    await createResumeNoteViaCli(root, "0001-resume-flow", "# Resume\n\nContinue from run.\n", "User resumes work");
    await setTaskStateViaCli(root, "0001-resume-flow", {
      lifecycle: "parked",
      parkedReason: "Paused by user",
      resumeCondition: "User resumes work"
    });

    const result = await runWorkflowAction(root, "resume", { taskId: "0001-resume-flow" });

    assert.equal(result.task?.lifecycle, "open");
    assert.equal(result.task?.artifacts.resume, "resume.md");
    assert.equal(result.task?.resume_condition, "User resumes work");
    assert.equal(result.details?.resume_path, "resume.md");
    assert.equal(result.details?.consumed, false);
    assert.match(String(result.details?.resume_content), /Continue from run/);
    assert.match(await readFile(path.join(root, ".cw/tasks/0001-resume-flow/resume.md"), "utf8"), /Continue from run/);

    const run = await runWorkflowAction(root, "run", { taskId: "0001-resume-flow" });

    assert.equal(run.task?.artifacts.resume, null);
    await assert.rejects(access(path.join(root, ".cw/tasks/0001-resume-flow/resume.md")));
    assert.match(await readFile(path.join(root, ".cw/tasks/0001-resume-flow/trace.jsonl"), "utf8"), /resume.consumed/);
  });

  it("creates and syncs a baseline delta", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-baseline-test", title: "Baseline test" });

    const withDelta = await ensureBaselineDeltaViaCli(root, "0001-baseline-test");
    assert.equal(withDelta.artifacts.baseline_delta, "baseline-delta.md");
    await writeFile(
      path.join(root, ".cw/tasks/0001-baseline-test/baseline-delta.md"),
      "# Baseline Delta\n\n## commands.md\n\nRun `npm test` before finish.\n",
      "utf8"
    );

    await assert.rejects(
      syncBaselineDeltaViaCli(root, "0001-baseline-test", "accepted"),
      /confirmed current-state content/
    );

    const result = await syncBaselineDeltaViaCli(root, "0001-baseline-test", "accepted", {
      editedMarkdown: "# Baseline Delta\n\n## commands.md\n\n# Commands\n\n## Test\n\nRun `npm test` before finish.\n"
    });
    assert.deepEqual(result.updated, [".cw/project/commands.md"]);
    assert.equal(
      await readFile(path.join(root, ".cw/project/commands.md"), "utf8"),
      "# Commands\n\n## Test\n\nRun `npm test` before finish.\n"
    );
    assert.doesNotMatch(await readFile(path.join(root, ".cw/project/commands.md"), "utf8"), /## From/);
  });

  it("syncs selected, edited, and skipped baseline delta decisions", async () => {
    const root = await tempRoot();
    await initProject(root);
    const originalRules = await readFile(path.join(root, ".cw/project/rules.md"), "utf8");

    await createTaskViaCli(root, { id: "0001-selected-baseline", title: "Selected baseline" });
    await ensureBaselineDeltaViaCli(root, "0001-selected-baseline");
    await writeFile(
      path.join(root, ".cw/tasks/0001-selected-baseline/baseline-delta.md"),
      "# Baseline Delta\n\n## commands.md\n\nUse `npm test`.\n\n## rules.md\n\nReview checklist before finish.\n",
      "utf8"
    );
    const selected = await syncBaselineDeltaViaCli(root, "0001-selected-baseline", "selected", {
      selectedFiles: ["commands.md"],
      editedMarkdown: "# Baseline Delta\n\n## commands.md\n\n# Commands\n\n## Test\n\nUse `npm test`.\n\n## rules.md\n\n# Rules\n\n## Review\n\nReview checklist before finish.\n"
    });
    assert.deepEqual(selected.updated, [".cw/project/commands.md"]);
    assert.equal(
      await readFile(path.join(root, ".cw/project/commands.md"), "utf8"),
      "# Commands\n\n## Test\n\nUse `npm test`.\n"
    );
    assert.equal(await readFile(path.join(root, ".cw/project/rules.md"), "utf8"), originalRules);

    await createTaskViaCli(root, { id: "0002-edited-baseline", title: "Edited baseline" });
    await ensureBaselineDeltaViaCli(root, "0002-edited-baseline");
    const edited = await syncBaselineDeltaViaCli(root, "0002-edited-baseline", "edited", {
      editedMarkdown: "# Baseline Delta\n\n## rules.md\n\n# Rules\n\n## Review\n\nEdited baseline rule.\n"
    });
    assert.deepEqual(edited.updated, [".cw/project/rules.md"]);
    assert.equal(
      await readFile(path.join(root, ".cw/project/rules.md"), "utf8"),
      "# Rules\n\n## Review\n\nEdited baseline rule.\n"
    );

    await createTaskViaCli(root, { id: "0003-skipped-baseline", title: "Skipped baseline" });
    await ensureBaselineDeltaViaCli(root, "0003-skipped-baseline");
    const skipped = await syncBaselineDeltaViaCli(root, "0003-skipped-baseline", "skipped");
    assert.deepEqual(skipped.updated, []);
  });

  it("finishes a task only through the closure gate", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-finish-test", title: "Finish test" });

    await assert.rejects(
      setTaskStateViaCli(root, "0001-finish-test", { lifecycle: "closed" }),
      /use finishTask/
    );
    await assert.rejects(
      finishTaskViaCli(root, "0001-finish-test", { summary: "Done" }),
      /closure gate failed/
    );

    await writeFile(
      path.join(root, ".cw/tasks/0001-finish-test/spec.md"),
      "# Spec\n\n## Acceptance Criteria\n- [x] Works\n",
      "utf8"
    );
    await writeFile(
      path.join(root, ".cw/tasks/0001-finish-test/task.md"),
      "# Task\n\n## Implementation\n- [x] Implemented\n\n## Verification\n- [x] Tested\n\n## Check\n- [x] Acceptance criteria in spec.md are covered.\n",
      "utf8"
    );
    await setTaskStateViaCli(root, "0001-finish-test", {
      phase: "finish",
      nextAction: "Run cw-finish after user confirmation"
    });
    await createResumeNoteViaCli(root, "0001-finish-test", "# Resume\n\nClose from finish.\n");

    const finished = await finishTaskViaCli(root, "0001-finish-test", { summary: "Task finished" });
    assert.equal(finished.lifecycle, "closed");
    assert.equal(finished.phase, "finish");
    assert.equal(finished.next_action, "Task is closed");
    assert.equal(finished.artifacts.resume, null);
    await assert.rejects(access(path.join(root, ".cw/tasks/0001-finish-test")));
    assert.match(await readFile(path.join(root, ".cw/tasks/archived/0001-finish-test/task.json"), "utf8"), /"lifecycle": "closed"/);
    const archivedTrace = await readFile(path.join(root, ".cw/tasks/archived/0001-finish-test/trace.jsonl"), "utf8");
    assert.match(archivedTrace, /resume.consumed/);
    assert.match(archivedTrace, /task.finished/);
    assert.deepEqual(await listTasksViaCli(root), []);
    assert.deepEqual((await listTasksViaCli(root, { scope: "archived" })).map((task) => task.id), ["0001-finish-test"]);
    assert.deepEqual(await validateProject(root), []);
    await assert.rejects(selectTaskViaCli(root, { taskId: "0001" }), /archived/);
    const report = await runPreflightViaCli(root, { action: "work" });
    assert.equal(report.task, null);
  });

  it("blocks finish when check records unresolved drift", async () => {
    const root = await tempRoot();
    await initProject(root);
    await runWorkflowAction(root, "work", { taskId: "0001-drift-test", title: "Drift test" });
    await runWorkflowAction(root, "clarify", {
      taskId: "0001-drift-test",
      goal: "Keep behavior aligned.",
      acceptance: ["Drift is resolved before finish"]
    });
    await runWorkflowAction(root, "plan", { taskId: "0001-drift-test" });
    await runWorkflowAction(root, "run", { taskId: "0001-drift-test", summary: "Implementation changed behavior." });

    const check = await runWorkflowAction(root, "check", {
      taskId: "0001-drift-test",
      drift: true,
      summary: "Spec drift found."
    });

    assert.equal(check.task?.phase, "check");
    assert.ok(check.task?.health_flags.includes("drift_suspected"));
    await assert.rejects(
      runWorkflowAction(root, "finish", { taskId: "0001-drift-test", summary: "Done" }),
      /unresolved drift/
    );
  });

  it("requires explicit confirmation before syncing high-impact baseline deltas during finish", async () => {
    const root = await tempRoot();
    await initProject(root);
    await runWorkflowAction(root, "work", { taskId: "0001-high-impact-baseline", title: "High impact baseline" });
    await runWorkflowAction(root, "clarify", {
      taskId: "0001-high-impact-baseline",
      goal: "Document an architecture fact.",
      acceptance: ["Architecture fact is documented"]
    });
    await runWorkflowAction(root, "plan", { taskId: "0001-high-impact-baseline" });
    await runWorkflowAction(root, "run", { taskId: "0001-high-impact-baseline", summary: "Architecture note prepared." });
    await runWorkflowAction(root, "check", {
      taskId: "0001-high-impact-baseline",
      summary: "Manual review passed.",
      manualVerification: "Reviewed architecture wording."
    });
    await ensureBaselineDeltaViaCli(root, "0001-high-impact-baseline");
    await writeFile(
      path.join(root, ".cw/tasks/0001-high-impact-baseline/baseline-delta.md"),
      "# Baseline Delta\n\n## architecture.md\n\nArchitecture now documents the workflow kernel boundary.\n",
      "utf8"
    );

    await assert.rejects(
      runWorkflowAction(root, "finish", {
        taskId: "0001-high-impact-baseline",
        summary: "Done",
        decision: "accepted",
        editedBaselineDelta: "# Baseline Delta\n\n## architecture.md\n\n# Architecture\n\n## Modules\n\nArchitecture now documents the workflow kernel boundary.\n"
      }),
      /high-impact baseline delta/
    );

    const finished = await runWorkflowAction(root, "finish", {
      taskId: "0001-high-impact-baseline",
      summary: "Done",
      decision: "accepted",
      editedBaselineDelta: "# Baseline Delta\n\n## architecture.md\n\n# Architecture\n\n## Modules\n\nArchitecture now documents the workflow kernel boundary.\n",
      confirmBaselineImpact: true
    });
    assert.equal(finished.task?.lifecycle, "closed");
    assert.match(await readFile(path.join(root, ".cw/project/architecture.md"), "utf8"), /workflow kernel boundary/);
  });

  it("discards a task only with explicit confirmation", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-discard-test", title: "Discard test" });

    await assert.rejects(
      discardTaskViaCli(root, "0001-discard-test", { confirmed: false, worktreeHandling: "none" }),
      /confirmation/
    );

    await discardTaskViaCli(root, "0001-discard-test", { confirmed: true, worktreeHandling: "none" });
    await assert.rejects(access(path.join(root, ".cw/tasks/0001-discard-test")));
  });

  it("doctor reports malformed task state and stale generated skills", async () => {
    const root = await tempRoot();
    await initProject(root, { harnesses: ["codex"] });
    await createTaskViaCli(root, { id: "0001-unhealthy-task", title: "Unhealthy task" });
    const taskJsonPath = path.join(root, ".cw/tasks/0001-unhealthy-task/task.json");
    const state = JSON.parse(await readFile(taskJsonPath, "utf8")) as Record<string, unknown>;
    state.next_action = "";
    state.result = "done";
    await writeFile(taskJsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await writeFile(path.join(root, ".agents/skills/cw-work/SKILL.md"), "stale", "utf8");

    const report = await doctorProject(root);

    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.path.endsWith("task.json.next_action")));
    assert.ok(report.issues.some((issue) => issue.path.endsWith("task.json.result")));
    assert.ok(report.warnings.some((warning) => warning.message.includes("stale")));
  });

  it("migrates legacy task directories to numeric ids and archives closed tasks", async () => {
    const root = await tempRoot();
    await initProject(root);
    await writeLegacyTask(root, {
      id: "task-old-closed",
      title: "Old closed",
      lifecycle: "closed",
      createdAt: "2026-07-03T01:00:00.000Z"
    });
    await writeLegacyTask(root, {
      id: "task-old-open",
      title: "Old open",
      lifecycle: "open",
      createdAt: "2026-07-03T02:00:00.000Z"
    });

    const result = await migrateTasksViaCli(root, new Date("2026-07-03T03:00:00.000Z"));

    assert.deepEqual(result.migrated.map((item) => [item.from, item.to, item.to_location]), [
      ["task-old-closed", "0001-old-closed", "archived"],
      ["task-old-open", "0002-old-open", "active"]
    ]);
    await assert.rejects(access(path.join(root, ".cw/tasks/task-old-closed")));
    await assert.rejects(access(path.join(root, ".cw/tasks/task-old-open")));
    assert.equal(
      (JSON.parse(await readFile(path.join(root, ".cw/tasks/archived/0001-old-closed/task.json"), "utf8")) as { id: string }).id,
      "0001-old-closed"
    );
    assert.equal(
      (JSON.parse(await readFile(path.join(root, ".cw/tasks/0002-old-open/task.json"), "utf8")) as { id: string }).id,
      "0002-old-open"
    );
    assert.match(await readFile(path.join(root, ".cw/tasks/archived/0001-old-closed/trace.jsonl"), "utf8"), /task.migrated/);
    assert.deepEqual((await listTasksViaCli(root)).map((task) => task.id), ["0002-old-open"]);
    assert.deepEqual((await listTasksViaCli(root, { scope: "archived" })).map((task) => task.id), ["0001-old-closed"]);
    assert.deepEqual(await validateProject(root), []);
  });

  it("understand writes drafts without directly overwriting project baseline files", async () => {
    const root = await tempRoot();
    await initProject(root);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
    await writeFile(path.join(root, ".cw/project/commands.md"), "# Commands\n\nKeep this baseline.\n", "utf8");

    const result = await runWorkflowAction(root, "understand", { merge: true });

    assert.equal(result.details?.merged, false);
    assert.match(await readFile(path.join(root, ".cw/understand-draft/commands.md"), "utf8"), /npm test/);
    assert.equal(await readFile(path.join(root, ".cw/project/commands.md"), "utf8"), "# Commands\n\nKeep this baseline.\n");
  });

  it("runs the version 1 workflow completion path end to end", async () => {
    const root = await tempRoot();
    await writeFile(path.join(root, "package.json"), JSON.stringify({
      name: "fixture",
      scripts: {
        test: "node --test",
        typecheck: "tsc --noEmit",
        build: "tsc"
      }
    }, null, 2));

    const init = await initProject(root);
    assert.deepEqual(init.adapters, []);

    const work = await runWorkflowAction(root, "work", {
      taskId: "0001-create-readme",
      title: "Create README"
    });
    assert.equal(work.task?.phase, "clarify");

    const clarify = await runWorkflowAction(root, "clarify", {
      taskId: "0001-create-readme",
      goal: "Create a README file for the fixture project.",
      scope: "Add concise project documentation.",
      acceptance: ["README.md exists", "README explains how to test"]
    });
    assert.equal(clarify.task?.phase, "plan");

    const plan = await runWorkflowAction(root, "plan", { taskId: "0001-create-readme" });
    assert.equal(plan.task?.phase, "run");
    assert.match(
      await readFile(path.join(root, ".cw/tasks/0001-create-readme/task.md"), "utf8"),
      /small, verifiable vertical slices/
    );

    const run = await runWorkflowAction(root, "run", {
      taskId: "0001-create-readme",
      summary: "README.md created.",
      writeFile: "README.md",
      content: "# Fixture\n\nRun `npm test`.\n"
    });
    assert.equal(run.task?.phase, "check");
    assert.match(await readFile(path.join(root, "README.md"), "utf8"), /Run `npm test`/);

    const check = await runWorkflowAction(root, "check", {
      taskId: "0001-create-readme",
      summary: "README.md reviewed against spec.",
      commands: ["test -f README.md"]
    });
    assert.equal(check.task?.phase, "finish");
    assert.deepEqual((check.details?.commands as Array<{ command: string }>).map((result) => result.command), ["test -f README.md"]);

    await ensureBaselineDeltaViaCli(root, "0001-create-readme");
    await writeFile(
      path.join(root, ".cw/tasks/0001-create-readme/baseline-delta.md"),
      "# Baseline Delta\n\n## commands.md\n\nUse `npm test` to verify fixture behavior.\n",
      "utf8"
    );
    const finish = await runWorkflowAction(root, "finish", {
      taskId: "0001-create-readme",
      summary: "README task complete.",
      decision: "accepted",
      editedBaselineDelta: "# Baseline Delta\n\n## commands.md\n\n# Commands\n\n## Test\n\nUse `npm test` to verify fixture behavior.\n",
      dirtyWorktree: "covered"
    });
    assert.equal(finish.task?.lifecycle, "closed");
    assert.match(await readFile(path.join(root, ".cw/project/commands.md"), "utf8"), /verify fixture behavior/);

    await createTaskViaCli(root, { id: "0002-resume-flow", title: "Resume flow" });
    await createResumeNoteViaCli(root, "0002-resume-flow", "# Resume\n\nContinue.\n");
    const resume = await runWorkflowAction(root, "resume", { taskId: "0002-resume-flow" });
    assert.equal(resume.task?.artifacts.resume, "resume.md");
    assert.equal(resume.details?.consumed, false);
    const resumedRun = await runWorkflowAction(root, "run", { taskId: "0002-resume-flow" });
    assert.equal(resumedRun.task?.artifacts.resume, null);

    await createTaskViaCli(root, { id: "0003-discard-flow", title: "Discard flow" });
    const discard = await runWorkflowAction(root, "discard", {
      taskId: "0003-discard-flow",
      confirm: true,
      worktreeHandling: "none"
    });
    assert.equal(discard.task, null);
    await assert.rejects(access(path.join(root, ".cw/tasks/0003-discard-flow")));

    const understand = await runWorkflowAction(root, "understand");
    assert.equal(understand.details?.draft_dir, ".cw/understand-draft");
    assert.match(await readFile(path.join(root, ".cw/understand-draft/commands.md"), "utf8"), /npm test/);

    const doctor = await runWorkflowAction(root, "doctor");
    assert.equal(doctor.action, "doctor");
  });
});

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "cw-kernel-"));
}

async function runCli(
  args: string[],
  options: { cwd?: string; env?: Record<string, string>; input?: string; answers?: string[] } = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [path.join(process.cwd(), "dist/src/cli.js"), ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  const answers = [...(options.answers ?? [])];
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    if ((stdout.endsWith("Choose [1]: ") || stdout.endsWith("[y/N]: ") || stdout.endsWith("[Y/n]: ")) && answers.length > 0) {
      child.stdin.write(`${answers.shift()}\n`);
    }
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  if (options.answers === undefined) {
    child.stdin.end(options.input ?? "");
  }

  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 5000);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      child.stdin.destroy();
      resolve({ code, stdout, stderr });
    });
  });
}

function parseCliJson(stdout: string): Record<string, unknown> {
  const marker = "{\n  \"created\"";
  const offset = stdout.lastIndexOf(marker);
  assert.notEqual(offset, -1, stdout);
  return JSON.parse(stdout.slice(offset)) as Record<string, unknown>;
}

type TaskSummary = Pick<TaskStateRecord, "id" | "title" | "lifecycle" | "phase" | "next_action" | "updated_at">;
type PreflightAction = Exclude<WorkflowCommandAction, "doctor">;
type PreflightReport = {
  ok: boolean;
  action: PreflightAction;
  task: TaskStateRecord | null;
  issues: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
  git: unknown;
};
type BaselineSyncResult = {
  decision: BaselineDecision;
  updated: string[];
  preview: Partial<Record<BaselineFile, string>>;
  highImpact: boolean;
};
type LegacyTaskMigrationResult = {
  migrated: Array<{
    from: string;
    to: string;
    from_location: "active" | "archived";
    to_location: "active" | "archived";
  }>;
};

async function cliJson<T>(args: string[]): Promise<T> {
  const cli = await runCli(args);
  if (cli.code !== 0) {
    throw new Error((cli.stderr || cli.stdout).trim());
  }
  return parseJsonOutput<T>(cli.stdout);
}

function parseJsonOutput<T>(stdout: string): T {
  const text = stdout.trim();
  assert.notEqual(text.length, 0, stdout);
  return JSON.parse(text) as T;
}

async function createTaskViaCli(
  root: string,
  input: { id?: string; title: string; phase?: string; nextAction?: string; now?: Date }
): Promise<TaskStateRecord> {
  const args = ["internal", "create-task", "--root", root, "--title", input.title];
  if (input.id !== undefined) {
    args.push("--id", input.id);
  }
  if (input.phase !== undefined) {
    args.push("--phase", input.phase);
  }
  if (input.nextAction !== undefined) {
    args.push("--next-action", input.nextAction);
  }
  return cliJson<TaskStateRecord>(args);
}

async function setTaskStateViaCli(
  root: string,
  taskId: string,
  input: {
    lifecycle?: TaskStateRecord["lifecycle"];
    phase?: string;
    nextAction?: string;
    blockedReason?: string | null;
    parkedReason?: string | null;
    resumeCondition?: string | null;
    now?: Date;
  }
): Promise<TaskStateRecord> {
  const args = ["internal", "set-state", "--root", root, "--task", taskId];
  if (input.lifecycle !== undefined) {
    args.push("--lifecycle", input.lifecycle);
  }
  if (input.phase !== undefined) {
    args.push("--phase", input.phase);
  }
  if (input.nextAction !== undefined) {
    args.push("--next-action", input.nextAction);
  }
  if (input.blockedReason !== undefined) {
    args.push("--blocked-reason", input.blockedReason ?? "null");
  }
  if (input.parkedReason !== undefined) {
    args.push("--parked-reason", input.parkedReason ?? "null");
  }
  if (input.resumeCondition !== undefined) {
    args.push("--resume-condition", input.resumeCondition ?? "null");
  }
  return cliJson<TaskStateRecord>(args);
}

async function readTaskStateFile(root: string, taskId: string): Promise<TaskStateRecord> {
  return JSON.parse(await readFile(path.join(root, ".cw/tasks", taskId, "task.json"), "utf8")) as TaskStateRecord;
}

async function selectTaskViaCli(root: string, input: { taskId?: string } = {}): Promise<TaskStateRecord> {
  const args = ["internal", "select-task", "--root", root];
  if (input.taskId !== undefined) {
    args.push("--task", input.taskId);
  }
  return cliJson<TaskStateRecord>(args);
}

async function listTasksViaCli(root: string, input: { scope?: "active" | "archived" | "all" } = {}): Promise<TaskSummary[]> {
  const args = ["tasks", "--root", root];
  if (input.scope === "archived") {
    args.push("--archived");
  } else if (input.scope === "all") {
    args.push("--all");
  }
  return (await cliJson<{ tasks: TaskSummary[] }>(args)).tasks;
}

async function runPreflightViaCli(root: string, input: { action: PreflightAction; taskId?: string }): Promise<PreflightReport> {
  const args = ["preflight", "--root", root, "--action", input.action];
  if (input.taskId !== undefined) {
    args.push("--task", input.taskId);
  }
  return cliJson<PreflightReport>(args);
}

async function createResumeNoteViaCli(
  root: string,
  taskId: string,
  content: string,
  resumeCondition?: string | null
): Promise<TaskStateRecord> {
  const args = ["internal", "create-resume", "--root", root, "--task", taskId, "--content", content];
  if (resumeCondition !== undefined) {
    args.push("--resume-condition", resumeCondition ?? "null");
  }
  return cliJson<TaskStateRecord>(args);
}

async function consumeResumeNoteViaCli(root: string, taskId: string): Promise<TaskStateRecord> {
  return cliJson<TaskStateRecord>(["internal", "consume-resume", "--root", root, "--task", taskId]);
}

async function ensureBaselineDeltaViaCli(root: string, taskId: string): Promise<TaskStateRecord> {
  return cliJson<TaskStateRecord>(["internal", "ensure-baseline-delta", "--root", root, "--task", taskId]);
}

async function syncBaselineDeltaViaCli(
  root: string,
  taskId: string,
  decision: BaselineDecision,
  options: { selectedFiles?: BaselineFile[]; editedMarkdown?: string } = {}
): Promise<BaselineSyncResult> {
  const args = ["internal", "sync-baseline-delta", "--root", root, "--task", taskId, "--decision", decision];
  if (options.selectedFiles !== undefined) {
    args.push("--selected-files", options.selectedFiles.join(","));
  }
  if (options.editedMarkdown !== undefined) {
    args.push("--edited-content", options.editedMarkdown);
  }
  return cliJson<BaselineSyncResult>(args);
}

async function finishTaskViaCli(
  root: string,
  taskId: string,
  input: {
    summary: string;
    dirtyWorktreeHandling?: DirtyWorktreeDecision;
    baselineDecision?: BaselineDecision | "none";
    now?: Date;
  }
): Promise<TaskStateRecord> {
  const args = ["internal", "finish-task", "--root", root, "--task", taskId, "--summary", input.summary];
  if (input.dirtyWorktreeHandling !== undefined) {
    args.push("--dirty-worktree", input.dirtyWorktreeHandling);
  }
  if (input.baselineDecision !== undefined) {
    args.push("--baseline", input.baselineDecision);
  }
  return cliJson<TaskStateRecord>(args);
}

async function discardTaskViaCli(
  root: string,
  taskId: string,
  input: { confirmed: boolean; worktreeHandling: "keep" | "stash" | "revert" | "delete-worktree" | "none"; now?: Date }
): Promise<void> {
  const args = ["internal", "discard-task", "--root", root, "--task", taskId, "--worktree", input.worktreeHandling];
  if (input.confirmed) {
    args.push("--confirm");
  }
  await cliJson<{ ok: true }>(args);
}

async function migrateTasksViaCli(root: string, _now?: Date): Promise<LegacyTaskMigrationResult> {
  return cliJson<LegacyTaskMigrationResult>(["internal", "migrate-task-ids", "--root", root]);
}

async function readTrace(root: string, taskId: string): Promise<Array<Record<string, unknown>>> {
  const text = await readFile(path.join(root, ".cw/tasks", taskId, "trace.jsonl"), "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function writeLegacyTask(
  root: string,
  input: { id: string; title: string; lifecycle: "open" | "closed"; createdAt: string }
): Promise<void> {
  const dir = path.join(root, ".cw/tasks", input.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "spec.md"), "# Spec\n", "utf8");
  await writeFile(path.join(dir, "plan.md"), "# Plan\n", "utf8");
  await writeFile(path.join(dir, "task.md"), "# Task\n", "utf8");
  await writeFile(path.join(dir, "trace.jsonl"), "", "utf8");
  await writeFile(
    path.join(dir, "task.json"),
    `${JSON.stringify({
      id: input.id,
      title: input.title,
      lifecycle: input.lifecycle,
      phase: input.lifecycle === "closed" ? "finish" : "run",
      next_action: input.lifecycle === "closed" ? "Task is closed" : "Execute implementation",
      health_flags: [],
      artifacts: {
        spec: "spec.md",
        plan: "plan.md",
        task: "task.md",
        baseline_delta: null,
        resume: null
      },
      invalidated_artifacts: [],
      blocked_reason: null,
      parked_reason: null,
      resume_condition: null,
      created_at: input.createdAt,
      updated_at: input.createdAt,
      schema_version: 1
    }, null, 2)}\n`,
    "utf8"
  );
}
