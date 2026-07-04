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
  updateTaskState,
  validateProject
} from "../src/index.js";

describe("cw kernel", () => {
  it("initializes a project with version, baseline, task templates, and valid structure", async () => {
    const root = await tempRoot();

    const result = await initProject(root, new Date("2026-07-03T00:00:00.000Z"));

    assert.ok(result.created.includes(".cw/version.json"));
    assert.ok(result.created.includes(".cw/project/overview.md"));
    assert.ok(result.created.includes(".cw/templates/spec.md"));
    assert.equal(result.adapters[0]?.harness, "generic");
    assert.ok(result.adapters[0]?.created.includes(".cw/agent-commands/cw-work.md"));
    assert.match(await readFile(path.join(root, ".cw/agent-commands/cw-work.md"), "utf8"), /repo truth/);
    assert.deepEqual(await validateProject(root), []);
    assert.equal((await doctorProject(root)).ok, true);
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

  it("creates and consumes a task-local resume note", async () => {
    const root = await tempRoot();
    await initProject(root);
    await createTask(root, { id: "task-resume", title: "Resume test" });

    const withResume = await createResumeNote(root, "task-resume", "# Resume\n\nContinue from check.\n", "User resumes work");
    assert.equal(withResume.artifacts.resume, "resume.md");
    assert.equal(withResume.resume_condition, "User resumes work");

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

    const finished = await finishTask(root, "task-finish", { summary: "Task finished" });
    assert.equal(finished.lifecycle, "closed");
    assert.equal(finished.phase, "finish");
    assert.equal(finished.next_action, "Task is closed");
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
