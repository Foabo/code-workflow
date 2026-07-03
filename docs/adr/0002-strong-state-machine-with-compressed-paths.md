# Strong workflow state machine with compressed paths

The workflow kernel will use a strong state machine for task progress, while allowing explicit compressed paths and recorded overrides for small tasks or unusual situations. This keeps task progress recoverable and auditable, while preventing the workflow from forcing full ceremony onto every change.
