# Clarify updates task spec with user confirmation

CW will expose `clarify` as a core workflow action through the `cw-clarify` agent command. Clarify asks questions, investigates only as needed, and updates the task-local `spec.md`; it does not write implementation code or update project baseline files. Clarify completes when the user accepts the current task spec, otherwise the task remains open or becomes blocked with a clear next action.
