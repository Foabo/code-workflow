# Task lifecycle has no ready state

CW will use `open`, `blocked`, `parked`, and `closed` as task lifecycle values. It will not add a `ready` lifecycle state; readiness is expressed by the combination of lifecycle, phase, and next action, such as `open` with phase `run` and next action `implement accepted plan`.
