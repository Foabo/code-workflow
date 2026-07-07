# Commands

## Setup

## Run

## Test

## Lint

## Typecheck

## Build

## Troubleshooting

## From task-codex-self-evolution

- Generate or refresh Codex repo-local skills with `ff update --harness codex`.
- Verify adapter behavior with `npm run typecheck`, `npm test`, `npm run build`, `node dist/src/cli.js validate --root .`, and `node dist/src/cli.js doctor --root .`.

- `ff internal validate-clarify --stage proposal|accept|advance` validates clarify event order, proposal identity, advisor review or degraded execution evidence, and explicit accept.

- `ff internal propose-spec --task <id> --spec-file <path>` — hashes the spec file, appends `brainstorm.done` + `spec.proposed` with identity, returns the identity.
- `ff internal accept-spec --task <id> --verdict pass|concern|blocker [--concerns-resolved] [--deferred-reason <text>] [--user-risk-acceptance] [--blockers-resolved] [--user-override] | --advisor-unavailable --harness <text> --failure-reason <text> --fallback-checklist-result <text>` — auto-binds the latest proposal identity, appends `advisor.reviewed`|`advisor.unavailable` + `spec.accepted(explicit:true)`.
