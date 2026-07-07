# Baseline Delta

## overview.md

## architecture.md

- Clarify gate identity (`attempt_id`/`proposal_id`/`proposal_hash`, `proposal_hash = sha256(spec content)`) is recorded via `cw internal propose-spec --task --spec-file` and `cw internal accept-spec --task --verdict ...`, which compute and thread the identity triple so agents do not hand-hash or hand-thread field names. `latestProposalIdentity(events)` is the exported read-side primitive (returns the latest proposal identity or null when absent/malformed).

## rules.md

- Use `cw internal propose-spec --spec-file <path>` and `cw internal accept-spec` to record clarify gate proposal identity and advisor/accept outcomes. Do not hand-compute `proposal_hash`/`proposal_id` or hand-thread the identity triple (`attempt_id`/`proposal_id`/`proposal_hash`) in trace events — the helpers own hashing and identity binding.

## commands.md

- `cw internal propose-spec --task <id> --spec-file <path>` — hashes the spec file, appends `brainstorm.done` + `spec.proposed` with identity, returns the identity.
- `cw internal accept-spec --task <id> --verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>` — auto-binds the latest proposal identity, appends `advisor.reviewed`|`advisor.unavailable` + `spec.accepted(explicit:true)`.
