import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { tracePath } from "./paths.js";
import { TaskStateRecord, TraceEvent, ValidationIssue } from "./types.js";

export type ClarifyGateStage = "proposal" | "accept" | "advance" | "watchdog";

export type ClarifyGateIdentity = {
  attemptId: string;
  proposalId: string;
  proposalHash: string;
};

export type ClarifyGateInput = {
  task: TaskStateRecord;
  events: TraceEvent[];
  stage: ClarifyGateStage;
  attemptId?: string;
  proposalId?: string;
  proposalHash?: string;
};

export type ClarifyGateResult = {
  ok: boolean;
  stage: ClarifyGateStage;
  identity: ClarifyGateIdentity | null;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
};

type IndexedTraceEvent = {
  event: TraceEvent;
  index: number;
  data: Record<string, unknown>;
};

export function proposalHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function proposalIdFromHash(hash: string): string {
  return `p-${hash.slice(0, 12)}`;
}

export async function readTraceEvents(root: string, taskId: string): Promise<TraceEvent[]> {
  const text = await readFile(tracePath(root, taskId), "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TraceEvent);
}

export function validateClarifyGate(input: ClarifyGateInput): ClarifyGateResult {
  const requestedStage = input.stage;
  const stage = normalizeWatchdogStage(input);
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const proposed = findProposalEvent(input.events, input);
  if (proposed === null) {
    addIssue(issues, "trace.spec.proposed", "clarify gate requires a current spec.proposed event with proposal identity");
    return { ok: false, stage: input.stage, identity: null, issues, warnings };
  }

  const identity = identityFromEvent(proposed);
  if (identity === null) {
    addIssue(issues, "trace.identity", "current proposal event must include attempt_id, proposal_id, and proposal_hash");
    return { ok: false, stage: input.stage, identity: null, issues, warnings };
  }
  collectIdentityInputIssues(input, identity, issues);

  const brainstorm = findMatchingEvent(input.events, "brainstorm.done", identity);
  if (brainstorm === null) {
    addIssue(issues, "trace.brainstorm.done", "clarify gate requires brainstorm.done for the current proposal");
  } else if (brainstorm.index > proposed.index) {
    addIssue(issues, "trace.brainstorm.done", "brainstorm.done must appear before spec.proposed for the current proposal");
  }

  if (stage === "proposal") {
    return result(input.stage, identity, issues, warnings);
  }

  const advisor = findLatestAdvisorEvent(input.events, identity, proposed.index);
  if (advisor === null) {
    addIssue(
      requestedStage === "watchdog" && input.task.phase === "clarify" ? warnings : issues,
      "trace.advisor",
      "clarify gate requires advisor.reviewed or advisor.unavailable for the current proposal"
    );
  } else {
    validateAdvisorEvent(advisor, issues, warnings, requestedStage, input.task);
  }

  if (stage === "accept") {
    return result(input.stage, identity, issues, warnings);
  }

  const accepted = findMatchingEvent(input.events, "spec.accepted", identity);
  if (accepted === null) {
    addIssue(issues, "trace.spec.accepted", "clarify gate requires spec.accepted for the current proposal before phase advance");
  } else {
    if (accepted.index < proposed.index) {
      addIssue(issues, "trace.spec.accepted", "spec.accepted must appear after spec.proposed for the current proposal");
    }
    if (advisor !== null && accepted.index < advisor.index) {
      addIssue(issues, "trace.spec.accepted", "spec.accepted must appear after advisor review or recorded advisor fallback");
    }
    if (accepted.data.explicit !== true) {
      addIssue(issues, "trace.spec.accepted", "spec.accepted must record explicit: true");
    }
  }

  return result(input.stage, identity, issues, warnings);
}

function normalizeWatchdogStage(input: ClarifyGateInput): ClarifyGateStage {
  if (input.stage !== "watchdog") {
    return input.stage;
  }
  return input.task.phase === "clarify" ? "accept" : "advance";
}

function result(
  stage: ClarifyGateStage,
  identity: ClarifyGateIdentity,
  issues: ValidationIssue[],
  warnings: ValidationIssue[]
): ClarifyGateResult {
  return { ok: issues.length === 0, stage, identity, issues, warnings };
}

function findProposalEvent(events: TraceEvent[], input: ClarifyGateInput): IndexedTraceEvent | null {
  const candidates = indexed(events).filter((entry) => {
    if (entry.event.type !== "spec.proposed") {
      return false;
    }
    const identity = identityFromEvent(entry);
    if (identity === null) {
      return false;
    }
    if (input.attemptId !== undefined && identity.attemptId !== input.attemptId) {
      return false;
    }
    if (input.proposalId !== undefined && identity.proposalId !== input.proposalId) {
      return false;
    }
    if (input.proposalHash !== undefined && identity.proposalHash !== input.proposalHash) {
      return false;
    }
    return true;
  });
  return candidates.at(-1) ?? null;
}

function findMatchingEvent(events: TraceEvent[], type: string, identity: ClarifyGateIdentity): IndexedTraceEvent | null {
  return indexed(events)
    .filter((entry) => entry.event.type === type && identityMatches(entry, identity))
    .at(-1) ?? null;
}

function findLatestAdvisorEvent(
  events: TraceEvent[],
  identity: ClarifyGateIdentity,
  proposedIndex: number
): IndexedTraceEvent | null {
  return indexed(events)
    .filter(
      (entry) =>
        (entry.event.type === "advisor.reviewed" || entry.event.type === "advisor.unavailable") &&
        entry.index > proposedIndex &&
        identityMatches(entry, identity)
    )
    .at(-1) ?? null;
}

function validateAdvisorEvent(
  entry: IndexedTraceEvent,
  issues: ValidationIssue[],
  warnings: ValidationIssue[],
  stage: ClarifyGateStage,
  task: TaskStateRecord
): void {
  if (entry.event.type === "advisor.unavailable") {
    validateAdvisorUnavailable(entry, issues);
    return;
  }

  const verdict = entry.data.verdict;
  if (verdict !== "pass" && verdict !== "concern" && verdict !== "blocker") {
    addIssue(issues, "trace.advisor.reviewed.verdict", "advisor.reviewed verdict must be pass, concern, or blocker");
    return;
  }
  if (verdict === "concern" && !concernHandled(entry.data)) {
    addIssue(
      stage === "watchdog" && task.phase === "clarify" ? warnings : issues,
      "trace.advisor.reviewed.concern",
      "advisor concern requires concerns_resolved, deferred_reason, or user_risk_acceptance"
    );
  }
  if (verdict === "blocker" && !blockerHandled(entry.data)) {
    addIssue(issues, "trace.advisor.reviewed.blocker", "advisor blocker requires blockers_resolved or user_override");
  }
}

function validateAdvisorUnavailable(entry: IndexedTraceEvent, issues: ValidationIssue[]): void {
  if (entry.data.attempted !== true) {
    addIssue(issues, "trace.advisor.unavailable.attempted", "advisor.unavailable must record attempted: true");
  }
  for (const [key, message] of [
    ["harness", "advisor.unavailable must record harness"],
    ["failure_reason", "advisor.unavailable must record failure_reason"],
    ["fallback_checklist_result", "advisor.unavailable must record fallback_checklist_result"]
  ] as const) {
    const value = entry.data[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      addIssue(issues, `trace.advisor.unavailable.${key}`, message);
    }
  }
}

function concernHandled(data: Record<string, unknown>): boolean {
  return data.concerns_resolved === true || nonEmptyString(data.deferred_reason) || data.user_risk_acceptance === true;
}

function blockerHandled(data: Record<string, unknown>): boolean {
  return data.blockers_resolved === true || data.user_override === true;
}

function collectIdentityInputIssues(
  input: ClarifyGateInput,
  identity: ClarifyGateIdentity | null,
  issues: ValidationIssue[]
): void {
  if (identity === null) {
    addIssue(issues, "trace.identity", "current proposal event must include attempt_id, proposal_id, and proposal_hash");
    return;
  }
  if (input.attemptId !== undefined && input.attemptId !== identity.attemptId) {
    addIssue(issues, "trace.identity.attempt_id", "requested attempt_id does not match current proposal");
  }
  if (input.proposalId !== undefined && input.proposalId !== identity.proposalId) {
    addIssue(issues, "trace.identity.proposal_id", "requested proposal_id does not match current proposal");
  }
  if (input.proposalHash !== undefined && input.proposalHash !== identity.proposalHash) {
    addIssue(issues, "trace.identity.proposal_hash", "requested proposal_hash does not match current proposal");
  }
}

function indexed(events: TraceEvent[]): IndexedTraceEvent[] {
  return events.map((event, index) => ({
    event,
    index,
    data: event.data ?? {}
  }));
}

function identityMatches(entry: IndexedTraceEvent, identity: ClarifyGateIdentity): boolean {
  return entry.data.attempt_id === identity.attemptId &&
    entry.data.proposal_id === identity.proposalId &&
    entry.data.proposal_hash === identity.proposalHash;
}

function identityFromEvent(entry: IndexedTraceEvent): ClarifyGateIdentity | null {
  const attemptId = entry.data.attempt_id;
  const proposalId = entry.data.proposal_id;
  const hash = entry.data.proposal_hash;
  if (typeof attemptId !== "string" || typeof proposalId !== "string" || typeof hash !== "string") {
    return null;
  }
  if (attemptId.trim().length === 0 || proposalId.trim().length === 0 || hash.trim().length === 0) {
    return null;
  }
  return {
    attemptId,
    proposalId,
    proposalHash: hash
  };
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function addIssue(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}
