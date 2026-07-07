# Initialize A Usable Flowflow Repository

Label: `ready-for-agent`

## Parent

`docs/prd/ff-version-1-workflow-kernel.md`

## What to build

Build the first complete initialization path for Flowflow. A user should be able to initialize a repository and immediately get a valid Repo Truth structure, sparse Project Baseline templates, task artifact templates, generated default command entries, validation support, and a healthy doctor result. The slice should prove that a repository can become Flowflow-ready without requiring Project Baseline content, external memory, code intelligence, model routing, or a bootstrap task.

## Acceptance criteria

- [ ] Running init creates the version record, Project Baseline templates, task storage, and task artifact templates.
- [ ] Running validation after init reports no structural errors.
- [ ] Running doctor after init reports a healthy repository.
- [ ] Init is idempotent and reports existing files rather than overwriting user-edited baseline or template content.
- [ ] Init exposes skippable enhancement prompts without making enhancements required.
- [ ] Automated tests verify observable initialized files and validation behavior.

## Blocked by

None - can start immediately
