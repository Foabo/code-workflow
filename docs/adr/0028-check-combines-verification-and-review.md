# Check combines verification and review

CW will use `check` as the workflow action for validating implementation against the task. Check may run tests, lint, typecheck, or manual verification, and it also reviews whether the implementation satisfies `spec.md`, follows `plan.md`, keeps `task.md` accurate, and has no unresolved drift. Check updates `task.md` rather than creating separate verification or review artifacts.
