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

describe("ff workflow", () => {
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
