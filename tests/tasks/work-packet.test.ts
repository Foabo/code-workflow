import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import { initProject } from "../../src/index.js";
import {
  buildWorkPacket,
  validateCodeContext,
  WORK_PACKET_MAX_HANDOFF_BYTES,
  WorkPacketBudgetError,
  WorkPacketContextError,
  type CodeContext,
  type WorkPacketRole
} from "../../src/tasks/index.js";
import {
  appendTraceViaCli,
  cliJson,
  createTaskViaCli,
  readTrace,
  runCli,
  tempRoot
} from "../support/kernel.js";

const ROLES: WorkPacketRole[] = [
  "advisor",
  "planner",
  "implementer",
  "checker",
  "reviewer",
  "baseline-writer"
];
const execFileAsync = promisify(execFile);

const CODE_CONTEXT: CodeContext = {
  strategy: "graph",
  provider_status: "configured",
  tool_visibility: "visible",
  tool_calls: [
    {
      tool: "search_graph",
      query: "build work packet",
      status: "success",
      result_summary: "Located src/tasks and CLI entry points."
    }
  ],
  files: ["src/tasks/index.ts"],
  symbols: [
    {
      name: "readTaskState",
      path: "src/tasks/lifecycle.ts",
      line: 111,
      relationship: "reads task state"
    }
  ],
  snippets: [
    {
      path: "src/tasks/lifecycle.ts",
      start_line: 111,
      end_line: 115,
      content: "export async function readTaskState() {}"
    }
  ],
  fallback_reason: null
};

describe("work packet", () => {
  it("validates structured code context and rejects free-form or incomplete input", () => {
    assert.deepEqual(validateCodeContext(CODE_CONTEXT), []);
    assert.match(validateCodeContext("search the repository")[0]?.message ?? "", /JSON object/);
    assert.ok(validateCodeContext({ strategy: "graph" }).some((issue) => issue.path.endsWith("tool_calls")));
    assert.match(
      validateCodeContext({ ...CODE_CONTEXT, strategy: "unknown" })[0]?.message ?? "",
      /strategy/
    );
    assert.ok(validateCodeContext({ ...CODE_CONTEXT, files: ["../outside.ts"] }).some((issue) => /safe repository-relative/.test(issue.message)));
    assert.ok(validateCodeContext({ ...CODE_CONTEXT, files: [".ff/tasks/0001/spec.md"] }).some((issue) => /not code context/.test(issue.message)));
  });

  it("records each code-discovery branch in the validated final payload", async () => {
    const root = await preparedTaskRoot();
    const fixtures: CodeContext[] = [
      CODE_CONTEXT,
      fallbackContext("configured", "visible", "call-failed"),
      fallbackContext("failed", "unknown", "provider-failed"),
      fallbackContext("skipped", "unknown", "provider-skipped"),
      fallbackContext("unconfigured", "unknown", "provider-unconfigured"),
      fallbackContext("configured", "missing", "tool-missing")
    ];

    for (const codeContext of fixtures) {
      assert.deepEqual(validateCodeContext(codeContext), []);
      const packet = await buildWorkPacket(root, "0001-packet", { role: "implementer", codeContext });
      assert.equal(packet.code_context.provider_status, codeContext.provider_status);
      assert.equal(packet.code_context.tool_visibility, codeContext.tool_visibility);
      assert.equal(packet.code_context.fallback_reason, codeContext.fallback_reason);
      assert.match(packet.handoff_payload, new RegExp(codeContext.fallback_reason ?? "search_graph"));
    }
  });

  it("builds deterministic role packets below the handoff safety limit", async () => {
    const root = await preparedTaskRoot();

    for (const role of ROLES) {
      const first = await buildWorkPacket(root, "0001-packet", { role, codeContext: CODE_CONTEXT });
      const second = await buildWorkPacket(root, "0001-packet", { role, codeContext: CODE_CONTEXT });

      assert.equal(first.schema_version, 1);
      assert.equal(first.role, role);
      assert.equal(first.packet_bytes, Buffer.byteLength(JSON.stringify(first.packet), "utf8"));
      assert.equal(first.handoff_payload_bytes, Buffer.byteLength(first.handoff_payload, "utf8"));
      assert.ok(first.handoff_payload_bytes <= WORK_PACKET_MAX_HANDOFF_BYTES);
      assert.equal(first.fingerprint, second.fingerprint);
      assert.deepEqual(first.packet, second.packet);
      assert.doesNotMatch(first.handoff_payload, /context-package\.manifest\.json/);
      assert.doesNotMatch(first.handoff_payload, /SECRET-EVIDENCE/);
      if (role === "checker" || role === "reviewer") {
        const task = first.packet.task as Record<string, unknown>;
        assert.equal(task.id, "0001-packet");
        assert.equal(typeof task.phase, "string");
        assert.equal(task.title, undefined);
        assert.equal(task.next_action, undefined);
      }
    }
  });

  it("selects the required fields for each role without cross-role history", async () => {
    const root = await preparedTaskRoot();
    const packets = Object.fromEntries(await Promise.all(
      ROLES.map(async (role) => [role, (await buildWorkPacket(root, "0001-packet", { role, codeContext: CODE_CONTEXT })).packet])
    )) as Record<WorkPacketRole, Record<string, unknown>>;

    assert.ok(packets.advisor.proposal_identity);
    assert.ok(packets.advisor.contract);
    assert.equal(packets.advisor.baseline, undefined);
    assert.ok(packets.planner.contract);
    assert.ok(packets.planner.baseline);
    assert.equal(packets.planner.diff, undefined);
    assert.deepEqual(packets.implementer.assignment, ["- [ ] Build packet types and code-context validation."]);
    assert.ok(packets.implementer.acceptance_criteria);
    assert.equal(packets.implementer.diff, undefined);
    assert.ok(packets.checker.acceptance_criteria);
    assert.ok(packets.checker.verification_evidence);
    assert.equal(packets.checker.review_contract, undefined);
    assert.ok(packets.reviewer.review_contract);
    assert.ok(packets.reviewer.verification_evidence);
    assert.equal(packets.reviewer.assignment, undefined);
    assert.match(String(packets["baseline-writer"].baseline_delta), /role-specific runtime views/);
    assert.ok(packets["baseline-writer"].target_baseline);
    assert.equal(packets["baseline-writer"].contract, undefined);
  });

  it("keeps evidence and packet audit changes outside the packet fingerprint", async () => {
    const root = await preparedTaskRoot();
    const before = await buildWorkPacket(root, "0001-packet", {
      role: "implementer",
      codeContext: CODE_CONTEXT
    });

    const evidenceDir = path.join(root, ".ff/tasks/0001-packet/evidence");
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(path.join(evidenceDir, "token-review.md"), "SECRET-EVIDENCE changed\n", "utf8");
    await appendTraceViaCli(root, "0001-packet", {
      type: "handoff.packet-built",
      summary: "Audit only",
      data: { packet_bytes: before.packet_bytes }
    });

    const after = await buildWorkPacket(root, "0001-packet", {
      role: "implementer",
      codeContext: CODE_CONTEXT
    });
    assert.equal(after.fingerprint, before.fingerprint);
    assert.equal(after.source_bytes, before.source_bytes);
    assert.deepEqual(after.packet, before.packet);
  });

  it("includes staged and untracked text in checker diff context", async () => {
    const root = await preparedTaskRoot();
    await initGitRepository(root);
    const overviewPath = path.join(root, ".ff/project/overview.md");
    await writeFile(overviewPath, `${await readFile(overviewPath, "utf8")}\nSTAGED-CONTEXT\n`, "utf8");
    await execFileAsync("git", ["add", ".ff/project/overview.md"], { cwd: root });
    await writeFile(path.join(root, "new-work-packet-file.ts"), "export const UNTRACKED_CONTEXT = true;\n", "utf8");
    await writeFile(path.join(root, "unrelated-secret.txt"), "UNRELATED-SECRET\n", "utf8");
    await writeFile(path.join(root, ".ff/tasks/0001-packet/private-note.md"), "TASK-SECRET\n", "utf8");

    const packet = await buildWorkPacket(root, "0001-packet", {
      role: "checker",
      codeContext: {
        ...CODE_CONTEXT,
        files: [".ff/project/overview.md", "new-work-packet-file.ts"]
      }
    });
    assert.equal(packet.packet.context_status, "ready");
    assert.match(packet.handoff_payload, /STAGED-CONTEXT/);
    assert.match(packet.handoff_payload, /UNTRACKED_CONTEXT/);
    assert.doesNotMatch(packet.handoff_payload, /UNRELATED-SECRET/);
    assert.doesNotMatch(packet.handoff_payload, /TASK-SECRET/);
  });

  it("keeps complete UTF-8 contract sections below the safety limit", async () => {
    const root = await preparedTaskRoot();
    const specPath = path.join(root, ".ff/tasks/0001-packet/spec.md");
    await writeFile(
      specPath,
      `# Spec

## Goal

Keep the contract correct.

## Scope

${"范围内容".repeat(8_000)}

## Constraints

- Never silently truncate a criterion.

## Decisions

- Use source refs for omitted sections.

## Acceptance Criteria

- [ ] The packet keeps required boundaries.
`,
      "utf8"
    );

    const packet = await buildWorkPacket(root, "0001-packet", { role: "planner" });
    assert.ok(packet.handoff_payload_bytes <= WORK_PACKET_MAX_HANDOFF_BYTES);
    assert.match(JSON.stringify(packet.packet), /范围内容/);
  });

  it("enforces the exact full-handoff safety boundary without compaction", async () => {
    const root = await preparedTaskRoot();
    const specPath = path.join(root, ".ff/tasks/0001-packet/spec.md");
    const renderSpec = (size: number) => `# Spec\n\n## Goal\n\n${"x".repeat(size)}\n\n## Acceptance Criteria\n\n- [ ] Keep the complete contract.\n`;
    let lower = 0;
    let upper = WORK_PACKET_MAX_HANDOFF_BYTES * 2;

    while (lower + 1 < upper) {
      const middle = Math.floor((lower + upper) / 2);
      await writeFile(specPath, renderSpec(middle), "utf8");
      try {
        await buildWorkPacket(root, "0001-packet", { role: "advisor" });
        lower = middle;
      } catch (error) {
        assert.ok(error instanceof WorkPacketBudgetError);
        upper = middle;
      }
    }

    await writeFile(specPath, renderSpec(lower), "utf8");
    const accepted = await buildWorkPacket(root, "0001-packet", { role: "advisor" });
    assert.ok(accepted.handoff_payload_bytes <= WORK_PACKET_MAX_HANDOFF_BYTES);
    assert.match(JSON.stringify(accepted.packet), new RegExp(`x{${Math.min(lower, 100)}}`));

    await writeFile(specPath, renderSpec(upper), "utf8");
    await assert.rejects(
      buildWorkPacket(root, "0001-packet", { role: "advisor" }),
      (error: unknown) => {
        assert.ok(error instanceof WorkPacketBudgetError);
        assert.equal(error.bytes, WORK_PACKET_MAX_HANDOFF_BYTES + 1);
        assert.equal(Object.values(error.components).reduce((total, bytes) => total + bytes, 0), error.bytes);
        return true;
      }
    );
  });

  it("fails when required contract content cannot fit or baseline input is missing", async () => {
    const root = await preparedTaskRoot();
    await writeFile(
      path.join(root, ".ff/tasks/0001-packet/spec.md"),
      `# Spec\n\n## Goal\n\n${"必须保留".repeat(20_000)}\n\n## Constraints\n\n- Keep this boundary.\n`,
      "utf8"
    );
    await assert.rejects(
      buildWorkPacket(root, "0001-packet", { role: "advisor" }),
      (error: unknown) => {
        assert.ok(error instanceof WorkPacketBudgetError);
        assert.equal(error.budget, WORK_PACKET_MAX_HANDOFF_BYTES);
        assert.ok(error.bytes > error.budget);
        assert.ok((error.components.packet ?? 0) > 0);
        assert.match(error.message, /safety limit/);
        return true;
      }
    );

    const noDeltaRoot = await tempRoot();
    await initProject(noDeltaRoot);
    await createTaskViaCli(noDeltaRoot, { id: "0001-no-delta", title: "No delta" });
    await assert.rejects(
      buildWorkPacket(noDeltaRoot, "0001-no-delta", { role: "baseline-writer" }),
      (error: unknown) => error instanceof WorkPacketContextError
    );
  });

  it("exposes a stdout-only CLI helper and appends a compact audit event", async () => {
    const root = await preparedTaskRoot();
    const taskDir = path.join(root, ".ff/tasks/0001-packet");
    const result = await cliJson<Record<string, unknown>>([
      "internal",
      "build-work-packet",
      "--root",
      root,
      "--task",
      "0001-packet",
      "--role",
      "implementer"
    ]);

    assert.equal(result.role, "implementer");
    assert.equal(typeof result.handoff_payload, "string");
    assert.equal(typeof result.fingerprint, "string");
    assert.equal(result.packet, undefined);
    assert.equal(result.code_context, undefined);
    assert.equal(result.packet_bytes, undefined);
    assert.equal(result.source_bytes, undefined);
    assert.equal(result.reduction_percent, undefined);
    await assert.rejects(readFile(path.join(taskDir, "work-packet.json"), "utf8"));
    await assert.rejects(readFile(path.join(taskDir, "work-packet.manifest.json"), "utf8"));

    const event = (await readTrace(root, "0001-packet")).at(-1);
    const data = event?.data as Record<string, unknown> | undefined;
    assert.equal(event?.type, "handoff.packet-built");
    assert.equal(data?.role, "implementer");
    assert.equal(typeof data?.packet_bytes, "number");
    assert.equal(typeof data?.source_bytes, "number");
    assert.equal(typeof data?.reduction_percent, "number");
    assert.equal(data?.packet, undefined);
    assert.equal(data?.handoff_payload, undefined);
  });

  it("rejects invalid roles and invalid code-context files with a non-zero exit", async () => {
    const root = await preparedTaskRoot();
    const invalidPath = path.join(root, "invalid-code-context.json");
    await writeFile(invalidPath, JSON.stringify({ strategy: "graph" }), "utf8");

    const invalidRole = await runCli([
      "internal",
      "build-work-packet",
      "--root",
      root,
      "--task",
      "0001-packet",
      "--role",
      "writer"
    ]);
    assert.equal(invalidRole.code, 1);
    assert.match(invalidRole.stderr, /invalid work packet role/);

    const invalidContext = await runCli([
      "internal",
      "build-work-packet",
      "--root",
      root,
      "--task",
      "0001-packet",
      "--role",
      "implementer",
      "--code-context-file",
      invalidPath
    ]);
    assert.equal(invalidContext.code, 1);
    assert.match(invalidContext.stderr, /code context/);
  });

  it("does not emit a packet when the audit trace cannot be appended", async () => {
    const root = await preparedTaskRoot();
    const tracePath = path.join(root, ".ff/tasks/0001-packet/trace.jsonl");
    await rm(tracePath);
    await mkdir(tracePath);

    const result = await runCli([
      "internal",
      "build-work-packet",
      "--root",
      root,
      "--task",
      "0001-packet",
      "--role",
      "implementer"
    ]);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
  });
});

async function preparedTaskRoot(): Promise<string> {
  const root = await tempRoot();
  await initProject(root);
  await createTaskViaCli(root, { id: "0001-packet", title: "Build work packet" });
  const taskDir = path.join(root, ".ff/tasks/0001-packet");

  await writeFile(
    path.join(taskDir, "spec.md"),
    `# Spec

## Goal

Reduce delegated context without weakening correctness.

## Scope

- Build a role-specific packet.
- Accept validated code-context JSON.

## Non-goals

- Do not create a packet cache.

## Constraints

- Keep acceptance criteria and safety boundaries.

## Decisions

- The packet is returned through stdout.

## Acceptance Criteria

- [ ] The implementer receives the next checklist item and relevant code context.
- [ ] The checker requires changed files and verification evidence.
- [ ] The baseline writer reads only the delta and target Baseline files.
`,
    "utf8"
  );
  await writeFile(
    path.join(taskDir, "plan.md"),
    `# Plan

## Approach

Build and validate the packet before delegation.

## Validation Strategy

- npm test
`,
    "utf8"
  );
  await writeFile(
    path.join(taskDir, "task.md"),
    `# Task

## Implementation

- [x] Freeze legacy fixture.
- [ ] Build packet types and code-context validation.
- [ ] Add CLI integration.

## Verification

- [ ] Run npm test.

## Check

- [ ] Acceptance criteria in spec.md are covered.

## Notes

- Keep the dirty worktree intact.
`,
    "utf8"
  );
  await cliJson([
    "internal",
    "ensure-baseline-delta",
    "--root",
    root,
    "--task",
    "0001-packet"
  ]);
  await writeFile(
    path.join(taskDir, "baseline-delta.md"),
    `# Baseline Delta

## architecture.md

- Work packets are role-specific runtime views.
`,
    "utf8"
  );
  await appendTraceViaCli(root, "0001-packet", {
    type: "spec.proposed",
    summary: "Proposal recorded",
    data: {
      attempt_id: "a-test",
      proposal_id: "p-test",
      proposal_hash: "abc123"
    }
  });
  await appendTraceViaCli(root, "0001-packet", {
    type: "spec.accepted",
    summary: "Proposal accepted",
    data: {
      attempt_id: "a-test",
      proposal_id: "p-test",
      proposal_hash: "abc123",
      explicit: true
    }
  });
  await appendTraceViaCli(root, "0001-packet", {
    type: "check.passed",
    summary: "npm test passed",
    data: { command: "npm test", ok: true }
  });
  return root;
}

async function initGitRepository(root: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync(
    "git",
    ["-c", "user.email=flowflow@example.test", "-c", "user.name=Flowflow Test", "commit", "-m", "baseline"],
    { cwd: root }
  );
}

function fallbackContext(
  providerStatus: CodeContext["provider_status"],
  toolVisibility: CodeContext["tool_visibility"],
  fallbackReason: Exclude<CodeContext["fallback_reason"], null>
): CodeContext {
  return {
    strategy: "rg",
    provider_status: providerStatus,
    tool_visibility: toolVisibility,
    tool_calls: fallbackReason === "call-failed"
      ? [{ tool: "search_graph", query: "build packet", status: "failed", error: "provider call failed" }]
      : [],
    files: ["src/tasks/work-packet.ts"],
    symbols: [],
    snippets: [],
    fallback_reason: fallbackReason
  };
}
