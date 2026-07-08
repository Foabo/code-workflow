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

describe("ff baseline", () => {
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

});
