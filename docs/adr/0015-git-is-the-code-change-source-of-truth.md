# Git is the code change source of truth

CW will not maintain a separate code-change ledger, global change inbox, or mandatory touched-file list. Git remains the source of truth for actual code changes, while CW records task intent, plan, context, verification, review, finish outcome, and append-only workflow events; preflight and closure checks inspect Git state when they need to reason about dirty worktrees or possible drift.
