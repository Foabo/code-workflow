# Closure gate before closing tasks

Flowflow will run a closure gate before any task is marked finished. The gate runs when a workflow tries to finish a task, when work reaches a passed review and prepares to finish, when the user asks to finish a task, or when a resumed session finds a task that appears complete but unfinished. The gate checks task completeness across phase, spec coverage, verification, review, drift, and dirty worktree handling before the task lifecycle is closed.
