export type TopLevelCommand = "init" | "validate" | "doctor" | "update" | "tasks" | "preflight" | "internal";
export type WorkflowHelpAction =
  | "work"
  | "clarify"
  | "plan"
  | "run"
  | "check"
  | "finish"
  | "resume"
  | "discard"
  | "doctor"
  | "understand";
export type InternalHelper =
  | "create-task"
  | "select-task"
  | "append-trace"
  | "validate-clarify"
  | "set-state"
  | "finish-task"
  | "discard-task"
  | "create-resume"
  | "ensure-baseline-delta"
  | "sync-baseline-delta"
  | "consume-resume"
  | "refresh-context-package"
  | "migrate-task-ids"
  | "propose-spec"
  | "accept-spec";

type HelpEntry<T extends string> = {
  name: T;
  summary: string;
  usage: string;
  options: string[];
};

export const TOP_LEVEL_COMMANDS: readonly HelpEntry<TopLevelCommand>[] = [
  {
    name: "init",
    summary: "Initialize Flowflow Repo Truth and generated harness surfaces in a repository.",
    usage: "ff init [path] [--root <path>] [--harness codex|claude|opencode|pi|cursor] [--code-index <provider>] [--context-memory <provider>] [--pi-subagents install|skipped] [--yes]",
    options: [
      "--root <path>  Target repository root; defaults to [path] or the current directory.",
      "--harness <name>  Harness to generate: codex, claude, opencode, pi, or cursor.",
      "--code-index <provider>  Code intelligence provider selection.",
      "--context-memory <provider>  External context provider selection.",
      "--pi-subagents install|skipped  Pi subagent setup choice.",
      "--yes  Use defaults for omitted interactive choices."
    ]
  },
  {
    name: "validate",
    summary: "Validate Flowflow Repo Truth structure.",
    usage: "ff validate [--root <path>]",
    options: ["--root <path>  Repository root; defaults to the current directory."]
  },
  {
    name: "doctor",
    summary: "Inspect repository workflow health and generated harness drift.",
    usage: "ff doctor [--root <path>]",
    options: ["--root <path>  Repository root; defaults to the current directory."]
  },
  {
    name: "update",
    summary: "Refresh generated skills, role agents, and watchdog artifacts.",
    usage: "ff update [--root <path>] [--harness codex|claude|opencode|pi|cursor] [--force]",
    options: [
      "--root <path>  Repository root; defaults to the current directory.",
      "--harness <name>  Harness to refresh; defaults to codex.",
      "--force  Overwrite protected generated role-agent configuration."
    ]
  },
  {
    name: "tasks",
    summary: "List active, archived, or all Flowflow tasks.",
    usage: "ff tasks [--root <path>] [--archived|--all]",
    options: [
      "--root <path>  Repository root; defaults to the current directory.",
      "--archived  List archived tasks.",
      "--all  List active and archived tasks."
    ]
  },
  {
    name: "preflight",
    summary: "Check whether a workflow action can run against a task.",
    usage: "ff preflight --action <action> [--task <id>] [--root <path>]",
    options: [
      "--action <action>  Workflow action to check.",
      "--task <id>  Task id or short task reference.",
      "--root <path>  Repository root; defaults to the current directory."
    ]
  },
  {
    name: "internal",
    summary: "Run deterministic Flowflow helper commands for task state and trace updates.",
    usage: "ff internal <helper> [flags]",
    options: [
      "--root <path>  Repository root; defaults to the current directory.",
      "Use `ff internal --help` for helper names and `ff internal <helper> --help` for helper flags."
    ]
  }
] as const;

export const WORKFLOW_COMMANDS: readonly HelpEntry<WorkflowHelpAction>[] = [
  workflow("work", "Create or select a task and advance the next responsible phase.", "ff-work [--root <path>] [--task <id>] [--title <text>]", [
    "--title <text>  Title for a newly created task."
  ]),
  workflow("clarify", "Review intent, propose a spec, and record explicit acceptance.", "ff-clarify [--root <path>] [--task <id>]", [
    "--goal <text>  Seed the task goal.",
    "--acceptance <text>  Add an acceptance criterion; may be repeated."
  ]),
  workflow("plan", "Turn an accepted spec into plan.md and task.md.", "ff-plan [--root <path>] [--task <id>]"),
  workflow("run", "Execute the next task.md implementation items.", "ff-run [--root <path>] [--task <id>]", [
    "--write-file <path>  Simple file write target for shimmed runs.",
    "--content <text>  Content for --write-file."
  ]),
  workflow("check", "Run verification, review drift, and prepare finish evidence.", "ff-check [--root <path>] [--task <id>]", [
    "--command <cmd>  Verification command to record; may be repeated.",
    "--baseline-outcome <text>  Baseline outcome evidence."
  ]),
  workflow("finish", "Close a completed task after closure checks and baseline handling.", "ff-finish [--root <path>] [--task <id>] --summary <text>", [
    "--summary <text>  Required finish summary.",
    "--dirty-worktree covered|unrelated|clean  Dirty worktree handling.",
    "--baseline accepted|selected|edited|skipped|none  Baseline handling decision."
  ]),
  workflow("resume", "Load a task resume note for user-triggered continuation.", "ff-resume [--root <path>] [--task <id>]"),
  workflow("discard", "Discard a task after confirmed worktree handling.", "ff-discard [--root <path>] [--task <id>] --confirm [--worktree <handling>]", [
    "--confirm  Required confirmation.",
    "--worktree keep|stash|revert|delete-worktree|none  Worktree handling choice."
  ]),
  workflow("doctor", "Report repository workflow health through the workflow wrapper surface.", "ff-doctor [--root <path>]"),
  workflow("understand", "Draft Project Baseline updates from repository context.", "ff-understand [--root <path>] [--task <id>]", [
    "--merge  Merge reviewed understand output when supported."
  ])
] as const;

export const INTERNAL_HELPERS: readonly HelpEntry<InternalHelper>[] = [
  helper("create-task", "Create a task record.", "ff internal create-task --title <title> [--id <id>] [--phase <phase>] [--next-action <text>]", ["--title <title>  Task title.", "--id <id>  Optional explicit task id."]),
  helper("select-task", "Resolve and select a task.", "ff internal select-task [--task <id>]", ["--task <id>  Optional task id or short task reference."]),
  helper("append-trace", "Append a task trace event.", "ff internal append-trace --task <id> --type <type> --summary <text> [--data-json <json>]", ["--task <id>  Task id.", "--type <type>  Trace event type.", "--summary <text>  Trace event summary.", "--data-json <json>  Optional JSON object payload."]),
  helper("validate-clarify", "Validate clarify proposal, advisor, and accept trace order.", "ff internal validate-clarify --task <id> [--stage proposal|accept|advance] [--watchdog]", ["--task <id>  Task id.", "--stage <stage>  Clarify validation stage.", "--watchdog  Run watchdog-safe validation."]),
  helper("set-state", "Update task lifecycle, phase, and next action.", "ff internal set-state --task <id> [--lifecycle <state>] [--phase <phase>] [--next-action <text>]", ["--task <id>  Task id.", "--lifecycle <state>  Optional lifecycle.", "--phase <phase>  Optional phase."]),
  helper("finish-task", "Close and archive a task after closure checks.", "ff internal finish-task --task <id> --summary <text> [--dirty-worktree covered|unrelated|clean] [--baseline accepted|selected|edited|skipped|none]", ["--task <id>  Task id.", "--summary <text>  Finish summary.", "--baseline <decision>  Baseline handling decision."]),
  helper("discard-task", "Discard a task with explicit worktree handling.", "ff internal discard-task --task <id> --confirm [--worktree keep|stash|revert|delete-worktree|none]", ["--task <id>  Task id.", "--confirm  Required confirmation.", "--worktree <handling>  Worktree handling choice."]),
  helper("create-resume", "Create a resume note for a task.", "ff internal create-resume --task <id> --content <markdown> [--resume-condition <text>]", ["--task <id>  Task id.", "--content <markdown>  Resume note content."]),
  helper("ensure-baseline-delta", "Create a task-local baseline-delta.md when needed.", "ff internal ensure-baseline-delta --task <id>", ["--task <id>  Task id."]),
  helper("sync-baseline-delta", "Apply a task-local baseline delta decision.", "ff internal sync-baseline-delta --task <id> --decision accepted|selected|edited|skipped [--selected-files <files>] [--edited-content <markdown>]", ["--task <id>  Task id.", "--decision <decision>  Baseline sync decision."]),
  helper("consume-resume", "Consume a task resume note after progress.", "ff internal consume-resume --task <id>", ["--task <id>  Task id."]),
  helper("refresh-context-package", "Generate or refresh a task context package.", "ff internal refresh-context-package --task <id>", ["--task <id>  Task id."]),
  helper("migrate-task-ids", "Migrate legacy task ids into the current task-id format.", "ff internal migrate-task-ids [--root <path>]", ["--root <path>  Repository root; defaults to the current directory."]),
  helper("propose-spec", "Record a spec proposal identity from spec.md.", "ff internal propose-spec --task <id> --spec-file <path>", ["--task <id>  Task id.", "--spec-file <path>  Spec file to hash and bind."]),
  helper("accept-spec", "Record advisor review and explicit spec acceptance.", "ff internal accept-spec --task <id> --verdict pass|concern|blocker [...]", ["--task <id>  Task id.", "--verdict <value>  pass, concern, or blocker.", "--advisor-unavailable  Use degraded advisor evidence path."])
] as const;

export function hasHelpFlag(args: readonly string[]): boolean {
  return args.includes("--help");
}

export function renderGlobalHelp(): string {
  return [
    "Flowflow",
    "",
    "Usage:",
    "  ff <command> [flags]",
    "  ff-<workflow> [flags]",
    "",
    "Top-level commands:",
    ...TOP_LEVEL_COMMANDS.map((entry) => `  ${entry.name.padEnd(10)} ${entry.summary}`),
    "",
    "Workflow wrappers:",
    ...WORKFLOW_COMMANDS.map((entry) => `  ff-${entry.name.padEnd(10)} ${entry.summary}`),
    "",
    "Use `ff <command> --help`, `ff internal <helper> --help`, or `ff-<workflow> --help` for details."
  ].join("\n");
}

export function renderTopLevelCommandHelp(command: string): string | null {
  const entry = TOP_LEVEL_COMMANDS.find((candidate) => candidate.name === command);
  return entry === undefined ? null : renderEntry(entry);
}

export function renderInternalOverviewHelp(): string {
  return [
    "Flowflow internal helpers",
    "",
    "Usage:",
    "  ff internal <helper> [flags]",
    "",
    "Helpers:",
    ...INTERNAL_HELPERS.map((entry) => `  ${entry.name.padEnd(22)} ${entry.summary}`),
    "",
    "Use `ff internal <helper> --help` for helper-specific flags."
  ].join("\n");
}

export function renderInternalHelperHelp(helperName: string): string | null {
  const entry = INTERNAL_HELPERS.find((candidate) => candidate.name === helperName);
  return entry === undefined ? null : renderEntry(entry);
}

export function renderWorkflowOverviewHelp(): string {
  return [
    "Flowflow workflow wrappers",
    "",
    "Usage:",
    "  ff-<workflow> [flags]",
    "  node dist/src/agent-command.js <workflow> [flags]",
    "",
    "Workflows:",
    ...WORKFLOW_COMMANDS.map((entry) => `  ${entry.name.padEnd(10)} ${entry.summary}`),
    "",
    "Use `ff-<workflow> --help` for workflow-specific flags."
  ].join("\n");
}

export function renderWorkflowCommandHelp(action: string): string | null {
  const entry = WORKFLOW_COMMANDS.find((candidate) => candidate.name === action);
  return entry === undefined ? null : renderEntry({ ...entry, usage: `${entry.usage}\n  node dist/src/agent-command.js ${entry.name} [flags]` });
}

function workflow(name: WorkflowHelpAction, summary: string, usage: string, options: string[] = []): HelpEntry<WorkflowHelpAction> {
  return {
    name,
    summary,
    usage,
    options: [
      "--root <path>  Repository root; defaults to the current directory.",
      "--task <id>  Optional task id or short task reference.",
      ...options,
      "--help  Show this help and exit without running the workflow."
    ]
  };
}

function helper(name: InternalHelper, summary: string, usage: string, options: string[]): HelpEntry<InternalHelper> {
  return {
    name,
    summary,
    usage,
    options: [...options, "--root <path>  Repository root; defaults to the current directory.", "--help  Show this help and exit without running the helper."]
  };
}

function renderEntry(entry: HelpEntry<string>): string {
  return [
    entry.summary,
    "",
    "Usage:",
    ...entry.usage.split("\n").map((line) => `  ${line}`),
    "",
    "Options:",
    ...entry.options.map((option) => `  ${option}`)
  ].join("\n");
}
