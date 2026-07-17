# Plan

## Implementation

- Change `renderOpenCodeCommand` in `src/harness/adapters.ts` to emit a thin command shim.
- Keep the same `.opencode/commands/<command>.md` expected artifact list and doctor currentness checks.
- Update harness tests so generated OpenCode commands are verified as shims that reference the generated skill file and carry `$ARGUMENTS`.
- Refresh `.opencode/commands/` with `ff update --harness opencode`.
- Adjust Project Baseline wording to say OpenCode commands reference generated skills instead of embedding full workflow guidance.

## Validation

- Run the full verification stack from the task spec.
- Inspect `.opencode/commands/ff-clarify.md` to confirm it is short and points at `.agents/skills/ff-clarify/SKILL.md`.

## Approach

Keep OpenCode commands as generated command templates and move duplicated workflow content out of the command body. The command should provide the discoverable slash entry, include the user arguments, and reference the matching generated skill file.

## Key Decisions

- Use OpenCode `@.agents/skills/<command>/SKILL.md` references so the command template can load the canonical generated skill.
- Keep only `description` frontmatter in command files to avoid role/model duplication with OpenCode agents.
- Preserve existing expected command paths so doctor stale checks and update behavior continue to compare against one renderer output.

## Risks

- If OpenCode file references fail, the command could run with too little guidance. The shim includes an explicit stop instruction for missing skill files.
- A vague test could accidentally allow workflow body duplication to return. Tests now assert the absence of key workflow sections and internal clarify helper details.
- Project Baseline wording could drift from generated output. The baseline text is updated with the thin shim model.

## Validation Strategy

Run the full verification stack from the spec, then inspect `.opencode/commands/ff-clarify.md` to confirm it references `.agents/skills/ff-clarify/SKILL.md`, includes `$ARGUMENTS`, and omits copied workflow sections.
