# CLI exposes setup and maintenance only

Flowflow's daily workflow is invoked through `ff-` prefixed agent commands. The public CLI remains small and focused on setup and maintenance, such as `ff init`, `ff doctor`, `ff update`, and `ff validate`. Deterministic state mutations used by agent commands live under internal helper commands such as `ff internal ...` and are not the primary user interface.
