# CLI exposes setup and maintenance only

CW's daily workflow is invoked through `cw-` prefixed agent commands. The public CLI remains small and focused on setup and maintenance, such as `cw init`, `cw doctor`, `cw update`, and `cw validate`. Deterministic state mutations used by agent commands live under internal helper commands such as `cw internal ...` and are not the primary user interface.
