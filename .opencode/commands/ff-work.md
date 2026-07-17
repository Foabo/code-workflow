---
description: Default task progress action. Create or select a task, advance the next responsible phase, run check when appropriate, then stop before finish.
---

Use this OpenCode slash command for the `ff-work` Flowflow workflow action in this repository.

Load and follow the generated Flowflow skill guidance from:
@.agents/skills/ff-work/SKILL.md

User request from slash command arguments:
`$ARGUMENTS`

If `.agents/skills/ff-work/SKILL.md` cannot be loaded, stop and report the missing generated skill. Do not continue from memory or from this shim alone.
