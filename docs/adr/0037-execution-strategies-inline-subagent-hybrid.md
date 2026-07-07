# Execution strategies are inline, subagent, and hybrid

Flowflow will treat agent orchestration as an execution strategy layer. Inline execution must fully support the workflow in the main session, subagent execution can delegate specialized work to role-specific agents, and hybrid execution keeps coordination in the main session while delegating implementation and checking where the coding harness supports it. Hybrid is the recommended default, but subagent support is never required for correctness.
