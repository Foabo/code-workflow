---
description: Apply the spec quality gate, then turn accepted spec.md into plan.md and task.md without changing the spec.
---

Use this OpenCode slash command for the `ff-plan` Flowflow workflow action in this repository.

Load and follow the generated Flowflow skill guidance from:
@.agents/skills/ff-plan/SKILL.md

User request from slash command arguments:
`$ARGUMENTS`

If `.agents/skills/ff-plan/SKILL.md` cannot be loaded, stop and report the missing generated skill. Do not continue from memory or from this shim alone.
