import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeResumeNote,
  createResumeNote,
  createTask,
  discardTask,
  doctorProject,
  ensureBaselineDelta,
  finishTask,
  initProject,
  listTasks,
  preflight,
  readTaskState,
  runWorkflowAction,
  selectTask,
  syncBaselineDelta,
  updateProject,
  updateTaskState,
  validateProject
} from "../src/index.js";

describe("cw kernel", () => {
  it("initializes a project with version, baseline, task templates, and valid structure", async () => {
    const root = await tempRoot();

    const result = await initProject(root, new Date("2026-07-03T00:00:00.000Z"));

    assert.ok(result.created.includes(".cw/version.json"));
    assert.ok(result.created.includes(".cw/project/overview.md"));
    assert.ok(result.created.includes(".cw/enhancements.json"));
    assert.ok(result.created.includes(".cw/templates/spec.md"));
    assert.equal(result.adapters[0]?.harness, "generic");
    assert.ok(result.adapters[0]?.created.includes(".cw/agent-commands/cw-work.md"));
    const command = await readFile(path.join(root, ".cw/agent-commands/cw-work.md"), "utf8");
    assert.match(command, /generated-by-cw:v1/);
    assert.match(command, /repo truth/);
    assert.match(command, /cw preflight --action work/);
    assert.match(command, /Hybrid execution is recommended/);
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

  it("generates a Codex plugin and skills for the Codex harness", async () => {
    const root = await tempRoot();

    const result = await initProject(root, { harnesses: ["codex"] });

    assert.equal(result.adapters[0]?.harness, "codex");
    assert.ok(result.adapters[0]?.created.includes(".agents/plugins/marketplace.json"));
    assert.ok(result.adapters[0]?.created.includes("plugins/cw-workflow/.codex-plugin/plugin.json"));
    assert.ok(result.adapters[0]?.created.includes("plugins/cw-workflow/skills/cw-work/SKILL.md"));
    assert.ok(result.adapters[0]?.created.includes(".codex/skills/cw-work/SKILL.md"));
    assert.ok(result.adapters[0]?.created.includes(".cw/agent-commands/cw-work.md"));
    const marketplace = await readFile(path.join(root, ".agents/plugins/marketplace.json"), "utf8");
    assert.match(marketplace, /"name": "cw-workflow"/);
    const manifest = await readFile(path.join(root, "plugins/cw-workflow/.codex-plugin/plugin.json"), "utf8");
    assert.match(manifest, /"skills": "\.\/skills\/"/);
    const skill = await readFile(path.join(root, "plugins/cw-workflow/skills/cw-work/SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: cw-work/m);
    assert.match(skill, /Treat `\.cw` as Repo Truth/);
    assert.match(skill, /cw preflight --action work/);
    assert.match(skill, /Implementer subagents may write code/);
    assert.match(skill, /Checker subagents must return spec drift/);
    const repoSkill = await readFile(path.join(root, ".codex/skills/cw-work/SKILL.md"), "utf8");
    assert.match(repoSkill, /^---\nname: cw-work/m);
    assert.match(repoSkill, /cw preflight --action work/);

    await writeFile(path.join(root, "plugins/cw-workflow/skills/cw-work/SKILL.md"), "stale", "utf8");
    await writeFile(path.join(root, ".codex/skills/cw-work/SKILL.md"), "stale", "utf8");
    const staleReport = await doctorProject(root);
    assert.equal(staleReport.ok, false);
    assert.ok(staleReport.warnings.some((warning) => warning.path === ".codex/skills/cw-work/SKILL.md"));

    const update = await updateProject(root, ["codex"]);
    assert.equal(update.validation.ok, true);
    assert.match(await readFile(path.join(root, "plugins/cw-workflow/skills/cw-work/SKILL.md"), "utf8"), /cw preflight --action work/);
    assert.match(await readFile(path.join(root, ".codex/skills/cw-work/SKILL.md"), "utf8"), /cw preflight --action work/);
  });

  it("creates a task with core artifacts and append-only trace events", async () => {
    const root = await tempRoot();
    await initProject(root);

    const state = await createTask(root, {
      id: "task-auth-rate-limit",
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
      id: "task-auth-rate-limit",
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

    assert.match(await readFile(path.join(root, ".cw/tasks/task-auth-rate-limit/spec.md"), "utf8"), /# Spec/);
    const trace = await readTrace(root, "task-auth-rate-limit");
    assert.equal(trace.length, 1);
    assert.equal(trace[0]?.type, "task.created");
    assert.deepEqual(await validateProject(root), []);
  });

  it("updates task state and records the change in trace", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-docs", title: "Update docs" });

    const updated = await updateTaskState(root, "task-docs", {
      phase: "run",
      nextAction: "Execute the implementation checklist",
      now: new Date("2026-07-03T02:00:00.000Z")
    });

    assert.equal(updated.phase, "run");
    assert.equal(updated.next_action, "Execute the implementation checklist");
    const trace = await readTrace(root, "task-docs");
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
    await createTask(root, { id: "task-one", title: "One", now: new Date("2026-07-03T01:00:00.000Z") });

    assert.equal((await selectTask(root)).id, "task-one");
    assert.deepEqual((await listTasks(root)).map((task) => task.id), ["task-one"]);

    await createTask(root, { id: "task-two", title: "Two", now: new Date("2026-07-03T02:00:00.000Z") });
    await assert.rejects(selectTask(root), /multiple matching tasks/);
    assert.equal((await selectTask(root, { taskId: "task-two" })).id, "task-two");
  });

  it("runs preflight for a selected task", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-preflight", title: "Preflight test" });

    const report = await preflight(root, { action: "run", taskId: "task-preflight" });

    assert.equal(report.ok, true);
    assert.equal(report.task?.id, "task-preflight");
  });

  it("blocks clarification and planning when required task facts are missing", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-needs-input", title: "Needs input" });

    const clarify = await runWorkflowAction(root, "clarify", { taskId: "task-needs-input" });

    assert.equal(clarify.task?.lifecycle, "blocked");
    assert.equal(clarify.task?.phase, "clarify");
    assert.match(clarify.task?.blocked_reason ?? "", /goal/);

    await updateTaskState(root, "task-needs-input", {
      lifecycle: "open",
      blockedReason: null,
      phase: "plan",
      nextAction: "Try planning"
    });
    const plan = await runWorkflowAction(root, "plan", { taskId: "task-needs-input" });

    assert.equal(plan.task?.lifecycle, "blocked");
    assert.equal(plan.task?.phase, "clarify");
    assert.match(plan.task?.blocked_reason ?? "", /spec/);
  });

  it("creates and consumes a task-local resume note", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-resume", title: "Resume test" });

    const withResume = await createResumeNote(root, "task-resume", "# Resume\n\nContinue from check.\n", "User resumes work");
    assert.equal(withResume.artifacts.resume, "resume.md");
    assert.equal(withResume.resume_condition, "User resumes work");
    await assert.rejects(
      createResumeNote(root, "task-resume", "# Resume\n\nSecond note.\n"),
      /already has a resume note/
    );

    const consumed = await consumeResumeNote(root, "task-resume");
    assert.equal(consumed.artifacts.resume, null);
    assert.equal(consumed.resume_condition, null);
    const stored = await readTaskState(root, "task-resume");
    assert.equal(stored.artifacts.resume, null);
    assert.equal(stored.resume_condition, null);
  });

  it("creates and syncs a baseline delta", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-baseline", title: "Baseline test" });

    const withDelta = await ensureBaselineDelta(root, "task-baseline");
    assert.equal(withDelta.artifacts.baseline_delta, "baseline-delta.md");
    await writeFile(
      path.join(root, ".cw/tasks/task-baseline/baseline-delta.md"),
      "# Baseline Delta\n\n## commands.md\n\nRun `npm test` before finish.\n",
      "utf8"
    );

    const result = await syncBaselineDelta(root, "task-baseline", "accepted");
    assert.deepEqual(result.updated, [".cw/project/commands.md"]);
    assert.match(await readFile(path.join(root, ".cw/project/commands.md"), "utf8"), /Run `npm test` before finish\./);
  });

  it("syncs selected, edited, and skipped baseline delta decisions", async () => {
    const root = await tempRoot();
    await initProject(root);

    await createTask(root, { id: "task-selected-baseline", title: "Selected baseline" });
    await ensureBaselineDelta(root, "task-selected-baseline");
    await writeFile(
      path.join(root, ".cw/tasks/task-selected-baseline/baseline-delta.md"),
      "# Baseline Delta\n\n## commands.md\n\nUse `npm test`.\n\n## rules.md\n\nReview checklist before finish.\n",
      "utf8"
    );
    const selected = await syncBaselineDelta(root, "task-selected-baseline", "selected", {
      selectedFiles: ["commands.md"]
    });
    assert.deepEqual(selected.updated, [".cw/project/commands.md"]);
    assert.doesNotMatch(await readFile(path.join(root, ".cw/project/rules.md"), "utf8"), /Review checklist/);

    await createTask(root, { id: "task-edited-baseline", title: "Edited baseline" });
    await ensureBaselineDelta(root, "task-edited-baseline");
    const edited = await syncBaselineDelta(root, "task-edited-baseline", "edited", {
      editedMarkdown: "# Baseline Delta\n\n## rules.md\n\nEdited baseline rule.\n"
    });
    assert.deepEqual(edited.updated, [".cw/project/rules.md"]);
    assert.match(await readFile(path.join(root, ".cw/project/rules.md"), "utf8"), /Edited baseline rule/);

    await createTask(root, { id: "task-skipped-baseline", title: "Skipped baseline" });
    await ensureBaselineDelta(root, "task-skipped-baseline");
    const skipped = await syncBaselineDelta(root, "task-skipped-baseline", "skipped");
    assert.deepEqual(skipped.updated, []);
  });

  it("finishes a task only through the closure gate", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-finish", title: "Finish test" });

    await assert.rejects(
      updateTaskState(root, "task-finish", { lifecycle: "closed" }),
      /use finishTask/
    );
    await assert.rejects(
      finishTask(root, "task-finish", { summary: "Done" }),
      /closure gate failed/
    );

    await writeFile(
      path.join(root, ".cw/tasks/task-finish/spec.md"),
      "# Spec\n\n## Acceptance Criteria\n- [x] Works\n",
      "utf8"
    );
    await writeFile(
      path.join(root, ".cw/tasks/task-finish/task.md"),
      "# Task\n\n## Implementation\n- [x] Implemented\n\n## Verification\n- [x] Tested\n\n## Check\n- [x] Acceptance criteria in spec.md are covered.\n",
      "utf8"
    );
    await updateTaskState(root, "task-finish", {
      phase: "finish",
      nextAction: "Run cw-finish after user confirmation"
    });

    const finished = await finishTask(root, "task-finish", { summary: "Task finished" });
    assert.equal(finished.lifecycle, "closed");
    assert.equal(finished.phase, "finish");
    assert.equal(finished.next_action, "Task is closed");
  });

  it("blocks finish when check records unresolved drift", async () => {
    const root = await tempRoot();
    await initProject(root);
    await runWorkflowAction(root, "work", { taskId: "task-drift", title: "Drift test" });
    await runWorkflowAction(root, "clarify", {
      taskId: "task-drift",
      goal: "Keep behavior aligned.",
      acceptance: ["Drift is resolved before finish"]
    });
    await runWorkflowAction(root, "plan", { taskId: "task-drift" });
    await runWorkflowAction(root, "run", { taskId: "task-drift", summary: "Implementation changed behavior." });

    const check = await runWorkflowAction(root, "check", {
      taskId: "task-drift",
      drift: true,
      summary: "Spec drift found."
    });

    assert.equal(check.task?.phase, "check");
    assert.ok(check.task?.health_flags.includes("drift_suspected"));
    await assert.rejects(
      runWorkflowAction(root, "finish", { taskId: "task-drift", summary: "Done" }),
      /unresolved drift/
    );
  });

  it("requires explicit confirmation before syncing high-impact baseline deltas during finish", async () => {
    const root = await tempRoot();
    await initProject(root);
    await runWorkflowAction(root, "work", { taskId: "task-high-impact", title: "High impact baseline" });
    await runWorkflowAction(root, "clarify", {
      taskId: "task-high-impact",
      goal: "Document an architecture fact.",
      acceptance: ["Architecture fact is documented"]
    });
    await runWorkflowAction(root, "plan", { taskId: "task-high-impact" });
    await runWorkflowAction(root, "run", { taskId: "task-high-impact", summary: "Architecture note prepared." });
    await runWorkflowAction(root, "check", {
      taskId: "task-high-impact",
      summary: "Manual review passed.",
      manualVerification: "Reviewed architecture wording."
    });
    await ensureBaselineDelta(root, "task-high-impact");
    await writeFile(
      path.join(root, ".cw/tasks/task-high-impact/baseline-delta.md"),
      "# Baseline Delta\n\n## architecture.md\n\nArchitecture now documents the workflow kernel boundary.\n",
      "utf8"
    );

    await assert.rejects(
      runWorkflowAction(root, "finish", {
        taskId: "task-high-impact",
        summary: "Done",
        decision: "accepted"
      }),
      /high-impact baseline delta/
    );

    const finished = await runWorkflowAction(root, "finish", {
      taskId: "task-high-impact",
      summary: "Done",
      decision: "accepted",
      confirmBaselineImpact: true
    });
    assert.equal(finished.task?.lifecycle, "closed");
    assert.match(await readFile(path.join(root, ".cw/project/architecture.md"), "utf8"), /workflow kernel boundary/);
  });

  it("discards a task only with explicit confirmation", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-discard", title: "Discard test" });

    await assert.rejects(
      discardTask(root, "task-discard", { confirmed: false, worktreeHandling: "none" }),
      /confirmation/
    );

    await discardTask(root, "task-discard", { confirmed: true, worktreeHandling: "none" });
    await assert.rejects(access(path.join(root, ".cw/tasks/task-discard")));
  });

  it("doctor reports malformed task state and stale generated command entries", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-unhealthy", title: "Unhealthy task" });
    const taskJsonPath = path.join(root, ".cw/tasks/task-unhealthy/task.json");
    const state = JSON.parse(await readFile(taskJsonPath, "utf8")) as Record<string, unknown>;
    state.next_action = "";
    state.result = "done";
    await writeFile(taskJsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await writeFile(path.join(root, ".cw/agent-commands/cw-work.md"), "stale", "utf8");

    const report = await doctorProject(root);

    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.path.endsWith("task.json.next_action")));
    assert.ok(report.issues.some((issue) => issue.path.endsWith("task.json.result")));
    assert.ok(report.warnings.some((warning) => warning.message.includes("stale")));
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
    assert.ok(init.adapters.some((adapter) => adapter.created.includes(".cw/agent-commands/cw-work.md")));

    const work = await runWorkflowAction(root, "work", {
      taskId: "task-create-readme",
      title: "Create README"
    });
    assert.equal(work.task?.phase, "clarify");

    const clarify = await runWorkflowAction(root, "clarify", {
      taskId: "task-create-readme",
      goal: "Create a README file for the fixture project.",
      scope: "Add concise project documentation.",
      acceptance: ["README.md exists", "README explains how to test"]
    });
    assert.equal(clarify.task?.phase, "plan");

    const plan = await runWorkflowAction(root, "plan", { taskId: "task-create-readme" });
    assert.equal(plan.task?.phase, "run");

    const run = await runWorkflowAction(root, "run", {
      taskId: "task-create-readme",
      summary: "README.md created.",
      writeFile: "README.md",
      content: "# Fixture\n\nRun `npm test`.\n"
    });
    assert.equal(run.task?.phase, "check");
    assert.match(await readFile(path.join(root, "README.md"), "utf8"), /Run `npm test`/);

    const check = await runWorkflowAction(root, "check", {
      taskId: "task-create-readme",
      summary: "README.md reviewed against spec.",
      commands: ["test -f README.md"]
    });
    assert.equal(check.task?.phase, "finish");
    assert.deepEqual((check.details?.commands as Array<{ command: string }>).map((result) => result.command), ["test -f README.md"]);

    await ensureBaselineDelta(root, "task-create-readme");
    await writeFile(
      path.join(root, ".cw/tasks/task-create-readme/baseline-delta.md"),
      "# Baseline Delta\n\n## commands.md\n\nUse `npm test` to verify fixture behavior.\n",
      "utf8"
    );
    const finish = await runWorkflowAction(root, "finish", {
      taskId: "task-create-readme",
      summary: "README task complete.",
      decision: "accepted",
      dirtyWorktree: "covered"
    });
    assert.equal(finish.task?.lifecycle, "closed");
    assert.match(await readFile(path.join(root, ".cw/project/commands.md"), "utf8"), /verify fixture behavior/);

    await createTask(root, { id: "task-resume-flow", title: "Resume flow" });
    await createResumeNote(root, "task-resume-flow", "# Resume\n\nContinue.\n");
    const resume = await runWorkflowAction(root, "resume", { taskId: "task-resume-flow" });
    assert.equal(resume.task?.artifacts.resume, null);

    await createTask(root, { id: "task-discard-flow", title: "Discard flow" });
    const discard = await runWorkflowAction(root, "discard", {
      taskId: "task-discard-flow",
      confirm: true,
      worktreeHandling: "none"
    });
    assert.equal(discard.task, null);
    await assert.rejects(access(path.join(root, ".cw/tasks/task-discard-flow")));

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

async function readTrace(root: string, taskId: string): Promise<Array<Record<string, unknown>>> {
  const text = await readFile(path.join(root, ".cw/tasks", taskId, "trace.jsonl"), "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
