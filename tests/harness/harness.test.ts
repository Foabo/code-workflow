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

describe("ff harness", () => {
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
    assert.match(skill, /refresh-context-package/);
    assert.match(skill, /context-package\.md/);
    assert.match(skill, /The context package is not Repo Truth/);
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
    assert.match(advisorAgent, /context packages only as navigation/);
    assert.match(advisorAgent, /current spec\.md and proposal identity/);
    const codexWatchdog = await readFile(path.join(root, ".codex/hooks.json"), "utf8");
    assert.match(codexWatchdog, /ff internal validate-clarify --watchdog/);
    const implementerAgent = await readFile(path.join(root, ".codex/agents/ff-implementer.toml"), "utf8");
    assert.match(implementerAgent, /Modify code and tests within the accepted task contract/);
    assert.match(implementerAgent, /Use a current context package to reduce handoff reading/);
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
    assert.match(clarifySkill, /Match the user's language for user-visible clarify output/);
    assert.match(clarifySkill, /If the user writes in Chinese/);
    assert.match(clarifySkill, /Brainstorm Pass, questions, Proposed Spec content and summaries, and acceptance evidence in Chinese/);
    assert.match(clarifySkill, /Explain required workflow terms in plain language/);
    assert.match(clarifySkill, /include a short plain-language explanation before acceptance whenever they appear/);
    assert.match(clarifySkill, /Keep the reasoning continuous/);
    assert.match(clarifySkill, /goal and motivation to scope, trade-offs, risks, and evidence/);
    assert.match(clarifySkill, /what goal is protected, why it matters, what is in scope, what is out of scope/);
    assert.match(clarifySkill, /what evidence proves success/);
    assert.match(clarifySkill, /Avoid vague workflow slogans, unexplained internal terms, grand claims/);
    assert.match(clarifySkill, /binary contrast formulas/);
    assert.match(clarifySkill, /jargon that does not help the user decide/);
    assert.match(clarifySkill, /validate-clarify/);
    assert.match(clarifySkill, /propose-spec/);
    assert.match(clarifySkill, /accept-spec/);
    assert.match(clarifySkill, /If advisor was unavailable, omit `--verdict`/);
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
    assert.match(planSkill, /When a current context-package\.md exists/);
    assert.match(planSkill, /spec quality gate must still read accepted spec\.md directly/);
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
    assert.match(planSkill, /Match the user's language in user-visible planning text/);
    assert.match(planSkill, /If the accepted spec or user request is Chinese/);
    assert.match(planSkill, /plan summaries, task items, risks, and evidence notes in Chinese/);
    assert.match(planSkill, /Write plan\.md and task\.md as executable actions, concrete trade-offs, and verification evidence/);
    assert.match(planSkill, /what will change, why it stays inside the accepted spec, and how check can prove it/);
    assert.match(planSkill, /For each accepted acceptance criterion/);
    assert.match(planSkill, /concrete action, target artifact or behavior, expected observable result, and verification evidence/);
    assert.match(planSkill, /exact changed surface and proof/);
    assert.match(planSkill, /Key Decisions must record the chosen approach and the reason it stays within scope/);
    assert.match(planSkill, /Risks must name the failure mode and the check that would reveal it/);
    assert.match(planSkill, /Avoid abstract labels, jargon stacks, grand claims/);
    assert.match(planSkill, /acceptance criteria without evidence/);
    assert.match(planSkill, /behavior probes in addition to string assertions/);
    assert.match(planSkill, /at least one `ff-clarify` sample request and one `ff-plan` accepted-spec scenario/);
    assert.match(planSkill, /expected failure mode, desired behavior, reviewer verdict, and remaining risk/);
    assert.match(planSkill, /deterministic tests separate from behavior review/);
    assert.match(planSkill, /stable design, workflow, command, or rule candidates/);
    const runSkill = await readFile(path.join(root, ".agents/skills/ff-run/SKILL.md"), "utf8");
    assert.match(runSkill, /accepted task contract/);
    assert.match(runSkill, /Refresh context-package\.md before delegating implementation slices/);
    assert.match(runSkill, /stale, incomplete, or uncertain packages require reading original task artifacts and git information/);
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
    assert.match(checkSkill, /Refresh context-package\.md before review\/check/);
    assert.match(checkSkill, /Do not issue a spec verdict from a diff summary alone/);
    assert.match(checkSkill, /accepted spec, acceptance criteria, and verification evidence/);
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
    assert.match(update.restart_notice ?? "", /Restart or reload your Codex agent/);
    assert.match(await readFile(path.join(root, ".agents/skills/ff-work/SKILL.md"), "utf8"), /ff preflight --action work/);
    assert.match(await readFile(path.join(root, ".codex/agents/ff-advisor.toml"), "utf8"), /Watch bounded primary-session deltas/);
  });


  it("protects user-edited Codex role agent model config unless update is forced", async () => {
    const root = await tempRoot();
    await initProject(root, { harnesses: ["codex"] });
    const advisorPath = path.join(root, ".codex/agents/ff-advisor.toml");
    const original = await readFile(advisorPath, "utf8");
    await writeFile(
      advisorPath,
      original.replace(
        `model_reasoning_effort = "high"\n`,
        `model = "local-user-model"\nmodel_reasoning_effort = "xhigh"\n`
      ),
      "utf8"
    );

    await assert.rejects(
      () => updateProject(root, ["codex"]),
      /ff update refused to overwrite user-edited role agent configuration\.[\s\S]*\.codex\/agents\/ff-advisor\.toml: model, model_reasoning_effort[\s\S]*\.ff\/orchestration\.json[\s\S]*ff update --force/
    );
    assert.match(await readFile(advisorPath, "utf8"), /local-user-model/);

    const forced = await updateProject(root, ["codex"], { force: true });
    assert.equal(forced.validation.ok, true);
    assert.match(forced.restart_notice ?? "", /Restart or reload your Codex agent/);
    const regenerated = await readFile(advisorPath, "utf8");
    assert.doesNotMatch(regenerated, /local-user-model/);
    assert.match(regenerated, /model_reasoning_effort = "high"/);
  });


  it("protects user-edited markdown role agent frontmatter config", async () => {
    const cases = [
      {
        harness: "claude",
        generatedPath: ".claude/agents/ff-advisor.md",
        edit: (content: string) => content
          .replace("model: inherit", "model: local/claude-model")
          .replace("tools: Read, Grep, Glob", "tools: Read"),
        fields: "model, tools",
        marker: /local\/claude-model/
      },
      {
        harness: "opencode",
        generatedPath: ".opencode/agents/ff-advisor.md",
        edit: (content: string) => content
          .replace("model: inherit", "model: local/opencode-model")
          .replace("  write: false", "  write: true"),
        fields: "model, tools.write",
        marker: /local\/opencode-model/
      },
      {
        harness: "pi",
        generatedPath: ".pi/agents/ff-advisor.md",
        edit: (content: string) => content
          .replace("capability_tier: high-reasoning", "capability_tier: fast")
          .replace("model: inherit", "model: local/pi-model"),
        fields: "capability_tier, model",
        marker: /local\/pi-model/
      },
      {
        harness: "cursor",
        generatedPath: ".cursor/agents/ff-advisor.md",
        edit: (content: string) => content
          .replace("model: inherit", "model: local/cursor-model")
          .replace("readonly: true", "readonly: false")
          .replace("is_background: false", "is_background: true"),
        fields: "is_background, model, readonly",
        marker: /local\/cursor-model/
      }
    ] as const;

    for (const testCase of cases) {
      const root = await tempRoot();
      await initProject(root, { harnesses: [testCase.harness] });
      const advisorPath = path.join(root, testCase.generatedPath);
      const original = await readFile(advisorPath, "utf8");
      await writeFile(advisorPath, testCase.edit(original), "utf8");

      await assert.rejects(
        () => updateProject(root, [testCase.harness]),
        (error) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /ff update refused to overwrite user-edited role agent configuration/);
          assert.ok(error.message.includes(`${testCase.generatedPath}: ${testCase.fields}`), error.message);
          assert.match(error.message, /\.ff\/orchestration\.json/);
          assert.match(error.message, /ff update --force/);
          return true;
        }
      );
      assert.match(await readFile(advisorPath, "utf8"), testCase.marker);
    }
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
    assert.match(update.restart_notice ?? "", /Restart or reload your Codex agent/);
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


  it("prints a restart notice after successful update", async () => {
    const root = await tempRoot();
    await initProject(root, { harnesses: ["codex"] });

    const cli = await runCli(["update", "--root", root, "--harness", "codex"]);

    assert.equal(cli.code, 0, cli.stderr);
    const result = parseJsonOutput<{ restart_notice: string | null; validation: { ok: boolean } }>(cli.stdout);
    assert.equal(result.validation.ok, true);
    assert.match(result.restart_notice ?? "", /Restart or reload your Codex agent/);
  });


  it("does not print restart notice when update refuses protected role agent config", async () => {
    const root = await tempRoot();
    await initProject(root, { harnesses: ["codex"] });
    const advisorPath = path.join(root, ".codex/agents/ff-advisor.toml");
    const original = await readFile(advisorPath, "utf8");
    await writeFile(
      advisorPath,
      original.replace(`model_reasoning_effort = "high"\n`, `model = "local-user-model"\nmodel_reasoning_effort = "xhigh"\n`),
      "utf8"
    );

    const cli = await runCli(["update", "--root", root, "--harness", "codex"]);

    assert.equal(cli.code, 1);
    assert.match(cli.stderr, /ff update refused to overwrite user-edited role agent configuration/);
    assert.match(cli.stderr, /\.codex\/agents\/ff-advisor\.toml: model, model_reasoning_effort/);
    assert.match(cli.stderr, /\.ff\/orchestration\.json/);
    assert.match(cli.stderr, /ff update --force/);
    assert.doesNotMatch(cli.stderr, /Restart or reload/);
    assert.equal(cli.stdout.trim(), "");
  });

});
