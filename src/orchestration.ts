import { FLOWFLOW_SCHEMA_VERSION, OrchestrationConfigRecord, RoleModelProfile } from "./types.js";

export const AGENT_ROLE_NAMES = [
  "advisor",
  "planner",
  "implementer",
  "reviewer",
  "checker",
  "baseline-writer"
] as const;

export const ADVISOR_MODES = ["off", "manual", "gate", "high-risk", "always-on"] as const;
export const ADVISOR_SEVERITIES = ["nit", "concern", "blocker"] as const;
export const MODEL_CAPABILITY_TIERS = ["fast", "balanced", "high-reasoning", "review", "long-context"] as const;
export const MODEL_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "auto"] as const;
export const ORCHESTRATION_HARNESSES = ["codex", "claude", "opencode", "pi", "cursor"] as const;

export const DEFAULT_ROLE_MODEL_PROFILES: Record<(typeof AGENT_ROLE_NAMES)[number], RoleModelProfile> = {
  advisor: {
    capability_tier: "high-reasoning",
    model: null,
    reasoning_effort: "high",
    temperature: 0.1,
    notes: [
      "Skeptical read-only reviewer. Prefer the strongest reasoning model available because advisor output can block workflow progress."
    ]
  },
  planner: {
    capability_tier: "high-reasoning",
    model: null,
    reasoning_effort: "high",
    temperature: 0.1,
    notes: ["Turns accepted specs into plans and task checklists. Needs strong reasoning and enough context to compare artifacts."]
  },
  implementer: {
    capability_tier: "balanced",
    model: null,
    reasoning_effort: "medium",
    temperature: 0.2,
    notes: ["Writes code and tests within task.md. Needs tool use and coding reliability more than maximum deliberation."]
  },
  reviewer: {
    capability_tier: "review",
    model: null,
    reasoning_effort: "high",
    temperature: 0.1,
    notes: ["Reviews artifact alignment and implementation evidence. Prefer models that catch omissions and regressions."]
  },
  checker: {
    capability_tier: "balanced",
    model: null,
    reasoning_effort: "medium",
    temperature: 0.2,
    notes: ["Runs verification and fixes small in-scope defects. Needs reliable command execution and concise reporting."]
  },
  "baseline-writer": {
    capability_tier: "fast",
    model: null,
    reasoning_effort: "low",
    temperature: 0.1,
    notes: ["Drafts current-state Project Baseline updates after user acceptance. Keep the model inexpensive and precise."]
  }
};

export function defaultOrchestrationConfig(now: Date): OrchestrationConfigRecord {
  return {
    schema_version: FLOWFLOW_SCHEMA_VERSION,
    advisor: {
      enabled_by_default: true,
      mode: "always-on",
      sync_backlog: 2,
      severity_levels: [...ADVISOR_SEVERITIES]
    },
    roles: DEFAULT_ROLE_MODEL_PROFILES,
    harness_overrides: Object.fromEntries(ORCHESTRATION_HARNESSES.map((harness) => [harness, {}])),
    updated_at: now.toISOString()
  };
}
