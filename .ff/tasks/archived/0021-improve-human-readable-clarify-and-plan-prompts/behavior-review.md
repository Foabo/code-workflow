# Behavior Review

## Purpose

Record behavior-level evidence for the prompt changes. This file checks whether the generated `ff-clarify` and `ff-plan` guidance is likely to improve real agent output, beyond string assertions in tests.

## Probe 1: `ff-clarify` Chinese Anti-Jargon Scenario

### Concrete Input

```text
[$ff-clarify] 我在实际使用过程用 glm5.2、qwen、deepseek 进行 clarify/plan 发现经常说黑话，完全听不懂，出的 spec 和方案也很跳跃。prompt 不够好。我本地有一些说人话的 skill，是不是可以参考下，优化当前工作流 prompt？
```

### Expected Failure Mode

- The agent writes a readable chat summary, while the Proposed Spec content remains abstract or partly English.
- The agent uses workflow terms such as Proposed Spec, proposal identity, advisor review, and acceptance criteria without explaining why the user should care.
- The agent jumps from complaint to implementation scope without explaining goal, motivation, trade-off, risk, and evidence.
- The agent asks for acceptance before the user can judge what will change.

### Desired Behavior After This Change

- User-visible clarify output follows the user's Chinese unless it names commands, paths, API names, code identifiers, or product names.
- Brainstorm Pass, questions, Proposed Spec content, Proposed Spec summaries, and acceptance evidence are all readable in the user's language.
- Required workflow terms get short plain-language explanations before acceptance whenever they appear in user-visible output.
- Before asking for acceptance, the output plainly answers what goal is protected, why it matters, what is in scope, what is out of scope, what trade-off is chosen, what evidence proves success, and what necessary workflow terms mean.

### Reviewer Verdict

- First-round `ff-reviewer` verdict: concern. It found that "Proposed Spec summaries" could let weak models make only the summary readable while leaving the spec body unclear.
- Patch applied: `ff-clarify` now says "Proposed Spec content and summaries", strengthens term explanation before acceptance, and adds the before-acceptance plain-answer checklist.
- Second-round `ff-reviewer` verdict: pass. The reviewer found the prior `ff-clarify` concern resolved and no remaining concrete gap for the prior concern.

### Remaining Risk

- This is behavior-level prompt review, not an execution transcript from GLM/Qwen/DeepSeek. A weak model can still ignore instructions, but the generated guidance now gives a concrete shape that a reviewer or check phase can challenge.

## Probe 2: `ff-plan` Accepted-Spec-To-Plan Scenario

### Concrete Input

```text
Accepted spec: Improve generated ff-clarify and ff-plan prompts so Chinese user-visible output is easier to understand, explains required workflow terms, connects motivation/scope/trade-offs/evidence, avoids jargon and formulaic AI prose, updates tests, refreshes generated skills, and records behavior-review evidence.

Run ff-plan for this accepted spec.
```

### Expected Failure Mode

- The agent writes broad plan labels such as "优化提示词", "更新测试", "刷新产物", and "完成验证".
- The plan does not map each acceptance criterion to a concrete action, target artifact or behavior, observable result, and verification evidence.
- Key Decisions repeat the spec without explaining the chosen approach and why it stays inside scope.
- Risks name vague concerns without saying what check would reveal the failure.

### Desired Behavior After This Change

- `plan.md` and `task.md` name executable actions, concrete trade-offs, target artifacts or behaviors, expected observable results, and verification evidence.
- For each accepted acceptance criterion, `plan.md` or `task.md` says what will change, where it changes, what result should be visible, and how check can prove it.
- Checklist items that are only topic labels are rejected unless they state the exact changed surface and proof.
- Key Decisions record the chosen approach and why it stays within scope. Risks name the failure mode and the check that would reveal it.

### Reviewer Verdict

- First-round `ff-reviewer` verdict: concern. It found that the original `ff-plan` bullets were directionally correct but did not force a concrete plan/task shape.
- Patch applied: `ff-plan` now requires accepted-criterion mapping to action, target artifact or behavior, observable result, and verification evidence; it also rejects topic-label checklist items unless they name the exact changed surface and proof.
- Second-round `ff-reviewer` verdict: pass. The reviewer found the prior `ff-plan` concern resolved and acceptance readiness for `ff-plan`.

### Remaining Risk

- This review proves stronger generated guidance and independent reviewer acceptance. It does not guarantee every host model will obey the guidance without review pressure, so `ff-plan` now also requires behavior probes for generated workflow guidance changes.

## Overall Advisor Status

- First-round `ff-advisor` verdict: blocker. It required behavior probes with concrete input, expected failure mode, desired behavior, reviewer verdict, and remaining risk.
- This file records those probes and links them to first- and second-round independent review outcomes.
