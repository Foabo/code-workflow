import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { ensureDir, isNodeError, writeFileIfMissing } from "./fs.js";
import { AGENT_ROLE_NAMES, DEFAULT_ROLE_MODEL_PROFILES } from "./orchestration.js";
import { readJsonFile } from "./json.js";
import { getFlowflowPaths } from "./paths.js";
import { AGENT_COMMANDS } from "./templates.js";
import {
  AgentRoleName,
  HarnessRoleModelOverride,
  ModelReasoningEffort,
  OrchestrationConfigRecord,
  RoleModelProfile
} from "./types.js";

export type HarnessName = "codex" | "claude" | "opencode" | "pi" | "cursor";

export type AdapterResult = {
  harness: HarnessName;
  created: string[];
  existing: string[];
};

export type AdapterOptions = {
  overwrite?: boolean;
  force?: boolean;
};

export type ProtectedRoleAgentConfigConflict = {
  path: string;
  fields: string[];
};

export class ProtectedRoleAgentConfigConflictError extends Error {
  readonly conflicts: ProtectedRoleAgentConfigConflict[];

  constructor(conflicts: ProtectedRoleAgentConfigConflict[]) {
    super(formatProtectedRoleAgentConfigConflictMessage(conflicts));
    this.name = "ProtectedRoleAgentConfigConflictError";
    this.conflicts = conflicts;
  }
}

const commandPurposes: Record<(typeof AGENT_COMMANDS)[number], string> = {
  "ff-work": "Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.",
  "ff-clarify": "Review fuzzy intent, produce a user-confirmed Proposed Spec, then update spec.md with the accepted task contract.",
  "ff-plan": "Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.",
  "ff-run": "Execute the next checklist items from task.md, modify repository code, update progress, and append trace events through helpers.",
  "ff-check": "Run verification and review, reconcile drift, and update task.md before finish is allowed.",
  "ff-finish": "Run the closure gate, handle dirty worktree state, sync accepted baseline delta, consume resume notes, and close the task.",
  "ff-resume": "Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.",
  "ff-discard": "Abandon a task after user-confirmed worktree handling, then remove the task record.",
  "ff-doctor": "Inspect repository workflow health with ff doctor and report issues or warnings.",
  "ff-understand": "Draft project baseline updates for an existing repository, then ask the user what to merge."
};

const commandSteps: Record<(typeof AGENT_COMMANDS)[number], string[]> = {
  "ff-work": [
    "Run `ff preflight --action work`.",
    "If no task exists, create one with `ff internal create-task --title <title>` after deriving a clear title from the user request.",
    "Select the task with `ff internal select-task` or `ff internal select-task --task <task-id>`.",
    "Read spec.md, plan.md, task.md, and relevant project baseline files.",
    "Route by current task phase and artifact state: clarify, plan, run, check, or finish readiness.",
    "Apply the matching command behavior in this same agent session when the next step is clear.",
    "Stop for user judgment when the matching phase requires confirmation, new requirements, or product behavior decisions.",
    "When check passes, report finish readiness and ask whether to run ff-finish."
  ],
  "ff-clarify": [
    "Run `ff preflight --action clarify --task <task-id>` when a task id is known.",
    "Read the current spec.md and relevant project baseline files.",
    "Run the Brainstorm Pass described below before drafting Proposed Spec.",
    "Run the Grill Loop described below until Open Decisions and high-risk assumptions are resolved or explicitly accepted.",
    "Present a Proposed Spec, write its content to spec.md, then record it with `ff internal propose-spec --task <task-id> --spec-file <path>` (hashes the file, appends `brainstorm.done` + `spec.proposed` with identity, returns the identity). The `proposal_hash` binds the spec.md content.",
    "Call the `ff-advisor` role when available to review the current Proposed Spec before asking the user to accept it.",
    "If advisor is unavailable, record `advisor.unavailable` with attempted invocation, harness, failure reason, timestamp, and fallback checklist result, then perform the same checklist inline as degraded execution.",
    "Resolve, defer with rationale, or get explicit user risk acceptance for each concern. Fix blockers and re-review, or record explicit user override.",
    "Wait for explicit user accept before recording `spec.accepted`.",
    "After accept, run `ff internal accept-spec --task <task-id> --verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override]`. If advisor was unavailable, omit `--verdict` and run `ff internal accept-spec --task <task-id> --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>`. It auto-binds the latest proposal identity and appends `advisor.reviewed`|`advisor.unavailable` + `spec.accepted(explicit:true)`. Then run `ff internal validate-clarify --task <task-id> --stage advance` before moving to plan.",
    "spec.md is written at propose time and bound by `proposal_hash`; do not edit it between propose and accept. The clarify gate validates trace events, not the spec.md file directly.",
    "Capture confirmed long-term project facts as task-local baseline candidates; do not update Project Baseline files during clarify.",
    "Run `ff internal set-state --task <task-id> --phase plan --next-action <text>` when the spec is accepted.",
    "If required information is missing, run `ff internal set-state --task <task-id> --lifecycle blocked --phase clarify --blocked-reason <reason> --next-action <text>`."
  ],
  "ff-plan": [
    "Run `ff preflight --action plan --task <task-id>`.",
    "Read spec.md and relevant project baseline files.",
    "Apply the spec quality gate described below.",
    "If the spec quality gate fails, return to ff-clarify behavior with one concrete next question.",
    "Edit plan.md with the implementation approach, key decisions, risks, and validation strategy.",
    "Edit task.md with executable implementation, verification, and check items.",
    "Capture stable design, workflow, command, or rule candidates in task-local artifacts when planning discovers reusable project facts.",
    "Run a post-plan artifact cross-review of spec.md, plan.md, and task.md before moving to run.",
    "Run `ff internal set-state --task <task-id> --phase run --next-action <text>`."
  ],
  "ff-run": [
    "Run `ff preflight --action run --task <task-id>`.",
    "Read spec.md, plan.md, task.md, and relevant code.",
    "Implement the next unchecked task.md items against the accepted spec.md and plan.md contract.",
    "Stop for user confirmation when work reveals requirement drift, plan contradiction, or product behavior outside scope.",
    "Add or update tests by default for behavior, workflow semantics, CLI/API behavior, state transitions, parsing, validation, and error handling.",
    "For simple file creation or replacement tasks, the executable shim may be called with `ff-run --task <task-id> --write-file <path> --content <text>`.",
    "Update task.md checklist progress.",
    "Record material progress with `ff internal append-trace --task <task-id> --type run.updated --summary <summary>`.",
    "Run `ff internal ensure-baseline-delta --task <task-id>` when stable reusable project facts are discovered.",
    "Run `ff internal set-state --task <task-id> --phase check --next-action <text>` when implementation items are complete enough to verify."
  ],
  "ff-check": [
    "Run `ff preflight --action check --task <task-id>`.",
    "Run the relevant commands from .ff/project/commands.md.",
    "For deterministic verification commands, the executable shim may be called with repeated `ff-check --task <task-id> --command <cmd>` flags and `--baseline-outcome <text>`.",
    "Run artifact alignment review against spec.md, plan.md, and task.md.",
    "Run implementation evidence review against every acceptance criterion.",
    "Fix small local defects when the task contract is unchanged.",
    "If spec drift appears, stop for user confirmation and update spec.md only after confirmation.",
    "Record one Baseline Outcome before finish: baseline-delta.md created or updated, no reusable project facts, or candidate not stable yet.",
    "Update task.md verification and check items.",
    "Append a check trace event with `ff internal append-trace --task <task-id> --type check.passed --summary <summary>` or `check.failed`.",
    "When check passes, run `ff internal set-state --task <task-id> --phase finish --next-action <text>`."
  ],
  "ff-finish": [
    "Run `ff preflight --action finish --task <task-id>`.",
    "Confirm dirty worktree handling when needed.",
    "Review check evidence, unresolved drift flags, dirty worktree handling, baseline decision, and final summary as the closure packet.",
    "If baseline-delta.md exists, prepare a current-state candidate diff for .ff/project files and merge it by default; stop only when the user chooses selected, edited, or skipped, or when the merge is high-impact or ambiguous.",
    "Run `ff internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped` when applicable; pass `--selected-files` or `--edited-content` only for selected or edited handling.",
    "Run `ff internal finish-task --task <task-id> --summary <summary> --dirty-worktree <covered|unrelated|clean> --baseline <accepted|selected|edited|skipped|none>`.",
    "Report the closed task id and any project baseline files updated."
  ],
  "ff-resume": [
    "Run `ff preflight --action resume --task <task-id>`.",
    "Read resume.md together with task.json, trace.jsonl, spec.md, plan.md, and task.md.",
    "Continue from the task artifacts, using resume.md only as a pointer.",
    "Let the workflow kernel consume resume.md automatically after a later workflow action records progress."
  ],
  "ff-discard": [
    "Run `ff preflight --action discard --task <task-id>`.",
    "Inspect Git status and explain whether changes will be kept, stashed, reverted, or an isolated worktree will be deleted.",
    "Ask for explicit confirmation.",
    "Run `ff internal discard-task --task <task-id> --confirm --worktree <keep|stash|revert|delete-worktree|none>`."
  ],
  "ff-doctor": [
    "Run `ff doctor`.",
    "Report issues first, then warnings.",
    "For malformed or missing files, recommend the smallest repair.",
    "Do not change project baseline or task artifacts unless the user asks for repair."
  ],
  "ff-understand": [
    "Run `ff preflight --action understand`.",
    "Inspect repository structure, package files, commands, and existing docs.",
    "Draft candidate updates for .ff/project/overview.md, architecture.md, rules.md, and commands.md.",
    "Ask the user what to merge before editing project baseline files.",
    "After accepted edits, run `ff internal append-trace --task <task-id> --type baseline.updated --summary <summary>` only if this is tied to a task."
  ]
};

const commandGuidance: Partial<Record<(typeof AGENT_COMMANDS)[number], string[]>> = {
  "ff-work": [
    "`ff-work` is the routine progress command. Repeated `/ff-work` calls should be enough to advance ordinary work through clarify, plan, run, and check.",
    "The executable `work` helper creates or selects the task and returns actionable status. The generated skill performs the judgment-heavy orchestration: questioning, planning, code edits, verification, and review.",
    "Use task truth to choose the next responsibility: clarify means challenge and accept the task contract, plan means create or repair plan.md and task.md, run means execute unchecked implementation items, check means verify and review evidence, and finish means stop before closure.",
    "When delegation is available, route bounded phase work to the matching role agent: `ff-advisor` for clarify review, `ff-planner` for planning, `ff-implementer` for independent implementation slices, `ff-checker` for verification, `ff-reviewer` for broad review, and `ff-baseline-writer` for baseline merge drafts.",
    "Delegation may help only when the harness, tools, and user or environment permission allow it; otherwise route phases and perform the same responsibilities inline.",
    "Do not close tasks from `ff-work`. When the task is ready for finish, summarize the closure readiness and ask whether to run `ff-finish`.",
    "If the phase, artifacts, or user request conflict, stop and resolve the conflict through the matching phase guidance before making code changes."
  ],
  "ff-clarify": [
    "Clarify uses one fixed sequence for all tasks: Brainstorm Pass -> Grill Loop -> Proposed Spec (write spec.md + `propose-spec`) -> advisor review of the current Proposed Spec -> concern/blocker handling -> explicit accept (`accept-spec`) -> `validate-clarify --stage advance` -> move to plan. The required trace events (`brainstorm.done`, `spec.proposed`, `advisor.reviewed`|`advisor.unavailable`, `spec.accepted`) share one identity triple (`attempt_id`, `proposal_id`, `proposal_hash` where `proposal_hash = sha256(spec content)`); `propose-spec` and `accept-spec` compute and thread this identity so the agent never hand-hashes or hand-threads field names.",
    "Brainstorm Pass must restate the goal and motivation, offer at most three directions, recommend the smallest path, list assumptions, risks, acceptance evidence, and produce Open Decisions.",
    "Grill Loop asks one concrete question at a time for Open Decisions and high-risk assumptions. Include your recommended answer and the trade-off so the user can make a concrete decision.",
    "Use the full Grill Loop when the request is broad, ambiguous, high risk, or affects workflow semantics, CLI/API behavior, task lifecycle, state machines, cross-module behavior, irreversible work, or baseline promotion.",
    "Clarification is complete only when the goal, boundary, acceptance criteria, key risks, and important trade-offs are clear enough to write spec.md without high-risk assumptions.",
    "Before asking for acceptance, present a Proposed Spec using the existing sections: Goal, Scope, Non-goals, Constraints, Decisions, and Acceptance Criteria. Continue asking if any high-risk assumption remains.",
    "Advisor review must target the current Proposed Spec identity. Old advisor review cannot be reused for a new proposal.",
    "Advisor unavailable is degraded execution. Record the attempted invocation, harness, failure reason, timestamp, and fallback checklist result before continuing inline.",
    "Concern handling must be explicit: resolve it, defer it with rationale, or get user risk acceptance. Blocker handling requires a revised review or explicit user override.",
    "Do not create clarify.md. spec.md is the only long-lived clarify artifact.",
    "Clarify terminology lightly. Task-local terms belong in spec.md; stable reusable project concepts may become baseline-delta.md candidates.",
    "Project Baseline files are not updated during clarify. Confirmed long-term facts should be captured as task-local candidates for later Baseline Outcome handling.",
    "For generated workflow guidance changes, challenge likely agent behavior directly: would this wording let an agent skip challenge, skip grill, move to plan/run too early, misuse subagents, or accept vague evidence?"
  ],
  "ff-plan": [
    "The spec quality gate checks that Goal is concrete, Scope bounds the work, Acceptance Criteria are checkable, and Decisions cover product trade-offs that affect implementation.",
    "Do not modify spec.md during planning. If the gate fails, block the task in clarify phase and provide one concrete next question in the blocked reason or next action.",
    "Plan from the accepted contract. Implementation choices may be recorded in plan.md only when they stay inside the confirmed spec.",
    "Capture stable design, workflow, command, or rule candidates when they are reusable project facts; keep one-off implementation steps out of baseline candidates.",
    "Break task.md implementation items into small, verifiable vertical slices. Keep file-level edits as implementation details, not primary checklist items.",
    "When delegation is available, ask `ff-planner` to draft plan.md and task.md from the accepted spec, then ask `ff-reviewer` to run the post-plan artifact cross-review. The main session resolves drift and moves phase.",
    "Post-plan artifact cross-review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work. Use `ff-reviewer` only when the harness, tools, and user or environment permission allow delegation; otherwise run the same check inline.",
    "For generated workflow guidance changes, include behavior-review checks in task.md. Look for skipped challenge, skipped grill, unclear delegation permission, premature phase movement, and acceptance criteria without evidence.",
    "Keep deterministic tests separate from behavior review. Tests should verify generated output, while check-stage review evaluates likely agent behavior."
  ],
  "ff-run": [
    "Run executes the accepted task contract. Do not expand product behavior or implementation scope beyond spec.md and plan.md without user confirmation.",
    "Behavior changes require test evidence by default. Use red-green TDD when a clear public seam exists; use commands, fixtures, snapshots, file checks, or manual review when those are the right evidence.",
    "Use `ff-implementer` for independent vertical slices only when the harness, tools, and user or environment permission allow delegation; otherwise implement the same checklist items inline.",
    "Delegated implementers may write code and update checklist progress, but they must not close tasks or decide requirement drift.",
    "Domain modeling is optional. Use it only when terms or stable reusable project concepts change; otherwise record task-local terms in spec.md or task.md.",
    "External TDD, domain modeling, implement, Superpowers, or subagent skills may help when installed, but this generated guidance is sufficient to proceed without them."
  ],
  "ff-check": [
    "Artifact alignment review checks spec.md, plan.md, and task.md for contradiction, missing coverage, overbuilding, unclear interfaces, and placeholder work.",
    "Implementation evidence review maps every acceptance criterion to evidence in task.md Verification or Check entries. Evidence can be tests, commands, file checks, CI/CD or test-environment notes, or manual verification.",
    "CI/CD or test-environment evidence states environment, action, and result without relying on commit identity.",
    "Small local defects may be fixed during check when the accepted spec.md contract is unchanged. Changes to spec.md or out-of-scope implementation behavior return to clarify for user confirmation.",
    "Check owns the final Baseline Outcome. Update baseline-delta.md for stable reusable facts, or record that there are no reusable project facts or that candidates are not stable yet.",
    "Use `ff-checker` to run verification, record evidence, and repair small in-scope defects when delegation is available.",
    "Use `ff-reviewer` for broad, behaviorally large, or workflow-semantics changes only when the harness, tools, and user or environment permission allow delegation; otherwise perform the same artifact and evidence review inline.",
    "Run a final broad review when the change is cross-cutting, behaviorally large, or touches workflow semantics shared by multiple commands."
  ],
  "ff-finish": [
    "Finish closes the Flowflow task. It does not create commits, require one final commit, push branches, open PRs, deploy, clean up branches, or record a commit ledger.",
    "The closure packet covers check evidence, unresolved drift, dirty worktree handling, baseline decision, and final summary.",
    "Project Baseline files are current-state descriptions. If baseline-delta.md exists, the finish-stage agent prepares a candidate diff that integrates the delta into existing .ff/project files.",
    "Use `ff-baseline-writer` to draft the candidate baseline merge when delegation is available and baseline-delta.md is ordinary enough to merge. The main session must review the draft before running sync helpers.",
    "A fast inexpensive model may help draft the candidate baseline diff when available. The generated skill must support inline preparation, and the CLI core must not call an LLM.",
    "The default baseline decision is accepted: finish applies all merged baseline sections. If the user chooses selected, apply only named baseline files. If the user chooses edited, apply the user's replacement current-state sections. If the user chooses skipped, record no Project Baseline change.",
    "Apply the default merge without asking for a baseline decision again when the delta is ordinary and unambiguous; ask before high-impact, ambiguous, selected, edited, or skipped handling."
  ],
  "ff-resume": [
    "Resume is user-triggered continuation. Read resume.md after task.json, trace.jsonl, spec.md, plan.md, and task.md; task artifacts remain the task truth and resume.md is only a pointer.",
    "If the task is parked, resume may return it to open lifecycle for continuation while preserving the current phase and next action.",
    "Do not consume resume.md while loading resume context. The workflow kernel consumes it automatically after a later workflow action records material progress.",
    "If resume.md conflicts with task artifacts, trust the task artifacts and stop for user confirmation before changing spec.md, plan.md, or task.md.",
    "Report the loaded resume path, whether it was consumed, and the next action the agent should take."
  ],
  "ff-doctor": [
    "Doctor is repository-level diagnosis. It reports validation issues, hygiene warnings, generated adapter drift, and enhancement status.",
    "Report issues before warnings. For each item, include the file path or state field, the observed problem, and the smallest repair.",
    "Treat issues as invalid repository state and warnings as workflow hygiene risk; do not blur the two categories.",
    "Doctor is read-only by default. If the user asks for repair, make the smallest scoped change and use normal confirmation rules for task artifacts or Project Baseline files.",
    "Do not use doctor as the action-local gate; preflight owns action-local checks."
  ],
  "ff-understand": [
    "Understand is draft-first repository observation. Write candidates to .ff/understand-draft/ and never overwrite .ff/project/* automatically.",
    "Separate observed facts from inferences. Observed facts include files, package scripts, config, docs, dependencies, and existing .ff/project content; uncertain inferences should say Review required.",
    "Read the current Project Baseline before proposing a merge, and preserve user-authored current-state content unless the user accepts a replacement.",
    "Ask which drafted sections to merge. Merge only accepted content, and record a baseline.updated trace event only when the understand work is tied to a task.",
    "Do not promote task-local plans, aspirations, or one-off implementation details into Project Baseline."
  ]
};

type CommandProtocolSection = {
  title: string;
  items: string[];
};

const commandProtocolSections: Partial<Record<(typeof AGENT_COMMANDS)[number], CommandProtocolSection[]>> = {
  "ff-clarify": [
    {
      title: "Brainstorm Pass",
      items: [
        "Purpose: clarify the user's desired outcome before drafting a Proposed Spec. Restate the goal and motivation in concrete terms.",
        "Required output: present at most three viable directions, recommend the smallest sufficient path, and list assumptions, risks, and acceptance evidence for that path.",
        "Open Decisions: produce a short list of unresolved product, workflow, risk, or evidence decisions that would materially change the task contract.",
        "Do not write spec.md during Brainstorm Pass. Move forward only to the Grill Loop or, when no Open Decisions or high-risk assumptions remain, to Proposed Spec."
      ]
    },
    {
      title: "Grill Loop",
      items: [
        "Input: use the Brainstorm Pass Open Decisions and any high-risk assumptions found in the request, baseline, or current task artifacts.",
        "Ask one concrete question at a time. Include your recommended answer and the trade-off so the user can choose or correct the path.",
        "Escalate to the full loop for broad, ambiguous, high-risk, irreversible, workflow-semantics, CLI/API, task-lifecycle, state-machine, cross-module, or baseline-promotion decisions.",
        "Stop only when the goal, boundary, acceptance criteria, key risks, and important trade-offs are clear enough to write spec.md without high-risk assumptions, or when the user explicitly accepts the remaining risk.",
        "Keep Brainstorm Pass and Grill Loop inside this ff-clarify guidance; do not rely on another skill or cross-skill lookup for these protocol stages."
      ]
    }
  ]
};

const executionStrategyCommands = new Set<(typeof AGENT_COMMANDS)[number]>([
  "ff-work",
  "ff-plan",
  "ff-run",
  "ff-check",
  "ff-finish"
]);

type RoleAgentDefinition = {
  role: AgentRoleName;
  purpose: string;
  useWhen: string[];
  responsibilities: string[];
  boundaries: string[];
  report: string[];
  writeAccess: "read-only" | "task-artifacts" | "code-and-task" | "baseline-draft";
};
type ResolvedRoleModelProfile = RoleModelProfile & {
  temperature: number | null;
};
type ProtectedConfigMap = Map<string, string>;

const roleAgentDefinitions: Record<AgentRoleName, RoleAgentDefinition> = {
  advisor: {
    role: "advisor",
    purpose: "Read-only skeptical reviewer for Flowflow workflow turns, specs, plans, diffs, and closure packets.",
    useWhen: [
      "Default-enabled advisor mode is active in .ff/orchestration.json and the harness can run a watcher or peer agent.",
      "Manual or gate mode asks for an independent challenge pass before accepting specs, plans, implementation, or finish readiness.",
      "During ff-clarify, review the current Proposed Spec before the primary session asks for acceptance or edits spec.md."
    ],
    responsibilities: [
      "Watch bounded primary-session deltas plus task artifacts, similar to OMP advisor behavior.",
      "Emit concise advisory feedback with severity nit, concern, or blocker.",
      "Challenge missing motivation, vague acceptance criteria, skipped verification, unsafe worktree handling, and spec drift.",
      "For ff-clarify, bind feedback to the current attempt_id, proposal_id, or proposal hash so old review cannot approve a new proposal.",
      "Deduplicate advice and stay within sync_backlog from .ff/orchestration.json."
    ],
    boundaries: [
      "Do not ask the user directly.",
      "Do not edit files, accept a spec, move task phase, or close a task.",
      "Do not expand product scope; route unresolved decisions back to the primary session.",
      "Blocker severity means the primary session must stop and resolve the issue before continuing."
    ],
    report: [
      "severity: nit | concern | blocker",
      "target: spec | plan | task | code | verification | finish",
      "finding: one concrete issue",
      "recommended_action: one smallest next action"
    ],
    writeAccess: "read-only"
  },
  planner: {
    role: "planner",
    purpose: "Turn an accepted spec.md into plan.md and executable task.md without changing the spec.",
    useWhen: ["The current task phase is plan.", "A post-plan cross-review finds missing coverage or contradiction."],
    responsibilities: [
      "Apply the spec quality gate.",
      "Create a scoped implementation approach and verification strategy.",
      "Break task.md into small checklist items that can be independently verified.",
      "Record open risks in plan.md without inventing new product behavior."
    ],
    boundaries: [
      "Do not edit spec.md.",
      "Do not move to run until spec.md, plan.md, and task.md are aligned.",
      "Return to clarify when a required decision is missing."
    ],
    report: ["summary of planned approach", "task checklist coverage", "risks or blocked questions", "recommended next phase"],
    writeAccess: "task-artifacts"
  },
  implementer: {
    role: "implementer",
    purpose: "Execute task.md implementation checklist items against the accepted spec and plan.",
    useWhen: ["The current task phase is run.", "A vertical implementation slice is independent enough for delegation."],
    responsibilities: [
      "Read spec.md, plan.md, task.md, relevant Project Baseline, and necessary code.",
      "Modify code and tests within the accepted task contract.",
      "Update task.md progress for completed implementation items.",
      "Append material progress through Flowflow helpers when delegated tooling permits it."
    ],
    boundaries: [
      "Do not decide requirement drift.",
      "Do not close tasks or perform finish behavior.",
      "Stop and report when implementation requires product behavior outside spec.md."
    ],
    report: ["files changed", "checklist items completed", "tests added or updated", "risks or user decisions needed"],
    writeAccess: "code-and-task"
  },
  reviewer: {
    role: "reviewer",
    purpose: "Independent review for artifact alignment, implementation evidence, regressions, and missing tests.",
    useWhen: ["A plan or implementation touches shared workflow semantics.", "ff-check needs a broad final review."],
    responsibilities: [
      "Map every acceptance criterion to evidence.",
      "Inspect spec.md, plan.md, task.md, and relevant code for contradiction or overbuild.",
      "Prioritize bugs, regressions, and missing verification.",
      "Separate findings from style preferences."
    ],
    boundaries: [
      "Do not rewrite the task contract.",
      "Do not close tasks.",
      "Small in-scope fixes may be proposed; out-of-scope changes return to the primary session."
    ],
    report: ["findings ordered by severity", "acceptance criteria coverage", "test gaps", "residual risk"],
    writeAccess: "read-only"
  },
  checker: {
    role: "checker",
    purpose: "Run verification, repair small in-scope defects, and prepare check evidence for the primary session.",
    useWhen: ["The current task phase is check.", "Verification evidence is missing or stale."],
    responsibilities: [
      "Run relevant commands from .ff/project/commands.md.",
      "Record verification evidence in task.md.",
      "Fix small local defects when the accepted spec is unchanged.",
      "Report spec drift or behavior changes instead of resolving them silently."
    ],
    boundaries: [
      "Do not accept unresolved drift.",
      "Do not sync Project Baseline or close tasks.",
      "Do not treat external memory as Repo Truth."
    ],
    report: ["commands run", "result", "task.md evidence updated", "defects fixed or unresolved blockers"],
    writeAccess: "code-and-task"
  },
  "baseline-writer": {
    role: "baseline-writer",
    purpose: "Draft current-state Project Baseline updates from an accepted baseline-delta.md.",
    useWhen: ["ff-finish has a baseline delta and the user has chosen accepted, selected, or edited baseline handling."],
    responsibilities: [
      "Read existing .ff/project files before drafting.",
      "Integrate accepted facts as current-state documentation.",
      "Preserve user-authored baseline content unless the accepted delta supersedes it.",
      "Keep task-local details out of Project Baseline."
    ],
    boundaries: [
      "Do not apply baseline changes without user confirmation.",
      "Do not invent architecture facts from plans or aspirations.",
      "Do not close tasks."
    ],
    report: ["candidate baseline sections", "source delta coverage", "content intentionally left out", "confirmation needed"],
    writeAccess: "baseline-draft"
  }
};

export async function generateAdapter(
  root: string,
  harness: HarnessName,
  options: AdapterOptions = {}
): Promise<AdapterResult> {
  if (harness === "codex") {
    return generateAgentSkillAdapter(root, harness, options);
  }
  if (harness === "claude") {
    return generateClaudeAdapter(root, options);
  }
  if (harness === "opencode") {
    return generateAgentSkillAdapter(root, harness, options);
  }
  if (harness === "pi") {
    return generateAgentSkillAdapter(root, harness, options);
  }
  if (harness === "cursor") {
    return generateAgentSkillAdapter(root, harness, options);
  }
  throw new Error(`unsupported harness: ${harness satisfies never}`);
}

async function generateAgentSkillAdapter(
  root: string,
  harness: HarnessName,
  options: AdapterOptions
): Promise<AdapterResult> {
  const result: AdapterResult = { harness, created: [], existing: [] };
  const skillsRoot = path.join(root, ".agents", "skills");
  await ensureDir(skillsRoot);
  await assertNoProtectedRoleAgentConfigConflicts(root, harness, options);

  for (const command of AGENT_COMMANDS) {
    const skillDir = path.join(skillsRoot, command);
    await ensureDir(skillDir);
    await writeGenerated(root, path.join(skillDir, "SKILL.md"), renderHarnessSkill(command, harness), options, result);
  }

  await generateRoleAgents(root, harness, options, result);
  await generateWatchdogArtifacts(root, harness, options, result);

  return result;
}

async function generateClaudeAdapter(root: string, options: AdapterOptions): Promise<AdapterResult> {
  const result: AdapterResult = { harness: "claude", created: [], existing: [] };
  const skillsRoot = path.join(root, ".claude", "skills");
  await ensureDir(skillsRoot);
  await assertNoProtectedRoleAgentConfigConflicts(root, "claude", options);

  for (const command of AGENT_COMMANDS) {
    const skillDir = path.join(skillsRoot, command);
    await ensureDir(skillDir);
    await writeGenerated(root, path.join(skillDir, "SKILL.md"), renderHarnessSkill(command, "claude"), options, result);
  }

  await generateRoleAgents(root, "claude", options, result);
  await generateWatchdogArtifacts(root, "claude", options, result);

  return result;
}

async function generateRoleAgents(
  root: string,
  harness: HarnessName,
  options: AdapterOptions,
  result: AdapterResult
): Promise<void> {
  const roleRoot = path.join(root, roleAgentRoot(harness));
  await ensureDir(roleRoot);

  for (const expected of await expectedGeneratedRoleAgentsForRoot(root, harness)) {
    await writeGenerated(root, path.join(root, expected.path), expected.content, options, result);
  }
}

async function generateWatchdogArtifacts(
  root: string,
  harness: HarnessName,
  options: AdapterOptions,
  result: AdapterResult
): Promise<void> {
  for (const expected of expectedGeneratedWatchdogArtifacts(harness)) {
    await ensureDir(path.dirname(path.join(root, expected.path)));
    await writeGenerated(root, path.join(root, expected.path), expected.content, options, result);
  }
}

export function expectedGeneratedWatchdogArtifactsForRoot(
  _root: string,
  harness: HarnessName
): Array<{ path: string; content: string }> {
  return expectedGeneratedWatchdogArtifacts(harness);
}

export function expectedGeneratedWatchdogArtifacts(harness: HarnessName): Array<{ path: string; content: string }> {
  return [
    {
      path: watchdogArtifactPath(harness),
      content: renderWatchdogArtifact(harness)
    }
  ];
}

export async function expectedGeneratedRoleAgentsForRoot(root: string, harness: HarnessName): Promise<Array<{ path: string; content: string }>> {
  return expectedGeneratedRoleAgents(harness, await readOrchestrationConfig(root));
}

export function expectedGeneratedRoleAgents(
  harness: HarnessName,
  orchestration: OrchestrationConfigRecord | null = null
): Array<{ role: AgentRoleName; path: string; content: string }> {
  const rootPath = roleAgentRoot(harness);
  return AGENT_ROLE_NAMES.map((role) => {
    const fileName = harness === "codex" ? `${roleAgentName(role)}.toml` : `${roleAgentName(role)}.md`;
    const profile = resolvedRoleProfile(orchestration, harness, role);
    return {
      role,
      path: path.join(rootPath, fileName),
      content: renderRoleAgent(roleAgentDefinitions[role], harness, profile)
    };
  });
}

function roleAgentRoot(harness: HarnessName): string {
  if (harness === "claude") {
    return ".claude/agents";
  }
  if (harness === "codex") {
    return ".codex/agents";
  }
  if (harness === "opencode") {
    return ".opencode/agents";
  }
  if (harness === "cursor") {
    return ".cursor/agents";
  }
  return ".pi/agents";
}

function watchdogArtifactPath(harness: HarnessName): string {
  if (harness === "codex") {
    return ".codex/hooks.json";
  }
  if (harness === "claude") {
    return ".claude/settings.json";
  }
  if (harness === "opencode") {
    return ".opencode/plugins/ff-clarify-watchdog.ts";
  }
  if (harness === "cursor") {
    return ".cursor/hooks.json";
  }
  return ".pi/extensions/ff-clarify-watchdog.ts";
}

function renderWatchdogArtifact(harness: HarnessName): string {
  const command = "ff internal validate-clarify --watchdog";
  if (harness === "codex") {
    return `${JSON.stringify({
      hooks: {
        Stop: [
          {
            type: "command",
            command
          }
        ]
      }
    }, null, 2)}\n`;
  }
  if (harness === "claude") {
    return `${JSON.stringify({
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command
              }
            ]
          }
        ],
        SubagentStop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command
              }
            ]
          }
        ]
      }
    }, null, 2)}\n`;
  }
  if (harness === "cursor") {
    return `${JSON.stringify({
      version: 1,
      hooks: {
        stop: [
          {
            command
          }
        ],
        subagentStop: [
          {
            command
          }
        ]
      }
    }, null, 2)}\n`;
  }
  if (harness === "opencode") {
    return `export default async function cwClarifyWatchdog({ $, event }: { $: unknown; event: { type?: string } }) {
  if (event.type !== "session.idle") {
    return;
  }
  const runner = $ as (strings: TemplateStringsArray, ...values: string[]) => Promise<unknown>;
  await runner\`ff internal validate-clarify --watchdog\`;
}
`;
  }
  return `export default function cwClarifyWatchdog(pi: { on: (event: string, handler: () => Promise<void>) => void; $?: (strings: TemplateStringsArray, ...values: string[]) => Promise<unknown> }) {
  pi.on("session_idle", async () => {
    if (pi.$ === undefined) {
      return;
    }
    await pi.$\`ff internal validate-clarify --watchdog\`;
  });
}
`;
}

function renderRoleAgent(definition: RoleAgentDefinition, harness: HarnessName, profile: ResolvedRoleModelProfile): string {
  const body = renderRoleBody(definition, harness, profile);
  if (harness === "codex") {
    return renderCodexRoleAgent(definition, body, profile);
  }
  if (harness === "claude") {
    return renderClaudeRoleAgent(definition, body, profile);
  }
  if (harness === "cursor") {
    return renderCursorRoleAgent(definition, body, profile);
  }
  if (harness === "opencode") {
    return renderOpenCodeRoleAgent(definition, body, profile);
  }
  return renderPiRoleGuidance(definition, body, profile);
}

function renderRoleBody(definition: RoleAgentDefinition, harness: HarnessName, profile: ResolvedRoleModelProfile): string {
  return `# ${roleAgentName(definition.role)}

${definition.purpose}

## Harness

- Platform: ${harnessLabel(harness)}
- Flowflow role: ${definition.role}
- Model profile: ${formatRoleProfile(profile)}
- Configuration: .ff/orchestration.json owns advisor mode, role model profiles, and per-harness model overrides.

## Use When

${definition.useWhen.map((item) => `- ${item}`).join("\n")}

## Responsibilities

${definition.responsibilities.map((item) => `- ${item}`).join("\n")}

## Boundaries

${definition.boundaries.map((item) => `- ${item}`).join("\n")}

## Required Context

- .ff/version.json
- .ff/orchestration.json when present
- Relevant .ff/project files
- Current task files under .ff/tasks/<task-id>/ when a task exists
- Minimal code context needed for the assigned role

## Report Format

${definition.report.map((item) => `- ${item}`).join("\n")}
`;
}

function renderCodexRoleAgent(definition: RoleAgentDefinition, body: string, profile: ResolvedRoleModelProfile): string {
  return `name = ${tomlString(roleAgentName(definition.role))}
description = ${tomlString(definition.purpose)}
${renderCodexModel(profile.model)}${renderCodexReasoningEffort(profile.reasoning_effort)}developer_instructions = ${tomlMultilineString(body)}
`;
}

function renderClaudeRoleAgent(definition: RoleAgentDefinition, body: string, profile: ResolvedRoleModelProfile): string {
  return `---
name: ${roleAgentName(definition.role)}
description: ${definition.purpose}
model: ${frontmatterModel(profile)}
tools: ${claudeTools(definition.writeAccess)}
---

${body}`;
}

function renderCursorRoleAgent(definition: RoleAgentDefinition, body: string, profile: ResolvedRoleModelProfile): string {
  return `---
name: ${roleAgentName(definition.role)}
description: ${definition.purpose}
model: ${frontmatterModel(profile)}
readonly: ${definition.writeAccess === "read-only" ? "true" : "false"}
is_background: false
---

${body}`;
}

function renderOpenCodeRoleAgent(definition: RoleAgentDefinition, body: string, profile: ResolvedRoleModelProfile): string {
  const tools = openCodeTools(definition.writeAccess);
  return `---
description: ${definition.purpose}
mode: subagent
model: ${frontmatterModel(profile)}
${renderOpenCodeTemperature(profile.temperature)}tools:
  write: ${tools.write ? "true" : "false"}
  edit: ${tools.edit ? "true" : "false"}
  bash: ${tools.bash ? "true" : "false"}
---

${body}`;
}

function renderPiRoleGuidance(definition: RoleAgentDefinition, body: string, profile: ResolvedRoleModelProfile): string {
  return `---
name: ${roleAgentName(definition.role)}
description: ${definition.purpose}
capability_tier: ${profile.capability_tier}
model: ${frontmatterModel(profile)}
---

${body}

## Pi Compatibility

Pi subagents discover project agents from .pi/agents. Continue inline when the runtime cannot spawn this role.
`;
}

function renderWorkflowInstructions(command: (typeof AGENT_COMMANDS)[number]): string {
  return `# ${command}

${commandPurposes[command]}

## Required Reading

- .ff/version.json
- .ff/project/overview.md
- .ff/project/architecture.md
- .ff/project/rules.md
- .ff/project/commands.md
- Current task files under .ff/tasks/<task-id>/ when a task exists

## Rules

- Treat .ff task files and project baseline files as repo truth for workflow facts.
- Use Git as the source of truth for code changes.
- Use ff internal helpers for deterministic task state changes and trace events.
- Keep edits scoped to the current workflow action.
- Stop for user judgment when requirements, product behavior, destructive worktree handling, workflow overrides, or baseline promotion need confirmation.
- Inline execution must remain complete; if optional helpers are unavailable, continue inline when responsible.

${renderExecutionStrategyGuidance(command)}## Workflow Steps

${commandSteps[command].map((step, index) => `${index + 1}. ${step}`).join("\n")}${renderCommandGuidance(command)}${renderCommandProtocolSections(command)}

## Helper Commands

- ff validate
- ff doctor
- ff tasks
- ff preflight --action <action> [--task <task-id>]
- ff internal create-task --title <title> [--id <task-id>]
- ff internal select-task [--task <task-id>]
- ff internal append-trace --task <task-id> --type <event-type> --summary <summary>
- ff internal append-trace --task <task-id> --type <event-type> --summary <summary> --data-json <json-object>
- ff internal propose-spec --task <task-id> --spec-file <path>
- ff internal accept-spec --task <task-id> (--verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>)
- ff internal validate-clarify --task <task-id> --stage proposal|accept|advance
- ff internal set-state --task <task-id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]
- ff internal finish-task --task <task-id> --summary <summary> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none] [--edited-content <confirmed-current-state-sections>]
- ff internal discard-task --task <task-id> --confirm --worktree <handling>
- ff internal create-resume --task <task-id> --content <markdown>
- ff internal ensure-baseline-delta --task <task-id>
- ff internal sync-baseline-delta --task <task-id> --decision accepted|selected|edited|skipped [--selected-files <overview.md,architecture.md,rules.md,commands.md>] [--edited-content <confirmed-current-state-sections>]
- ff internal consume-resume --task <task-id>
`;
}

function renderExecutionStrategyGuidance(command: (typeof AGENT_COMMANDS)[number]): string {
  if (!executionStrategyCommands.has(command)) {
    return "";
  }

  return `## Execution Strategy Guidance

- Inline execution is fully supported and must remain complete.
- Use \`.ff/orchestration.json\` and generated \`ff-<role>\` agent files as the role and model contract when delegation is available.
- Explicitly ask the harness to spawn the named \`ff-<role>\` agent for bounded delegated work; Codex only spawns subagents after the main session asks.
- Delegation is optional and permission-bound; continue inline when delegation is unavailable or unauthorized.
- Delegated work receives task artifacts, relevant Project Baseline files, and necessary code context rather than full chat history.
- Delegated agents must not close tasks; closure decisions and unresolved drift return to the main session.
${renderRoleRoutingGuidance(command)}

`;
}

function renderRoleRoutingGuidance(command: (typeof AGENT_COMMANDS)[number]): string {
  const routing: Partial<Record<(typeof AGENT_COMMANDS)[number], string[]>> = {
    "ff-work": [
      "Clarify phase: use `ff-advisor` for Proposed Spec review when advisor mode or risk calls for an independent challenge.",
      "Plan phase: use `ff-planner` for plan.md/task.md drafting and `ff-reviewer` for artifact cross-review.",
      "Run phase: use `ff-implementer` for independent task.md implementation slices.",
      "Check phase: use `ff-checker` for verification and small in-scope repair, then `ff-reviewer` for broad final review when risk warrants it.",
      "Finish phase: use `ff-baseline-writer` only for candidate Project Baseline merge drafts; the main session still owns closure."
    ],
    "ff-plan": [
      "Use `ff-planner` to draft plan.md and task.md from the accepted spec when delegation is available.",
      "Use `ff-reviewer` for post-plan cross-review before moving to run."
    ],
    "ff-run": [
      "Use `ff-implementer` only for bounded, independent implementation slices with a clear file or checklist scope.",
      "Keep requirement drift, scope changes, and phase movement in the main session."
    ],
    "ff-check": [
      "Use `ff-checker` for verification commands, evidence updates, and small in-scope repairs.",
      "Use `ff-reviewer` for artifact alignment, acceptance-criteria coverage, regressions, and missing tests."
    ],
    "ff-finish": [
      "Use `ff-baseline-writer` to draft current-state Project Baseline updates from accepted baseline-delta.md.",
      "Keep dirty worktree decisions, baseline promotion choices, and task closure in the main session."
    ]
  };
  const items = routing[command] ?? [];
  if (items.length === 0) {
    return "";
  }
  return `
Role routing for this command:

${items.map((item) => `- ${item}`).join("\n")}`;
}

function renderCommandGuidance(command: (typeof AGENT_COMMANDS)[number]): string {
  const guidance = commandGuidance[command];
  if (guidance === undefined || guidance.length === 0) {
    return "";
  }
  return `

## Phase Guidance

${guidance.map((item) => `- ${item}`).join("\n")}
`;
}

function renderCommandProtocolSections(command: (typeof AGENT_COMMANDS)[number]): string {
  const sections = commandProtocolSections[command];
  if (sections === undefined || sections.length === 0) {
    return "";
  }
  return `
## Clarify Protocol

${sections.map((section) => `### ${section.title}\n\n${section.items.map((item) => `- ${item}`).join("\n")}`).join("\n\n")}
`;
}

function renderHarnessSkill(command: (typeof AGENT_COMMANDS)[number], _harness: HarnessName): string {
  return `---
name: ${command}
description: ${commandPurposes[command]}
---

Use this skill for the \`${command}\` Flowflow workflow action in this repository. Trigger it for \`/${command}\`, \`$${command}\`, \`${workflowCliCommand(command)}\`, or natural-language requests for the same workflow action.

Before acting, read the repository's \`.ff\` files relevant to the current task. Treat \`.ff\` as Repo Truth, generated skills as invocation surfaces, and Git as the source of truth for code changes.

${renderWorkflowInstructions(command)}
`.replace(/\n+$/, "\n");
}

function workflowCliCommand(command: (typeof AGENT_COMMANDS)[number]): string {
  return command.replace(/^ff-/, "ff ");
}

export function isGeneratedSkillCurrent(
  command: (typeof AGENT_COMMANDS)[number],
  content: string,
  skillsPath: ".agents/skills" | ".claude/skills"
): boolean {
  const harnesses: HarnessName[] = skillsPath === ".claude/skills" ? ["claude"] : ["codex", "opencode", "pi", "cursor"];
  return harnesses.some((harness) => content === renderHarnessSkill(command, harness));
}

async function assertNoProtectedRoleAgentConfigConflicts(
  root: string,
  harness: HarnessName,
  options: AdapterOptions
): Promise<void> {
  if (options.overwrite !== true || options.force === true) {
    return;
  }

  const orchestration = await readOrchestrationConfig(root);
  const conflicts: ProtectedRoleAgentConfigConflict[] = [];
  for (const expected of expectedGeneratedRoleAgents(harness, orchestration)) {
    const filePath = path.join(root, expected.path);
    const existing = await readFileIfPresent(filePath);
    if (existing === null) {
      continue;
    }
    const fields = protectedRoleAgentConfigDiffFields(
      harness,
      expected.role,
      existing,
      expected.content,
      explicitProtectedConfigFields(orchestration, harness, expected.role)
    );
    if (fields.length > 0) {
      conflicts.push({ path: expected.path, fields });
    }
  }

  if (conflicts.length > 0) {
    throw new ProtectedRoleAgentConfigConflictError(conflicts);
  }
}

async function readFileIfPresent(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function protectedRoleAgentConfigDiffFields(
  harness: HarnessName,
  role: AgentRoleName,
  existingContent: string,
  expectedContent: string,
  explicitlyOwnedFields: Set<string>
): string[] {
  const existing = protectedConfigFields(harness, existingContent);
  const expected = protectedConfigFields(harness, expectedContent);
  const fields: string[] = [];

  for (const [field, existingValue] of existing) {
    if (explicitlyOwnedFields.has(field)) {
      continue;
    }
    const expectedValue = expected.get(field);
    if (existingValue !== expectedValue) {
      fields.push(field);
    }
  }

  return fields.sort((left, right) => left.localeCompare(right));
}

function protectedConfigFields(harness: HarnessName, content: string): ProtectedConfigMap {
  return harness === "codex" ? protectedCodexConfigFields(content) : protectedFrontmatterConfigFields(content);
}

function protectedCodexConfigFields(content: string): ProtectedConfigMap {
  const fields: ProtectedConfigMap = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(model|model_reasoning_effort)\s*=\s*(.+?)\s*$/);
    if (match !== null) {
      fields.set(match[1], normalizeConfigValue(match[2]));
    }
  }
  return fields;
}

function protectedFrontmatterConfigFields(content: string): ProtectedConfigMap {
  const fields: ProtectedConfigMap = new Map();
  if (!content.startsWith("---\n")) {
    return fields;
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    return fields;
  }

  let currentObjectKey: string | null = null;
  for (const line of content.slice(4, end).split(/\r?\n/)) {
    const nested = line.match(/^\s+([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (nested !== null && currentObjectKey === "tools") {
      fields.set(`tools.${nested[1]}`, normalizeConfigValue(nested[2]));
      continue;
    }

    const topLevel = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (topLevel === null) {
      continue;
    }

    const key = topLevel[1];
    const value = topLevel[2];
    currentObjectKey = value.trim().length === 0 ? key : null;
    if (isProtectedFrontmatterField(key) && value.trim().length > 0) {
      fields.set(key, normalizeConfigValue(value));
    }
  }

  return fields;
}

function isProtectedFrontmatterField(key: string): boolean {
  return key === "model" ||
    key === "temperature" ||
    key === "tools" ||
    key === "readonly" ||
    key === "is_background" ||
    key === "capability_tier";
}

function normalizeConfigValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function explicitProtectedConfigFields(
  orchestration: OrchestrationConfigRecord | null,
  harness: HarnessName,
  role: AgentRoleName
): Set<string> {
  const fields = new Set<string>();
  const roleProfileOverride = orchestration?.roles?.[role];
  const harnessOverride = orchestration?.harness_overrides?.[harness]?.[role];
  const base = DEFAULT_ROLE_MODEL_PROFILES[role];

  if (roleProfileOverride !== undefined) {
    if (roleProfileOverride.model !== base.model) {
      fields.add("model");
    }
    if (roleProfileOverride.reasoning_effort !== base.reasoning_effort) {
      fields.add("model_reasoning_effort");
    }
    if ((roleProfileOverride.temperature ?? null) !== (base.temperature ?? null)) {
      fields.add("temperature");
    }
    if (roleProfileOverride.capability_tier !== base.capability_tier) {
      fields.add("capability_tier");
    }
  }

  if (harnessOverride !== undefined) {
    if ("model" in harnessOverride) {
      fields.add("model");
    }
    if ("reasoning_effort" in harnessOverride) {
      fields.add("model_reasoning_effort");
    }
    if ("temperature" in harnessOverride) {
      fields.add("temperature");
    }
  }

  return fields;
}

function formatProtectedRoleAgentConfigConflictMessage(conflicts: ProtectedRoleAgentConfigConflict[]): string {
  const files = conflicts
    .map((conflict) => `- ${conflict.path}: ${conflict.fields.join(", ")}`)
    .join("\n");
  return [
    "ff update refused to overwrite user-edited role agent configuration.",
    files,
    "Move durable role model configuration to .ff/orchestration.json, then rerun ff update.",
    "To intentionally overwrite these generated role agent files from .ff/orchestration.json, rerun ff update --force."
  ].join("\n");
}

function roleProfile(role: AgentRoleName): RoleModelProfile {
  return DEFAULT_ROLE_MODEL_PROFILES[role];
}

async function readOrchestrationConfig(root: string): Promise<OrchestrationConfigRecord | null> {
  try {
    return await readJsonFile<OrchestrationConfigRecord>(getFlowflowPaths(root).orchestration);
  } catch {
    return null;
  }
}

function resolvedRoleProfile(
  orchestration: OrchestrationConfigRecord | null,
  harness: HarnessName,
  role: AgentRoleName
): ResolvedRoleModelProfile {
  const base = roleProfile(role);
  const roleProfileOverride = orchestration?.roles?.[role];
  const harnessOverride = orchestration?.harness_overrides?.[harness]?.[role];
  return {
    capability_tier: roleProfileOverride?.capability_tier ?? base.capability_tier,
    model: overrideValue(harnessOverride, "model", roleProfileOverride?.model ?? base.model),
    reasoning_effort: overrideValue(
      harnessOverride,
      "reasoning_effort",
      roleProfileOverride?.reasoning_effort ?? base.reasoning_effort
    ),
    temperature: overrideValue(
      harnessOverride,
      "temperature",
      roleProfileOverride?.temperature ?? base.temperature ?? null
    ),
    notes: roleProfileOverride?.notes ?? base.notes
  };
}

function overrideValue<K extends keyof HarnessRoleModelOverride>(
  override: HarnessRoleModelOverride | undefined,
  key: K,
  inherited: NonNullable<HarnessRoleModelOverride[K]> | null
): NonNullable<HarnessRoleModelOverride[K]> | null {
  if (override !== undefined && key in override) {
    return override[key] ?? null;
  }
  return inherited;
}

function formatRoleProfile(profile: RoleModelProfile): string {
  const reasoning = profile.reasoning_effort === null ? "default reasoning" : `${profile.reasoning_effort} reasoning`;
  const model = profile.model === null ? "platform default model" : profile.model;
  const temperature = profile.temperature === undefined || profile.temperature === null ? "" : `, temperature ${profile.temperature}`;
  return `${profile.capability_tier}, ${reasoning}, ${model}${temperature}`;
}

function renderCodexReasoningEffort(reasoningEffort: ModelReasoningEffort | null): string {
  return reasoningEffort === null ? "" : `model_reasoning_effort = ${tomlString(reasoningEffort)}\n`;
}

function renderCodexModel(model: string | null): string {
  return model === null ? "" : `model = ${tomlString(model)}\n`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlMultilineString(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');
  return `"""\n${escaped}\n"""`;
}

function frontmatterModel(profile: RoleModelProfile): string {
  return profile.model ?? "inherit";
}

function renderOpenCodeTemperature(temperature: number | null): string {
  return temperature === null ? "" : `temperature: ${temperature}\n`;
}

function openCodeTools(writeAccess: RoleAgentDefinition["writeAccess"]): { write: boolean; edit: boolean; bash: boolean } {
  if (writeAccess === "read-only") {
    return { write: false, edit: false, bash: false };
  }
  if (writeAccess === "baseline-draft" || writeAccess === "task-artifacts") {
    return { write: true, edit: true, bash: false };
  }
  return { write: true, edit: true, bash: true };
}

function claudeTools(writeAccess: RoleAgentDefinition["writeAccess"]): string {
  if (writeAccess === "read-only") {
    return "Read, Grep, Glob";
  }
  if (writeAccess === "baseline-draft" || writeAccess === "task-artifacts") {
    return "Read, Grep, Glob, Edit, MultiEdit";
  }
  return "Read, Grep, Glob, Edit, MultiEdit, Bash";
}

function roleAgentName(role: AgentRoleName): string {
  return `ff-${role}`;
}

async function writeGenerated(
  root: string,
  filePath: string,
  content: string,
  options: AdapterOptions,
  result: AdapterResult
): Promise<void> {
  if (options.overwrite === true) {
    await writeFile(filePath, content, "utf8");
    result.created.push(relative(root, filePath));
  } else if (await writeFileIfMissing(filePath, content)) {
    result.created.push(relative(root, filePath));
  } else {
    result.existing.push(relative(root, filePath));
  }
}

function harnessLabel(harness: HarnessName): string {
  if (harness === "opencode") {
    return "OpenCode";
  }
  if (harness === "pi") {
    return "Pi";
  }
  return harness[0].toUpperCase() + harness.slice(1);
}

function relative(root: string, filePath: string): string {
  return path.relative(root, filePath);
}
