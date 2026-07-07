# Finish closes completed tasks

Flowflow will expose `finish` as the workflow action for completing a task. Users do not call a separate close or archive action, and task state does not need a result field; when finish succeeds, a kernel helper sets `lifecycle` to `closed`. Finish runs the closure gate, records the finish summary in task artifacts and trace events, optionally promotes stable facts to the project baseline with user confirmation, deletes any consumed resume note, and then closes the task.
