# Discard removes abandoned tasks

Flowflow will handle abandoned work through a `discard` maintenance action rather than a closed task result. Discard removes the task record after the user decides what to do with related worktree changes: if the task uses an isolated Git worktree, Flowflow can delete that worktree after confirmation; if the task shares the current worktree, Flowflow must ask whether to keep, revert, or stash uncommitted changes before removing the task.
