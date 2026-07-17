---
description: Use a task-local resume.md only when the user explicitly asks to resume from it, then consume it after progress is recorded.
---

Use this OpenCode slash command for the `ff-resume` Flowflow workflow action in this repository.

Load and follow the generated Flowflow skill guidance from:
@.agents/skills/ff-resume/SKILL.md

User request from slash command arguments:
`$ARGUMENTS`

If `.agents/skills/ff-resume/SKILL.md` cannot be loaded, stop and report the missing generated skill. Do not continue from memory or from this shim alone.
