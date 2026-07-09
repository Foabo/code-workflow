import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
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
  refreshContextPackageViaCli,
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

const execFileAsync = promisify(execFile);

describe("ff tasks", () => {
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

  it("generates a task context package with manifest fingerprints and dirty classification", async () => {
    const root = await tempRoot();
    await initProject(root);
    await initGitRepository(root);
    await createTaskViaCli(root, {
      id: "0001-context-package",
      title: "Context package"
    });
    await writeFile(
      path.join(root, ".ff/tasks/0001-context-package/spec.md"),
      [
        "# Spec",
        "",
        "## Goal",
        "",
        "Reduce repeated task context reading.",
        "",
        "## Scope",
        "",
        "- Generate a package.",
        "",
        "## Acceptance Criteria",
        "- [ ] package exists",
        "- [ ] manifest exists",
        ""
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(root, ".ff/tasks/0001-context-package/task.md"),
      "# Task\n\n## Implementation\n- [ ] Build package\n\n## Verification\n- [ ] Run tests\n\n## Check\n- [ ] Evidence\n",
      "utf8"
    );
    await writeFile(path.join(root, "outside.txt"), "outside current task\n", "utf8");

    const result = await refreshContextPackageViaCli(root, "0001-context-package");

    assert.equal(result.ok, true);
    assert.equal(result.status, "created");
    assert.equal(result.stale, true);
    assert.equal(result.package_path, ".ff/tasks/0001-context-package/context-package.md");
    assert.equal(result.manifest_path, ".ff/tasks/0001-context-package/context-package.manifest.json");
    const packageText = await readFile(path.join(root, ".ff/tasks/0001-context-package/context-package.md"), "utf8");
    assert.match(packageText, /# Context Package/);
    assert.match(packageText, /## Task Brief/);
    assert.match(packageText, /## Acceptance Criteria/);
    assert.match(packageText, /package exists/);
    assert.match(packageText, /## Git Status/);
    assert.match(packageText, /## Diff Classification/);
    assert.match(packageText, /Do not give a spec verdict from diff summary alone/);
    const manifest = JSON.parse(
      await readFile(path.join(root, ".ff/tasks/0001-context-package/context-package.manifest.json"), "utf8")
    ) as Record<string, unknown>;
    assert.equal(manifest.task_id, "0001-context-package");
    assert.equal(manifest.generator_version, 1);
    assert.ok(Array.isArray((manifest.inputs as Record<string, unknown>).files));
    const diff = manifest.diff as Record<string, Array<{ path: string }>>;
    assert.ok(diff.included.some((entry) => entry.path === ".ff/tasks/0001-context-package" || entry.path.startsWith(".ff/tasks/0001-context-package/")));
    assert.ok(diff.uncertain.some((entry) => entry.path === "outside.txt"));
    const metrics = manifest.metrics as Record<string, number>;
    assert.ok(metrics.package_bytes > 0);
    assert.ok(metrics.role_handoff_raw_bytes > 0);
    assert.equal(typeof metrics.role_handoff_savings_percent, "number");

    const current = await refreshContextPackageViaCli(root, "0001-context-package");
    assert.equal(current.status, "current");
    assert.equal(current.stale, false);
    const currentManifest = JSON.parse(
      await readFile(path.join(root, ".ff/tasks/0001-context-package/context-package.manifest.json"), "utf8")
    ) as Record<string, unknown>;
    assert.equal(currentManifest.status, "current");

    await writeFile(path.join(root, ".ff/tasks/0001-context-package/spec.md"), `${packageText}\nchanged input\n`, "utf8");
    const refreshed = await refreshContextPackageViaCli(root, "0001-context-package");
    assert.equal(refreshed.status, "refreshed");
    assert.equal(refreshed.stale, true);
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

});

async function initGitRepository(root: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["-c", "user.email=flowflow@example.test", "-c", "user.name=Flowflow Test", "commit", "-m", "baseline"], { cwd: root });
}
