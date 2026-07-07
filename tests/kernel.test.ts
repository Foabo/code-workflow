import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
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
  WorkflowOptions,
  WorkflowResult
} from "../src/index.js";

describe("ff kernel", () => {
  it("initializes a project with version, baseline, task templates, and valid structure", async () => {
    const root = await tempRoot();

    const result = await initProject(root, new Date("2026-07-03T00:00:00.000Z"));

    assert.ok(result.created.includes(".ff/version.json"));
    assert.ok(result.created.includes(".ff/project/overview.md"));
    assert.ok(result.created.includes(".ff/enhancements.json"));
    assert.ok(result.created.includes(".ff/orchestration.json"));
    assert.ok(result.created.includes(".ff/templates/spec.md"));
    assert.match(
      await readFile(path.join(root, ".ff/templates/task.md"), "utf8"),
      /Baseline Outcome is recorded/
    );
    assert.deepEqual(result.adapters, []);
    await assert.rejects(access(path.join(root, ".ff/agent-commands")));
    assert.deepEqual(await validateProject(root), []);
    const doctor = await doctorProject(root);
    assert.equal(doctor.ok, true);
    assert.deepEqual(doctor.enhancements, { code_intelligence: "skipped", external_context: "skipped" });
  });

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

  it("generates repo-local agent skills for the Codex harness", async () => {
    const root = await tempRoot();

    const result = await initProject(root, { harnesses: ["codex"] });

    assert.equal(result.adapters[0]?.harness, "codex");
    assert.ok(result.adapters[0]?.created.includes(".agents/skills/ff-work/SKILL.md"));
    assert.ok(result.adapters[0]?.created.includes(".codex/agents/ff-advisor.toml"));
    assert.ok(result.adapters[0]?.created.includes(".codex/hooks.json"));
    await assert.rejects(access(path.join(root, ".ff/agent-commands")));
    await assert.rejects(access(path.join(root, ".agents/plugins/marketplace.json")));
    await assert.rejects(access(path.join(root, ".codex/skills/ff-work/SKILL.md")));
    await assert.rejects(access(path.join(root, "plugins/ff-workflow/.codex-plugin/plugin.json")));
    const skill = await readFile(path.join(root, ".agents/skills/ff-work/SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: ff-work/m);
    assert.match(skill, /Treat `\.ff` as Repo Truth/);
    assert.match(skill, /ff preflight --action work/);
    assert.match(skill, /routine progress command/);
    assert.match(skill, /Repeated `\/ff-work` calls/);
    assert.match(skill, /Use task truth to choose the next responsibility/);
    assert.match(skill, /Do not close tasks from `ff-work`/);
    assert.match(skill, /## Execution Strategy Guidance/);
    assert.match(skill, /Inline execution must remain complete/);
    assert.match(skill, /\.ff\/orchestration\.json/);
    assert.match(skill, /generated `ff-<role>` agent files/);
    assert.match(skill, /Explicitly ask the harness to spawn the named `ff-<role>` agent/);
    assert.match(skill, /Delegation is optional and permission-bound/);
    assert.match(skill, /Role routing for this command/);
    assert.match(skill, /Clarify phase: use `ff-advisor`/);
    assert.match(skill, /Plan phase: use `ff-planner`/);
    assert.match(skill, /Run phase: use `ff-implementer`/);
    assert.match(skill, /Check phase: use `ff-checker`/);
    assert.match(skill, /Finish phase: use `ff-baseline-writer`/);
    assert.match(skill, /Delegation may help only when/);
    assert.match(skill, /perform the same responsibilities inline/);
    assert.doesNotMatch(skill, /Advisor findings are advisory evidence/);
    assert.doesNotMatch(skill, /Subagent use requires harness support/);
    assert.doesNotMatch(skill, /Hybrid execution is recommended/);
    assert.doesNotMatch(skill, /Implementer subagents may write code/);
    assert.doesNotMatch(skill, /Checker subagents must return spec drift/);
    assert.doesNotMatch(skill, /generated-by-ff/);
    const advisorAgent = await readFile(path.join(root, ".codex/agents/ff-advisor.toml"), "utf8");
    assert.match(advisorAgent, /name = "ff-advisor"/);
    assert.match(advisorAgent, /model_reasoning_effort = "high"/);
    assert.match(advisorAgent, /developer_instructions = """\n# ff-advisor/);
    assert.doesNotMatch(advisorAgent, /developer_instructions = "# ff-advisor\\n/);
    assert.match(advisorAgent, /Watch bounded primary-session deltas/);
    assert.match(advisorAgent, /Do not ask the user directly/);
    assert.match(advisorAgent, /severity: nit \| concern \| blocker/);
    assert.match(advisorAgent, /proposal hash/);
    const codexWatchdog = await readFile(path.join(root, ".codex/hooks.json"), "utf8");
    assert.match(codexWatchdog, /ff internal validate-clarify --watchdog/);
    const implementerAgent = await readFile(path.join(root, ".codex/agents/ff-implementer.toml"), "utf8");
    assert.match(implementerAgent, /Modify code and tests within the accepted task contract/);
    assert.match(implementerAgent, /Do not decide requirement drift/);
    for (const skillName of await readdir(path.join(root, ".agents/skills"))) {
      const skill = await readFile(path.join(root, ".agents/skills", skillName, "SKILL.md"), "utf8");
      assert.match(skill, new RegExp(`Use this skill for the \`${skillName}\` Flowflow workflow action`));
      assert.doesNotMatch(skill, /asks Codex to run/);
    }
    const clarifySkill = await readFile(path.join(root, ".agents/skills/ff-clarify/SKILL.md"), "utf8");
    assert.match(clarifySkill, /## Clarify Protocol/);
    assert.match(clarifySkill, /### Brainstorm Pass/);
    assert.match(clarifySkill, /Purpose: clarify the user's desired outcome/);
    assert.match(clarifySkill, /Restate the goal and motivation/);
    assert.match(clarifySkill, /at most three viable directions/);
    assert.match(clarifySkill, /recommend the smallest sufficient path/);
    assert.match(clarifySkill, /assumptions, risks, and acceptance evidence/);
    assert.match(clarifySkill, /Open Decisions/);
    assert.match(clarifySkill, /Do not write spec\.md during Brainstorm Pass/);
    assert.match(clarifySkill, /### Grill Loop/);
    assert.match(clarifySkill, /Input: use the Brainstorm Pass Open Decisions and any high-risk assumptions/);
    assert.match(clarifySkill, /Ask one concrete question at a time/);
    assert.match(clarifySkill, /recommended answer and the trade-off/);
    assert.match(clarifySkill, /workflow-semantics, CLI\/API, task-lifecycle, state-machine, cross-module, or baseline-promotion decisions/);
    assert.match(clarifySkill, /Stop only when the goal, boundary, acceptance criteria, key risks, and important trade-offs are clear enough/);
    assert.match(clarifySkill, /do not rely on another skill or cross-skill lookup/);
    assert.match(clarifySkill, /advisor review of the current Proposed Spec/);
    assert.match(clarifySkill, /proposal identity/);
    assert.match(clarifySkill, /degraded execution/);
    assert.match(clarifySkill, /validate-clarify/);
    assert.match(clarifySkill, /propose-spec/);
    assert.match(clarifySkill, /accept-spec/);
    assert.match(clarifySkill, /proposal_hash = sha256/);
    assert.match(clarifySkill, /Do not create clarify\.md/);
    assert.match(clarifySkill, /one concrete question at a time/);
    assert.match(clarifySkill, /would this wording let an agent skip challenge/);
    assert.match(clarifySkill, /Proposed Spec/);
    assert.match(clarifySkill, /confirmed long-term project facts/);
    assert.match(clarifySkill, /do not update Project Baseline files during clarify/);
    assert.match(clarifySkill, /Inline execution must remain complete/);
    assert.doesNotMatch(clarifySkill, /## Execution Strategy Guidance/);
    assert.doesNotMatch(clarifySkill, /fast path/);
    assert.doesNotMatch(clarifySkill, /ff-brainstorm/);
    assert.doesNotMatch(clarifySkill, /ff-grill/);
    assertInOrder(clarifySkill, ["### Brainstorm Pass", "### Grill Loop"]);
    assertInOrder(clarifySkill, [
      "Brainstorm Pass -> Grill Loop -> Proposed Spec",
      "advisor review of the current Proposed Spec",
      "concern/blocker handling",
      "explicit accept",
      "validate-clarify --stage advance"
    ]);
    const skillNames = await readdir(path.join(root, ".agents/skills"));
    assert.ok(!skillNames.includes("ff-brainstorm"));
    assert.ok(!skillNames.includes("ff-grill"));
    const planSkill = await readFile(path.join(root, ".agents/skills/ff-plan/SKILL.md"), "utf8");
    assert.match(planSkill, /spec quality gate/);
    assert.match(planSkill, /Do not modify spec\.md during planning/);
    assert.match(planSkill, /one concrete next question/);
    assert.match(planSkill, /vertical slices/);
    assert.match(planSkill, /## Execution Strategy Guidance/);
    assert.match(planSkill, /Delegation is optional and permission-bound/);
    assert.match(planSkill, /role and model contract/);
    assert.match(planSkill, /Use `ff-planner` to draft plan\.md and task\.md/);
    assert.match(planSkill, /Use `ff-reviewer` for post-plan cross-review/);
    assert.match(planSkill, /Post-plan artifact cross-review/);
    assert.match(planSkill, /user or environment permission allow delegation/);
    assert.match(planSkill, /run the same check inline/);
    assert.match(planSkill, /behavior-review checks/);
    assert.match(planSkill, /deterministic tests separate from behavior review/);
    assert.match(planSkill, /stable design, workflow, command, or rule candidates/);
    const runSkill = await readFile(path.join(root, ".agents/skills/ff-run/SKILL.md"), "utf8");
    assert.match(runSkill, /accepted task contract/);
    assert.match(runSkill, /requirement drift/);
    assert.match(runSkill, /Behavior changes require test evidence/);
    assert.match(runSkill, /## Execution Strategy Guidance/);
    assert.match(runSkill, /Delegation is optional and permission-bound/);
    assert.match(runSkill, /Use `ff-implementer` only for bounded, independent implementation slices/);
    assert.doesNotMatch(runSkill, /Advisor findings are advisory evidence/);
    assert.doesNotMatch(runSkill, /blocker findings must be resolved/);
    assert.match(runSkill, /permission allow delegation/);
    assert.match(runSkill, /same checklist items inline/);
    assert.match(runSkill, /must not close tasks or decide requirement drift/);
    assert.doesNotMatch(runSkill, /Subagents are optional\. Use them/);
    assert.match(runSkill, /External TDD, domain modeling, implement, Superpowers, or subagent skills may help when installed/);
    const checkSkill = await readFile(path.join(root, ".agents/skills/ff-check/SKILL.md"), "utf8");
    assert.match(checkSkill, /Artifact alignment review/);
    assert.match(checkSkill, /Implementation evidence review/);
    assert.match(checkSkill, /--baseline-outcome <text>/);
    assert.match(checkSkill, /environment, action, and result/);
    assert.match(checkSkill, /## Execution Strategy Guidance/);
    assert.match(checkSkill, /Delegation is optional and permission-bound/);
    assert.match(checkSkill, /Use `ff-checker` for verification commands/);
    assert.match(checkSkill, /Use `ff-reviewer` for artifact alignment/);
    assert.match(checkSkill, /permission allow delegation/);
    assert.match(checkSkill, /same artifact and evidence review inline/);
    assert.match(checkSkill, /final broad review/);
    assert.match(checkSkill, /Record one Baseline Outcome before finish/);
    assert.match(checkSkill, /no reusable project facts/);
    const finishSkill = await readFile(path.join(root, ".agents/skills/ff-finish/SKILL.md"), "utf8");
    assert.match(finishSkill, /closure packet/);
    assert.match(finishSkill, /does not create commits/);
    assert.match(finishSkill, /current-state descriptions/);
    assert.match(finishSkill, /merge it by default/);
    assert.match(finishSkill, /default baseline decision is accepted/);
    assert.match(finishSkill, /--selected-files <overview\.md,architecture\.md,rules\.md,commands\.md>/);
    assert.match(finishSkill, /## Execution Strategy Guidance/);
    assert.match(finishSkill, /Use `ff-baseline-writer` to draft current-state Project Baseline updates/);
    assert.match(finishSkill, /main session must review the draft/);
    assert.match(finishSkill, /CLI core must not call an LLM/);
    const resumeSkill = await readFile(path.join(root, ".agents/skills/ff-resume/SKILL.md"), "utf8");
    assert.match(resumeSkill, /user-triggered continuation/);
    assert.match(resumeSkill, /task artifacts remain the task truth/);
    assert.match(resumeSkill, /kernel consumes it automatically after a later workflow action records material progress/);
    const doctorSkill = await readFile(path.join(root, ".agents/skills/ff-doctor/SKILL.md"), "utf8");
    assert.match(doctorSkill, /repository-level diagnosis/);
    assert.match(doctorSkill, /issues before warnings/);
    assert.match(doctorSkill, /read-only by default/);
    const understandSkill = await readFile(path.join(root, ".agents/skills/ff-understand/SKILL.md"), "utf8");
    assert.match(understandSkill, /draft-first repository observation/);
    assert.match(understandSkill, /Separate observed facts from inferences/);
    assert.match(understandSkill, /never overwrite \.ff\/project\/\*/);
    const discardSkill = await readFile(path.join(root, ".agents/skills/ff-discard/SKILL.md"), "utf8");
    for (const supportSkill of [clarifySkill, resumeSkill, doctorSkill, understandSkill, discardSkill]) {
      assert.match(supportSkill, /Inline execution must remain complete/);
      assert.doesNotMatch(supportSkill, /## Execution Strategy Guidance/);
      assert.doesNotMatch(supportSkill, /Delegation is optional and permission-bound/);
      assert.doesNotMatch(supportSkill, /Delegated work receives task artifacts/);
      assert.doesNotMatch(supportSkill, /Delegated agents must not close tasks/);
      assert.doesNotMatch(supportSkill, /Subagent use requires harness support/);
      assert.doesNotMatch(supportSkill, /Hybrid execution is recommended/);
      assert.doesNotMatch(supportSkill, /Implementer subagents may write code/);
      assert.doesNotMatch(supportSkill, /Checker subagents must return spec drift/);
    }

    await writeFile(path.join(root, ".agents/skills/ff-work/SKILL.md"), "stale", "utf8");
    await writeFile(path.join(root, ".codex/agents/ff-advisor.toml"), "stale", "utf8");
    const staleReport = await doctorProject(root);
    assert.equal(staleReport.ok, false);
    assert.ok(staleReport.warnings.some((warning) => warning.path === ".agents/skills/ff-work/SKILL.md"));
    assert.ok(staleReport.warnings.some((warning) => warning.path === ".codex/agents/ff-advisor.toml"));

    const update = await updateProject(root, ["codex"]);
    assert.equal(update.validation.ok, true);
    assert.match(await readFile(path.join(root, ".agents/skills/ff-work/SKILL.md"), "utf8"), /ff preflight --action work/);
    assert.match(await readFile(path.join(root, ".codex/agents/ff-advisor.toml"), "utf8"), /Watch bounded primary-session deltas/);
  });

  it("renders Codex role agents from role-specific orchestration model overrides", async () => {
    const root = await tempRoot();
    await initProject(root, { harnesses: ["codex"] });
    const orchestrationPath = path.join(root, ".ff/orchestration.json");
    const orchestration = JSON.parse(await readFile(orchestrationPath, "utf8")) as Record<string, unknown>;
    const harnessOverrides = orchestration.harness_overrides as Record<string, Record<string, Record<string, unknown>>>;
    harnessOverrides.codex = {
      advisor: { model: "gpt-5.5", reasoning_effort: "xhigh" },
      planner: { model: "gpt-5.5", reasoning_effort: "high" },
      implementer: { model: "gpt-5.5", reasoning_effort: "medium" },
      reviewer: { model: "gpt-5.5", reasoning_effort: "high" },
      checker: { model: "gpt-5.4-mini", reasoning_effort: "medium" },
      "baseline-writer": { model: "gpt-5.4-mini", reasoning_effort: "low" }
    };
    await writeFile(orchestrationPath, JSON.stringify(orchestration, null, 2), "utf8");

    const doctorBeforeUpdate = await doctorProject(root);
    assert.equal(doctorBeforeUpdate.ok, false);
    assert.ok(doctorBeforeUpdate.warnings.some((warning) => warning.path === ".codex/agents/ff-advisor.toml"));

    const update = await updateProject(root, ["codex"]);
    assert.equal(update.validation.ok, true);
    const expectedAgents = [
      ["advisor", "gpt-5.5", "xhigh"],
      ["planner", "gpt-5.5", "high"],
      ["implementer", "gpt-5.5", "medium"],
      ["reviewer", "gpt-5.5", "high"],
      ["checker", "gpt-5.4-mini", "medium"],
      ["baseline-writer", "gpt-5.4-mini", "low"]
    ] as const;
    for (const [role, model, reasoningEffort] of expectedAgents) {
      const agent = await readFile(path.join(root, `.codex/agents/ff-${role}.toml`), "utf8");
      assert.match(agent, new RegExp(`model = "${model.replace(".", "\\.")}"`));
      assert.match(agent, new RegExp(`model_reasoning_effort = "${reasoningEffort}"`));
      assert.match(agent, new RegExp(`developer_instructions = """\\n# ff-${role}`));
    }
  });

  it("renders OpenCode role agents with model, optional temperature, and explicit tools permissions", async () => {
    const root = await tempRoot();
    await initProject(root, { harnesses: ["opencode"] });
    const orchestrationPath = path.join(root, ".ff/orchestration.json");
    const orchestration = JSON.parse(await readFile(orchestrationPath, "utf8")) as Record<string, unknown>;
    const harnessOverrides = orchestration.harness_overrides as Record<string, Record<string, Record<string, unknown>>>;
    harnessOverrides.opencode = {
      advisor: { model: "anthropic/claude-sonnet-4-20250514", temperature: 0.1 }
    };
    await writeFile(orchestrationPath, JSON.stringify(orchestration, null, 2), "utf8");

    const update = await updateProject(root, ["opencode"]);
    assert.equal(update.validation.ok, true);
    const advisorAgent = await readFile(path.join(root, ".opencode/agents/ff-advisor.md"), "utf8");
    assert.match(advisorAgent, /model: anthropic\/claude-sonnet-4-20250514/);
    assert.match(advisorAgent, /temperature: 0\.1/);
    assert.match(advisorAgent, /tools:\n  write: false\n  edit: false\n  bash: false/);
    assert.match(advisorAgent, /Model profile: high-reasoning, high reasoning, anthropic\/claude-sonnet-4-20250514, temperature 0\.1/);
  });

  it("generates Claude, OpenCode, Pi, and Cursor harness entries", async () => {
    const claudeRoot = await tempRoot();
    const opencodeRoot = await tempRoot();
    const piRoot = await tempRoot();
    const cursorRoot = await tempRoot();

    const claude = await initProject(claudeRoot, { harnesses: ["claude"] });
    const opencode = await initProject(opencodeRoot, { harnesses: ["opencode"] });
    const pi = await initProject(piRoot, { harnesses: ["pi"] });
    const cursor = await initProject(cursorRoot, { harnesses: ["cursor"] });

    assert.equal(claude.adapters[0]?.harness, "claude");
    assert.ok(claude.adapters[0]?.created.includes(".claude/skills/ff-work/SKILL.md"));
    assert.ok(claude.adapters[0]?.created.includes(".claude/agents/ff-advisor.md"));
    assert.ok(claude.adapters[0]?.created.includes(".claude/settings.json"));
    await assert.rejects(access(path.join(claudeRoot, ".ff/agent-commands")));
    await assert.rejects(access(path.join(claudeRoot, ".claude/commands")));
    const claudeSkill = await readFile(path.join(claudeRoot, ".claude/skills/ff-work/SKILL.md"), "utf8");
    assert.match(claudeSkill, /^---\nname: ff-work/m);
    assert.match(claudeSkill, /Use this skill for the `ff-work` Flowflow workflow action/);
    assert.doesNotMatch(claudeSkill, /asks Claude to run/);
    for (const skillName of await readdir(path.join(claudeRoot, ".claude/skills"))) {
      const skill = await readFile(path.join(claudeRoot, ".claude/skills", skillName, "SKILL.md"), "utf8");
      assert.match(skill, new RegExp(`Use this skill for the \`${skillName}\` Flowflow workflow action`));
      assert.doesNotMatch(skill, /asks Claude to run/);
    }
    assert.match(claudeSkill, /ff preflight --action work/);
    const claudeAdvisor = await readFile(path.join(claudeRoot, ".claude/agents/ff-advisor.md"), "utf8");
    assert.match(claudeAdvisor, /^---\nname: ff-advisor/m);
    assert.match(claudeAdvisor, /tools: Read, Grep, Glob/);
    assert.match(await readFile(path.join(claudeRoot, ".claude/settings.json"), "utf8"), /ff internal validate-clarify --watchdog/);

    assert.equal(opencode.adapters[0]?.harness, "opencode");
    assert.ok(opencode.adapters[0]?.created.includes(".agents/skills/ff-work/SKILL.md"));
    assert.ok(opencode.adapters[0]?.created.includes(".opencode/agents/ff-advisor.md"));
    assert.ok(opencode.adapters[0]?.created.includes(".opencode/plugins/ff-clarify-watchdog.ts"));
    await assert.rejects(access(path.join(opencodeRoot, ".ff/agent-commands")));
    await assert.rejects(access(path.join(opencodeRoot, ".opencode/commands")));
    const opencodeSkill = await readFile(path.join(opencodeRoot, ".agents/skills/ff-work/SKILL.md"), "utf8");
    assert.match(opencodeSkill, /^---\nname: ff-work/m);
    assert.match(opencodeSkill, /Use this skill for the `ff-work` Flowflow workflow action/);
    assert.doesNotMatch(opencodeSkill, /asks OpenCode to run/);
    assert.match(opencodeSkill, /ff preflight --action work/);
    const opencodeAdvisor = await readFile(path.join(opencodeRoot, ".opencode/agents/ff-advisor.md"), "utf8");
    assert.match(opencodeAdvisor, /mode: subagent/);
    assert.match(opencodeAdvisor, /temperature: 0\.1/);
    assert.match(opencodeAdvisor, /tools:\n  write: false\n  edit: false\n  bash: false/);
    assert.match(
      await readFile(path.join(opencodeRoot, ".opencode/plugins/ff-clarify-watchdog.ts"), "utf8"),
      /ff internal validate-clarify --watchdog/
    );

    assert.equal(pi.adapters[0]?.harness, "pi");
    assert.ok(pi.adapters[0]?.created.includes(".agents/skills/ff-work/SKILL.md"));
    assert.ok(pi.adapters[0]?.created.includes(".pi/agents/ff-advisor.md"));
    assert.ok(pi.adapters[0]?.created.includes(".pi/extensions/ff-clarify-watchdog.ts"));
    await assert.rejects(access(path.join(piRoot, ".ff/agent-commands")));
    await assert.rejects(access(path.join(piRoot, ".pi/skills")));
    const piSkill = await readFile(path.join(piRoot, ".agents/skills/ff-work/SKILL.md"), "utf8");
    assert.match(piSkill, /^---\nname: ff-work/m);
    assert.match(piSkill, /Use this skill for the `ff-work` Flowflow workflow action/);
    assert.doesNotMatch(piSkill, /asks Pi to run/);
    assert.match(piSkill, /ff preflight --action work/);
    const piAdvisor = await readFile(path.join(piRoot, ".pi/agents/ff-advisor.md"), "utf8");
    assert.match(piAdvisor, /Pi subagents discover project agents from \.pi\/agents/);
    assert.match(await readFile(path.join(piRoot, ".pi/extensions/ff-clarify-watchdog.ts"), "utf8"), /ff internal validate-clarify --watchdog/);

    assert.equal(cursor.adapters[0]?.harness, "cursor");
    assert.ok(cursor.adapters[0]?.created.includes(".agents/skills/ff-work/SKILL.md"));
    assert.ok(cursor.adapters[0]?.created.includes(".cursor/agents/ff-advisor.md"));
    assert.ok(cursor.adapters[0]?.created.includes(".cursor/hooks.json"));
    await assert.rejects(access(path.join(cursorRoot, ".ff/agent-commands")));
    const cursorSkill = await readFile(path.join(cursorRoot, ".agents/skills/ff-work/SKILL.md"), "utf8");
    assert.match(cursorSkill, /^---\nname: ff-work/m);
    assert.match(cursorSkill, /Use this skill for the `ff-work` Flowflow workflow action/);
    assert.doesNotMatch(cursorSkill, /asks Cursor to run/);
    assert.match(cursorSkill, /ff preflight --action work/);
    const cursorAdvisor = await readFile(path.join(cursorRoot, ".cursor/agents/ff-advisor.md"), "utf8");
    assert.match(cursorAdvisor, /^---\nname: ff-advisor/m);
    assert.match(cursorAdvisor, /readonly: true/);
    const cursorHooks = await readFile(path.join(cursorRoot, ".cursor/hooks.json"), "utf8");
    assert.match(cursorHooks, /ff internal validate-clarify --watchdog/);
    const nonLocalMarker = ["cl", "oud"].join("");
    assert.doesNotMatch(`${cursorSkill}\n${cursorAdvisor}\n${cursorHooks}`, new RegExp(nonLocalMarker, "i"));
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

  it("accepts explicit Claude, OpenCode, Pi, and Cursor harness flags", async () => {
    const cases = [
      { harness: "claude", generatedPath: ".claude/skills/ff-work/SKILL.md" },
      { harness: "opencode", generatedPath: ".agents/skills/ff-work/SKILL.md" },
      { harness: "pi", generatedPath: ".agents/skills/ff-work/SKILL.md" },
      { harness: "cursor", generatedPath: ".agents/skills/ff-work/SKILL.md" }
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
          "skipped",
          ...(testCase.harness === "pi" ? ["--pi-subagents", "skipped"] : [])
        ],
        { env: { CW_FORCE_INTERACTIVE: "1" } }
      );

      assert.equal(cli.code, 0, cli.stderr);
      assert.doesNotMatch(cli.stdout, /Select coding harness|Code index tool|Context memory tool/);
      const result = parseCliJson(cli.stdout);
      assert.equal(((result.adapters as Array<{ harness: string }>)[0]?.harness), testCase.harness);
      await access(path.join(root, testCase.generatedPath));
      const enhancements = JSON.parse(await readFile(path.join(root, ".ff/enhancements.json"), "utf8")) as Record<string, unknown>;
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

    assert.match(await readFile(path.join(root, ".ff/tasks/0001-auth-rate-limit/spec.md"), "utf8"), /# Spec/);
    const trace = await readTrace(root, "0001-auth-rate-limit");
    assert.equal(trace.length, 1);
    assert.equal(trace[0]?.type, "task.created");
    assert.deepEqual(await validateProject(root), []);
  });

  it("generates numeric task ids without reusing active or archived prefixes", async () => {
    const root = await tempRoot();
    await initProject(root);
    await mkdir(path.join(root, ".ff/tasks/archived/0007-old-task"), { recursive: true });

    const generated = await createTaskViaCli(root, {
      title: "Ship docs",
      now: new Date("2026-07-03T01:00:00.000Z")
    });

    assert.equal(generated.id, "0008-ship-docs");
    assert.match(await readFile(path.join(root, ".ff/tasks/0008-ship-docs/spec.md"), "utf8"), /# Spec/);
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
    await mkdir(path.join(root, ".ff/tasks/0002-two-duplicate"), { recursive: true });
    await assert.rejects(selectTaskViaCli(root, { taskId: "0002" }), /ambiguous/);
  });

  it("runs preflight for a selected task", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-preflight-test", title: "Preflight test" });

    const report = await runPreflightViaCli(root, { action: "run", taskId: "0001-preflight-test" });

    assert.equal(report.ok, true);
    assert.equal(report.task?.id, "0001-preflight-test");

    await ensureBaselineDeltaViaCli(root, "0001-preflight-test");
    const finishReport = await runPreflightViaCli(root, { action: "finish", taskId: "0001-preflight-test" });
    assert.ok(
      finishReport.warnings.some((warning) =>
        warning.path.endsWith("/baseline-delta.md") &&
        /merge it by default/.test(warning.message)
      )
    );
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
    assert.match(String(result.details?.recommendedAction), /apply ff-check behavior next/);
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
      path.join(root, ".ff/tasks/0001-missing-acceptance/spec.md"),
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

  it("requires advisor review and explicit accept before clarify writes spec", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-clarify-gate", title: "Clarify gate" });

    const proposed = await runWorkflowAction(root, "clarify", {
      taskId: "0001-clarify-gate",
      goal: "Create a durable clarify gate.",
      acceptance: ["spec.md is written only after advisor review"]
    });
    assert.equal(proposed.task?.lifecycle, "blocked");
    assert.equal(proposed.task?.phase, "clarify");
    assert.match(proposed.message, /Proposed spec/);
    assert.doesNotMatch(await readFile(path.join(root, ".ff/tasks/0001-clarify-gate/spec.md"), "utf8"), /durable clarify gate/);

    const blockedAccept = await runWorkflowAction(root, "clarify", {
      taskId: "0001-clarify-gate",
      goal: "Create a durable clarify gate.",
      acceptance: ["spec.md is written only after advisor review"],
      confirm: true
    });
    assert.equal(blockedAccept.task?.lifecycle, "blocked");
    assert.match(blockedAccept.task?.blocked_reason ?? "", /advisor/);

    const identity = proposed.details?.identity as { attemptId: string; proposalId: string; proposalHash: string };
    await appendTraceViaCli(root, "0001-clarify-gate", {
      type: "advisor.reviewed",
      summary: "Advisor approved current Proposed Spec.",
      data: {
        attempt_id: identity.attemptId,
        proposal_id: identity.proposalId,
        proposal_hash: identity.proposalHash,
        verdict: "pass"
      }
    });
    const accepted = await runWorkflowAction(root, "clarify", {
      taskId: "0001-clarify-gate",
      goal: "Create a durable clarify gate.",
      acceptance: ["spec.md is written only after advisor review"],
      confirm: true
    });
    assert.equal(accepted.task?.phase, "plan");
    assert.match(await readFile(path.join(root, ".ff/tasks/0001-clarify-gate/spec.md"), "utf8"), /durable clarify gate/);
    const trace = await readTrace(root, "0001-clarify-gate");
    assert.ok(trace.some((event) => event.type === "spec.accepted" && (event.data as Record<string, unknown>).explicit === true));
  });

  it("validates clarify gate event identity and advisor outcomes", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-clarify-validator", title: "Clarify validator" });
    const data = { attempt_id: "a1", proposal_id: "p1", proposal_hash: "hash1" };

    await appendTraceViaCli(root, "0001-clarify-validator", {
      type: "brainstorm.done",
      summary: "Brainstorm done.",
      data
    });
    await appendTraceViaCli(root, "0001-clarify-validator", {
      type: "spec.proposed",
      summary: "Spec proposed.",
      data
    });

    const missingAdvisor = await runValidateClarifyViaCli(root, "0001-clarify-validator", "accept");
    assert.equal(missingAdvisor.code, 1);
    assert.match(missingAdvisor.stdout, /advisor/);

    await appendTraceViaCli(root, "0001-clarify-validator", {
      type: "advisor.reviewed",
      summary: "Advisor raised concern.",
      data: { ...data, verdict: "concern" }
    });
    const unresolvedConcern = await runValidateClarifyViaCli(root, "0001-clarify-validator", "accept");
    assert.equal(unresolvedConcern.code, 1);
    assert.match(unresolvedConcern.stdout, /concern/);

    await appendTraceViaCli(root, "0001-clarify-validator", {
      type: "advisor.reviewed",
      summary: "Advisor concern deferred.",
      data: { ...data, verdict: "concern", deferred_reason: "Accepted as implementation risk." }
    });
    assert.equal((await runValidateClarifyViaCli(root, "0001-clarify-validator", "accept")).code, 0);

    const mismatched = await runValidateClarifyViaCli(root, "0001-clarify-validator", "accept", ["--proposal-id", "other"]);
    assert.equal(mismatched.code, 1);
    assert.match(mismatched.stdout, /spec.proposed/);

    await appendTraceViaCli(root, "0001-clarify-validator", {
      type: "advisor.reviewed",
      summary: "Advisor raised blocker.",
      data: { ...data, verdict: "blocker" }
    });
    const unresolvedBlocker = await runValidateClarifyViaCli(root, "0001-clarify-validator", "accept");
    assert.equal(unresolvedBlocker.code, 1);
    assert.match(unresolvedBlocker.stdout, /blocker/);

    await appendTraceViaCli(root, "0001-clarify-validator", {
      type: "advisor.reviewed",
      summary: "Advisor blocker overridden by user.",
      data: { ...data, verdict: "blocker", user_override: true }
    });
    await appendTraceViaCli(root, "0001-clarify-validator", {
      type: "spec.accepted",
      summary: "Spec accepted.",
      data: { ...data, explicit: true }
    });
    assert.equal((await runValidateClarifyViaCli(root, "0001-clarify-validator", "advance")).code, 0);

    await createTaskViaCli(root, { id: "0002-clarify-unavailable", title: "Clarify unavailable" });
    const fallbackData = { attempt_id: "a2", proposal_id: "p2", proposal_hash: "hash2" };
    await appendTraceViaCli(root, "0002-clarify-unavailable", {
      type: "brainstorm.done",
      summary: "Brainstorm done.",
      data: fallbackData
    });
    await appendTraceViaCli(root, "0002-clarify-unavailable", {
      type: "spec.proposed",
      summary: "Spec proposed.",
      data: fallbackData
    });
    await appendTraceViaCli(root, "0002-clarify-unavailable", {
      type: "advisor.unavailable",
      summary: "Advisor unavailable without enough evidence.",
      data: { ...fallbackData, attempted: true, harness: "codex" }
    });
    const incompleteFallback = await runValidateClarifyViaCli(root, "0002-clarify-unavailable", "accept");
    assert.equal(incompleteFallback.code, 1);
    assert.match(incompleteFallback.stdout, /failure_reason/);
    await appendTraceViaCli(root, "0002-clarify-unavailable", {
      type: "advisor.unavailable",
      summary: "Advisor unavailable; inline fallback completed.",
      data: {
        ...fallbackData,
        attempted: true,
        harness: "codex",
        failure_reason: "subagent unavailable",
        fallback_checklist_result: "pass"
      }
    });
    assert.equal((await runValidateClarifyViaCli(root, "0002-clarify-unavailable", "accept")).code, 0);

    await createTaskViaCli(root, { id: "0003-clarify-order", title: "Clarify order" });
    const orderData = { attempt_id: "a3", proposal_id: "p3", proposal_hash: "hash3" };
    await appendTraceViaCli(root, "0003-clarify-order", {
      type: "spec.proposed",
      summary: "Spec proposed before brainstorm.",
      data: orderData
    });
    await appendTraceViaCli(root, "0003-clarify-order", {
      type: "brainstorm.done",
      summary: "Brainstorm done too late.",
      data: orderData
    });
    const outOfOrder = await runValidateClarifyViaCli(root, "0003-clarify-order", "proposal");
    assert.equal(outOfOrder.code, 1);
    assert.match(outOfOrder.stdout, /before spec.proposed/);
  });

  it("names missing identity fields when spec.proposed lacks the identity triple", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-malformed-identity", title: "Malformed identity" });
    await appendTraceViaCli(root, "0001-malformed-identity", {
      type: "brainstorm.done",
      summary: "Brainstorm done.",
      data: { identity: "stale" }
    });
    await appendTraceViaCli(root, "0001-malformed-identity", {
      type: "spec.proposed",
      summary: "Spec proposed with wrong identity key.",
      data: { identity: "stale" }
    });
    const result = await runValidateClarifyViaCli(root, "0001-malformed-identity", "advance");
    assert.equal(result.code, 1);
    assert.match(result.stdout, /attempt_id/);
    assert.match(result.stdout, /proposal_id/);
    assert.match(result.stdout, /proposal_hash/);
  });

  it("propose-spec and accept-spec produce a passing clarify gate from a spec file", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-propose-accept", title: "Propose accept" });
    const specPath = path.join(root, "spec-draft.md");
    const specContent = "# Spec\n\n## Goal\n\nMake toast.\n\n## Acceptance Criteria\n\n- [ ] Toast is made.\n";
    await writeFile(specPath, specContent, "utf8");

    const proposed = await cliJson<{ ok: boolean; identity: { attemptId: string; proposalId: string; proposalHash: string } }>([
      "internal", "propose-spec", "--root", root, "--task", "0001-propose-accept", "--spec-file", specPath
    ]);
    assert.equal(proposed.ok, true);
    assert.ok(proposed.identity.proposalHash.length > 0);
    assert.equal(proposed.identity.proposalHash, createHash("sha256").update(specContent).digest("hex"));

    const specMdPath = path.join(root, ".ff/tasks/0001-propose-accept/spec.md");
    const specMdContent = await readFile(specMdPath, "utf8");
    assert.doesNotMatch(specMdContent, /Make toast/);

    const proposalStage = await runValidateClarifyViaCli(root, "0001-propose-accept", "proposal");
    assert.equal(proposalStage.code, 0);

    const accepted = await cliJson<{ ok: boolean; identity: { attemptId: string } }>([
      "internal", "accept-spec", "--root", root, "--task", "0001-propose-accept", "--verdict", "pass"
    ]);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.identity.attemptId, proposed.identity.attemptId);

    const advance = await runValidateClarifyViaCli(root, "0001-propose-accept", "advance");
    assert.equal(advance.code, 0);
  });

  it("accept-spec fails cleanly with no prior proposal or contradictory flags", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-accept-errors", title: "Accept errors" });

    const noProposal = await runCli(["internal", "accept-spec", "--root", root, "--task", "0001-accept-errors", "--verdict", "pass"]);
    assert.notEqual(noProposal.code, 0);

    await appendTraceViaCli(root, "0001-accept-errors", {
      type: "spec.proposed",
      summary: "Proposal with identity.",
      data: { attempt_id: "a1", proposal_id: "p1", proposal_hash: "h1" }
    });
    const contradictory = await runCli([
      "internal", "accept-spec", "--root", root, "--task", "0001-accept-errors", "--verdict", "pass", "--advisor-unavailable"
    ]);
    assert.notEqual(contradictory.code, 0);
    assert.match((contradictory.stderr || contradictory.stdout), /mutually exclusive/);

    const unavailable = await cliJson<{ ok: boolean }>([
      "internal", "accept-spec", "--root", root, "--task", "0001-accept-errors",
      "--advisor-unavailable", "--harness", "opencode", "--failure-reason", "advisor model not found",
      "--fallback-checklist-result", "inline review pass"
    ]);
    assert.equal(unavailable.ok, true);
    const trace = await readTrace(root, "0001-accept-errors");
    assert.ok(trace.some((event) => event.type === "advisor.unavailable"));
    assert.ok(trace.some((event) => event.type === "spec.accepted" && (event.data as Record<string, unknown>).explicit === true));

    const concernWithoutResolution = await runCli([
      "internal", "accept-spec", "--root", root, "--task", "0001-accept-errors", "--verdict", "concern"
    ]);
    assert.notEqual(concernWithoutResolution.code, 0);
    assert.match((concernWithoutResolution.stderr || concernWithoutResolution.stdout), /concern requires/);

    await createTaskViaCli(root, { id: "0002-malformed-latest", title: "Malformed latest" });
    await appendTraceViaCli(root, "0002-malformed-latest", {
      type: "spec.proposed",
      summary: "Earlier valid proposal.",
      data: { attempt_id: "a-early", proposal_id: "p-early", proposal_hash: "h-early" }
    });
    await appendTraceViaCli(root, "0002-malformed-latest", {
      type: "spec.proposed",
      summary: "Latest malformed proposal.",
      data: { identity: "stale" }
    });
    const misbind = await runCli(["internal", "accept-spec", "--root", root, "--task", "0002-malformed-latest", "--verdict", "pass"]);
    assert.notEqual(misbind.code, 0);
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
    assert.match(await readFile(path.join(root, ".ff/tasks/0001-resume-flow/resume.md"), "utf8"), /Continue from run/);

    const run = await runWorkflowAction(root, "run", { taskId: "0001-resume-flow" });

    assert.equal(run.task?.artifacts.resume, null);
    await assert.rejects(access(path.join(root, ".ff/tasks/0001-resume-flow/resume.md")));
    assert.match(await readFile(path.join(root, ".ff/tasks/0001-resume-flow/trace.jsonl"), "utf8"), /resume.consumed/);
  });

  it("creates and syncs a baseline delta", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-baseline-test", title: "Baseline test" });

    const withDelta = await ensureBaselineDeltaViaCli(root, "0001-baseline-test");
    assert.equal(withDelta.artifacts.baseline_delta, "baseline-delta.md");
    await writeFile(
      path.join(root, ".ff/tasks/0001-baseline-test/baseline-delta.md"),
      "# Baseline Delta\n\n## commands.md\n\n# Commands\n\n## Test\n\nRun `npm test` before finish.\n",
      "utf8"
    );

    const result = await syncBaselineDeltaViaCli(root, "0001-baseline-test", "accepted");
    assert.deepEqual(result.updated, [".ff/project/commands.md"]);
    const commands = await readFile(path.join(root, ".ff/project/commands.md"), "utf8");
    assert.match(commands, /^# Commands/);
    assert.match(commands, /## Test/);
    assert.match(commands, /Run `npm test` before finish\./);
    assert.match(commands, /Run `npm test` before finish\.\n\n## Lint/);
  });

  it("syncs selected, edited, and skipped baseline delta decisions", async () => {
    const root = await tempRoot();
    await initProject(root);
    const originalRules = await readFile(path.join(root, ".ff/project/rules.md"), "utf8");

    await createTaskViaCli(root, { id: "0001-selected-baseline", title: "Selected baseline" });
    await ensureBaselineDeltaViaCli(root, "0001-selected-baseline");
    await writeFile(
      path.join(root, ".ff/tasks/0001-selected-baseline/baseline-delta.md"),
      "# Baseline Delta\n\n## commands.md\n\nUse `npm test`.\n\n## rules.md\n\nReview checklist before finish.\n",
      "utf8"
    );
    const selected = await syncBaselineDeltaViaCli(root, "0001-selected-baseline", "selected", {
      selectedFiles: ["commands.md"]
    });
    assert.deepEqual(selected.updated, [".ff/project/commands.md"]);
    assert.match(await readFile(path.join(root, ".ff/project/commands.md"), "utf8"), /Use `npm test`\./);
    assert.equal(await readFile(path.join(root, ".ff/project/rules.md"), "utf8"), originalRules);

    await createTaskViaCli(root, { id: "0002-edited-baseline", title: "Edited baseline" });
    await ensureBaselineDeltaViaCli(root, "0002-edited-baseline");
    await assert.rejects(
      syncBaselineDeltaViaCli(root, "0002-edited-baseline", "edited"),
      /edited baseline sync requires confirmed current-state content/
    );
    const edited = await syncBaselineDeltaViaCli(root, "0002-edited-baseline", "edited", {
      editedMarkdown: "# Baseline Delta\n\n## rules.md\n\n# Rules\n\n## Review\n\nEdited baseline rule.\n"
    });
    assert.deepEqual(edited.updated, [".ff/project/rules.md"]);
    assert.equal(
      await readFile(path.join(root, ".ff/project/rules.md"), "utf8"),
      "# Rules\n\n## Review\n\nEdited baseline rule.\n"
    );

    await createTaskViaCli(root, { id: "0003-skipped-baseline", title: "Skipped baseline" });
    await ensureBaselineDeltaViaCli(root, "0003-skipped-baseline");
    const skipped = await syncBaselineDeltaViaCli(root, "0003-skipped-baseline", "skipped");
    assert.deepEqual(skipped.updated, []);
  });

  it("requires a recorded baseline outcome before finish when no baseline delta exists", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTaskViaCli(root, { id: "0001-baseline-outcome", title: "Baseline outcome" });
    await writeFile(
      path.join(root, ".ff/tasks/0001-baseline-outcome/spec.md"),
      "# Spec\n\n## Acceptance Criteria\n- [x] Works\n",
      "utf8"
    );
    await writeFile(
      path.join(root, ".ff/tasks/0001-baseline-outcome/task.md"),
      "# Task\n\n## Implementation\n- [x] Implemented\n\n## Verification\n- [x] Tested\n\n## Check\n- [x] Acceptance criteria in spec.md are covered.\n- [x] No unresolved drift between implementation and spec.\n- [x] Dirty worktree handling is clear.\n",
      "utf8"
    );
    await setTaskStateViaCli(root, "0001-baseline-outcome", {
      phase: "finish",
      nextAction: "Run ff-finish after user confirmation"
    });

    await assert.rejects(
      finishTaskViaCli(root, "0001-baseline-outcome", { summary: "Done" }),
      /Baseline Outcome/
    );

    await writeFile(
      path.join(root, ".ff/tasks/0001-baseline-outcome/task.md"),
      "# Task\n\n## Implementation\n- [x] Implemented\n\n## Verification\n- [x] Tested\n\n## Check\n- [x] Acceptance criteria in spec.md are covered.\n- [x] No unresolved drift between implementation and spec.\n- [x] Dirty worktree handling is clear.\n- [x] Baseline Outcome is recorded.\n\n## Notes\nBaseline Outcome: no reusable project facts.\n",
      "utf8"
    );

    const finished = await finishTaskViaCli(root, "0001-baseline-outcome", { summary: "Done" });
    assert.equal(finished.lifecycle, "closed");
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
      path.join(root, ".ff/tasks/0001-finish-test/spec.md"),
      "# Spec\n\n## Acceptance Criteria\n- [x] Works\n",
      "utf8"
    );
    await writeFile(
      path.join(root, ".ff/tasks/0001-finish-test/task.md"),
      "# Task\n\n## Implementation\n- [x] Implemented\n\n## Verification\n- [x] Tested\n\n## Check\n- [x] Acceptance criteria in spec.md are covered.\n- [x] Baseline Outcome is recorded.\n",
      "utf8"
    );
    await setTaskStateViaCli(root, "0001-finish-test", {
      phase: "finish",
      nextAction: "Run ff-finish after user confirmation"
    });
    await createResumeNoteViaCli(root, "0001-finish-test", "# Resume\n\nClose from finish.\n");

    const finished = await finishTaskViaCli(root, "0001-finish-test", { summary: "Task finished" });
    assert.equal(finished.lifecycle, "closed");
    assert.equal(finished.phase, "finish");
    assert.equal(finished.next_action, "Task is closed");
    assert.equal(finished.artifacts.resume, null);
    await assert.rejects(access(path.join(root, ".ff/tasks/0001-finish-test")));
    assert.match(await readFile(path.join(root, ".ff/tasks/archived/0001-finish-test/task.json"), "utf8"), /"lifecycle": "closed"/);
    const archivedTrace = await readFile(path.join(root, ".ff/tasks/archived/0001-finish-test/trace.jsonl"), "utf8");
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
    await acceptClarifyViaWorkflow(root, {
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

  it("merges baseline delta by default when finish has a delta without a decision", async () => {
    const root = await tempRoot();
    await initProject(root);
    await runWorkflowAction(root, "work", { taskId: "0001-finish-prompt", title: "Finish prompt" });
    await acceptClarifyViaWorkflow(root, {
      taskId: "0001-finish-prompt",
      goal: "Record a reusable command.",
      acceptance: ["Reusable command is ready for baseline review"]
    });
    await runWorkflowAction(root, "plan", { taskId: "0001-finish-prompt" });
    await runWorkflowAction(root, "run", { taskId: "0001-finish-prompt", summary: "Command note prepared." });
    await ensureBaselineDeltaViaCli(root, "0001-finish-prompt");
    await writeFile(
      path.join(root, ".ff/tasks/0001-finish-prompt/baseline-delta.md"),
      "# Baseline Delta\n\n## architecture.md\n\n## commands.md\n\nUse `npm test` before finish.\n",
      "utf8"
    );
    const check = await runWorkflowAction(root, "check", {
      taskId: "0001-finish-prompt",
      summary: "Manual review passed."
    });
    assert.match(check.task?.next_action ?? "", /merge baseline-delta\.md by default/);

    const finished = await runWorkflowAction(root, "finish", {
      taskId: "0001-finish-prompt",
      summary: "Done"
    });

    assert.equal(finished.task?.lifecycle, "closed");
    const baselineSync = finished.details?.baseline_sync as { decision: string } | undefined;
    assert.equal(baselineSync?.decision, "accepted");
    assert.match(await readFile(path.join(root, ".ff/project/commands.md"), "utf8"), /Use `npm test` before finish\./);
  });

  it("requires explicit confirmation before syncing high-impact baseline deltas during finish", async () => {
    const root = await tempRoot();
    await initProject(root);
    await runWorkflowAction(root, "work", { taskId: "0001-high-impact-baseline", title: "High impact baseline" });
    await acceptClarifyViaWorkflow(root, {
      taskId: "0001-high-impact-baseline",
      goal: "Document an architecture fact.",
      acceptance: ["Architecture fact is documented"]
    });
    await runWorkflowAction(root, "plan", { taskId: "0001-high-impact-baseline" });
    await runWorkflowAction(root, "run", { taskId: "0001-high-impact-baseline", summary: "Architecture note prepared." });
    await ensureBaselineDeltaViaCli(root, "0001-high-impact-baseline");
    await writeFile(
      path.join(root, ".ff/tasks/0001-high-impact-baseline/baseline-delta.md"),
      "# Baseline Delta\n\n## architecture.md\n\nArchitecture now documents the workflow kernel boundary.\n",
      "utf8"
    );
    await runWorkflowAction(root, "check", {
      taskId: "0001-high-impact-baseline",
      summary: "Manual review passed.",
      manualVerification: "Reviewed architecture wording."
    });

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
    assert.match(await readFile(path.join(root, ".ff/project/architecture.md"), "utf8"), /workflow kernel boundary/);
  });

  it("keeps check open until Baseline Outcome is recorded", async () => {
    const root = await tempRoot();
    await initProject(root);
    await runWorkflowAction(root, "work", { taskId: "0001-check-baseline-outcome", title: "Check baseline outcome" });
    await acceptClarifyViaWorkflow(root, {
      taskId: "0001-check-baseline-outcome",
      goal: "Verify baseline outcome handling.",
      acceptance: ["Check does not pass without Baseline Outcome"]
    });
    await runWorkflowAction(root, "plan", { taskId: "0001-check-baseline-outcome" });
    await runWorkflowAction(root, "run", {
      taskId: "0001-check-baseline-outcome",
      summary: "Implementation finished."
    });

    const missing = await runWorkflowAction(root, "check", {
      taskId: "0001-check-baseline-outcome",
      summary: "Verification passed."
    });

    assert.equal(missing.task?.phase, "check");
    assert.match(missing.message, /Baseline Outcome/);

    const recorded = await runWorkflowAction(root, "check", {
      taskId: "0001-check-baseline-outcome",
      summary: "Verification passed.",
      baselineOutcome: "No reusable project facts."
    });
    assert.equal(recorded.task?.phase, "finish");
    assert.match(
      await readFile(path.join(root, ".ff/tasks/0001-check-baseline-outcome/task.md"), "utf8"),
      /Baseline Outcome: No reusable project facts\./
    );
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
    await assert.rejects(access(path.join(root, ".ff/tasks/0001-discard-test")));
  });

  it("doctor reports malformed task state and stale generated skills", async () => {
    const root = await tempRoot();
    await initProject(root, { harnesses: ["codex"] });
    await createTaskViaCli(root, { id: "0001-unhealthy-task", title: "Unhealthy task" });
    const taskJsonPath = path.join(root, ".ff/tasks/0001-unhealthy-task/task.json");
    const state = JSON.parse(await readFile(taskJsonPath, "utf8")) as Record<string, unknown>;
    state.next_action = "";
    state.result = "done";
    await writeFile(taskJsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await writeFile(path.join(root, ".agents/skills/ff-work/SKILL.md"), "stale", "utf8");

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
    await assert.rejects(access(path.join(root, ".ff/tasks/task-old-closed")));
    await assert.rejects(access(path.join(root, ".ff/tasks/task-old-open")));
    assert.equal(
      (JSON.parse(await readFile(path.join(root, ".ff/tasks/archived/0001-old-closed/task.json"), "utf8")) as { id: string }).id,
      "0001-old-closed"
    );
    assert.equal(
      (JSON.parse(await readFile(path.join(root, ".ff/tasks/0002-old-open/task.json"), "utf8")) as { id: string }).id,
      "0002-old-open"
    );
    assert.match(await readFile(path.join(root, ".ff/tasks/archived/0001-old-closed/trace.jsonl"), "utf8"), /task.migrated/);
    assert.deepEqual((await listTasksViaCli(root)).map((task) => task.id), ["0002-old-open"]);
    assert.deepEqual((await listTasksViaCli(root, { scope: "archived" })).map((task) => task.id), ["0001-old-closed"]);
    assert.deepEqual(await validateProject(root), []);
  });

  it("understand writes drafts without directly overwriting project baseline files", async () => {
    const root = await tempRoot();
    await initProject(root);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
    await writeFile(path.join(root, ".ff/project/commands.md"), "# Commands\n\nKeep this baseline.\n", "utf8");

    const result = await runWorkflowAction(root, "understand", { merge: true });

    assert.equal(result.details?.merged, false);
    assert.match(await readFile(path.join(root, ".ff/understand-draft/commands.md"), "utf8"), /npm test/);
    assert.equal(await readFile(path.join(root, ".ff/project/commands.md"), "utf8"), "# Commands\n\nKeep this baseline.\n");
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

    const clarify = await acceptClarifyViaWorkflow(root, {
      taskId: "0001-create-readme",
      goal: "Create a README file for the fixture project.",
      scope: "Add concise project documentation.",
      acceptance: ["README.md exists", "README explains how to test"]
    });
    assert.equal(clarify.task?.phase, "plan");

    const plan = await runWorkflowAction(root, "plan", { taskId: "0001-create-readme" });
    assert.equal(plan.task?.phase, "run");
    assert.match(
      await readFile(path.join(root, ".ff/tasks/0001-create-readme/task.md"), "utf8"),
      /small, verifiable vertical slices/
    );
    assert.match(
      await readFile(path.join(root, ".ff/tasks/0001-create-readme/task.md"), "utf8"),
      /Baseline Outcome is recorded/
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
      commands: ["test -f README.md"],
      baselineOutcome: "baseline-delta.md will promote the fixture test command."
    });
    assert.equal(check.task?.phase, "finish");
    assert.deepEqual((check.details?.commands as Array<{ command: string }>).map((result) => result.command), ["test -f README.md"]);

    await ensureBaselineDeltaViaCli(root, "0001-create-readme");
    await writeFile(
      path.join(root, ".ff/tasks/0001-create-readme/baseline-delta.md"),
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
    assert.match(await readFile(path.join(root, ".ff/project/commands.md"), "utf8"), /verify fixture behavior/);

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
    await assert.rejects(access(path.join(root, ".ff/tasks/0003-discard-flow")));

    const understand = await runWorkflowAction(root, "understand");
    assert.equal(understand.details?.draft_dir, ".ff/understand-draft");
    assert.match(await readFile(path.join(root, ".ff/understand-draft/commands.md"), "utf8"), /npm test/);

    const doctor = await runWorkflowAction(root, "doctor");
    assert.equal(doctor.action, "doctor");
  });
});

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "ff-kernel-"));
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
  return JSON.parse(await readFile(path.join(root, ".ff/tasks", taskId, "task.json"), "utf8")) as TaskStateRecord;
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

async function appendTraceViaCli(
  root: string,
  taskId: string,
  input: { type: string; summary: string; data?: Record<string, unknown> }
): Promise<void> {
  const args = ["internal", "append-trace", "--root", root, "--task", taskId, "--type", input.type, "--summary", input.summary];
  if (input.data !== undefined) {
    args.push("--data-json", JSON.stringify(input.data));
  }
  await cliJson<{ ok: true }>(args);
}

async function runValidateClarifyViaCli(
  root: string,
  taskId: string,
  stage: "proposal" | "accept" | "advance" | "watchdog",
  extraArgs: string[] = []
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return runCli([
    "internal",
    "validate-clarify",
    "--root",
    root,
    "--task",
    taskId,
    "--stage",
    stage,
    ...extraArgs
  ]);
}

async function acceptClarifyViaWorkflow(
  root: string,
  input: WorkflowOptions & { taskId: string; goal: string }
): Promise<WorkflowResult> {
  const proposed = await runWorkflowAction(root, "clarify", input);
  const identity = proposed.details?.identity as
    | { attemptId: string; proposalId: string; proposalHash: string }
    | undefined;
  assert.equal(proposed.task?.phase, "clarify");
  assert.ok(identity, "clarify proposal identity is returned");
  await appendTraceViaCli(root, input.taskId, {
    type: "advisor.reviewed",
    summary: "Advisor approved current Proposed Spec.",
    data: {
      attempt_id: identity.attemptId,
      proposal_id: identity.proposalId,
      proposal_hash: identity.proposalHash,
      verdict: "pass"
    }
  });
  return runWorkflowAction(root, "clarify", { ...input, confirm: true });
}

function assertInOrder(text: string, fragments: string[]): void {
  let cursor = -1;
  for (const fragment of fragments) {
    const next = text.indexOf(fragment, cursor + 1);
    assert.notEqual(next, -1, `Expected to find "${fragment}" after offset ${cursor}`);
    cursor = next;
  }
}

async function migrateTasksViaCli(root: string, _now?: Date): Promise<LegacyTaskMigrationResult> {
  return cliJson<LegacyTaskMigrationResult>(["internal", "migrate-task-ids", "--root", root]);
}

async function readTrace(root: string, taskId: string): Promise<Array<Record<string, unknown>>> {
  const text = await readFile(path.join(root, ".ff/tasks", taskId, "trace.jsonl"), "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function writeLegacyTask(
  root: string,
  input: { id: string; title: string; lifecycle: "open" | "closed"; createdAt: string }
): Promise<void> {
  const dir = path.join(root, ".ff/tasks", input.id);
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
