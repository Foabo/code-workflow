# Change sentinel without a change ledger

CW will treat possible out-of-band repository changes as a workflow preflight concern without maintaining a separate change ledger. Git remains the source of truth for code changes; the change sentinel inspects repository state during session start, workflow preflight, review, finish, resume, or optional hooks, then surfaces dirty worktree or drift concerns for the current action to handle through task artifacts and finish checks.
