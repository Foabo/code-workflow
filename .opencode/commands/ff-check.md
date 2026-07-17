---
description: Run verification and review, reconcile drift, and update task.md before finish is allowed.
---

Use this OpenCode slash command for the `ff-check` Flowflow workflow action in this repository.

Load and follow the generated Flowflow skill guidance from:
@.agents/skills/ff-check/SKILL.md

User request from slash command arguments:
`$ARGUMENTS`

If `.agents/skills/ff-check/SKILL.md` cannot be loaded, stop and report the missing generated skill. Do not continue from memory or from this shim alone.
