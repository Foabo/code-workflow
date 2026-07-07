# Dirty worktree handling at finish

Flowflow will inspect dirty Git worktree state during finish without maintaining a separate change ledger. If the dirty worktree represents the current task implementation, finish may continue only when verification and review cover the current diff; if the dirty worktree is unrelated, the finish summary must acknowledge that it is outside the task; if the relationship is ambiguous, finish is blocked until the user or agent cleans up, commits, stashes, or otherwise clarifies the worktree state.
