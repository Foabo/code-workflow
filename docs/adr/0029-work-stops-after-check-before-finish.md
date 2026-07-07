# Work stops after check before finish

Flowflow will make `work` the default task-progress action through the `ff-work` agent command. It may create or select a task, clarify and update `spec.md`, update `plan.md` and `task.md`, run the next executable work, and perform `check`. When check passes, `work` stops and asks the user whether to finish, because finish may close the task, handle dirty worktree state, and sync baseline deltas.
