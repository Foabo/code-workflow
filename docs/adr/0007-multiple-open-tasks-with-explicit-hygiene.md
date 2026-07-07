# Multiple open tasks with explicit hygiene

Flowflow will allow multiple open tasks in a repository, because real development often interleaves implementation, review, blocked work, and parked ideas. The kernel will keep task lifecycle coarse, using open, blocked, parked, and closed, while phase and health flags record where the task is in the workflow and what needs attention. Each unfinished task must have a current phase, next action, progress timestamp, and any blocking or resume condition so unfinished work does not become ambiguous.
