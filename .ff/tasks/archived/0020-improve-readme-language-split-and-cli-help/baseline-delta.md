# Baseline Delta

## overview.md

- Default repository documentation uses `README.md` in English and `README.zh-CN.md` in Chinese, with links between the two versions.

## architecture.md

## rules.md

- Public CLI help requests must return before workflow execution, project checks, task selection, trace writes, resume-note consumption, or other repository state changes.

## commands.md

- Public command help is available through `ff --help`, `ff <command> --help`, `ff internal <helper> --help`, and `ff-<workflow> --help`.
- Public internal helper help covers `create-task`, `select-task`, `append-trace`, `validate-clarify`, `set-state`, `finish-task`, `discard-task`, `create-resume`, `ensure-baseline-delta`, `sync-baseline-delta`, `consume-resume`, `migrate-task-ids`, `propose-spec`, and `accept-spec`.
