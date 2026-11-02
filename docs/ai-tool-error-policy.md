# Laboratory: stop repeating permanent tool errors

Applied only to the inactive `Hackathon - META - Laboratorio` workflow
(`Mp1ACq1Zxypiktdg`). The active workflow is unchanged. No SQL migration is needed
for this change.

## Changes

- Prepend `n8n/prompts/tool_error_policy.md` to the existing AI Agent system message.
- Set the agent's `options.maxIterations` to 4 instead of the default 10. This is a
  limit on agent iterations, not the total number of tool calls; multiple calls
  can be produced in an iteration. Reaching it can still end with an agent error.
- Disable n8n automatic node retries for the agent and its nine HTTP tool nodes.
- Configure each HTTP tool with
  `options.response.response = { fullResponse: true, neverError: true,
  responseFormat: "json" }`, preserving its other options. HTTP failures are now
  passed to the model as a status code and response body rather than only a
  generic "Bad request" tool exception. Consumers must inspect `body.success`;
  an HTTP 200 by itself is not confirmation of a successful write.
- Extend tool descriptions to stop on permanent failures and request missing
  information in a new turn. No credentials or business parameters were changed.

The policy rejects retries of permission, invalid UUID/JSON, missing data and
unknown errors. A write timeout is an uncertain outcome, so it must not trigger
another write. Read-only 429/502/503/504 responses allow at most one retry.

## Behavioral checks

Five manual runs used a temporary, disconnected test agent branch with the same
DeepSeek model and the policy. A simulated Code Tool returned fixed responses;
the user's test request explicitly asked the model to keep trying. No real
transaction was written and no message was sent. The branch was removed after
testing.

| Execution | Simulated response | Tool calls | Result |
| --- | --- | --- | --- |
| 1233 | Write rejected with HTTP 403 | 1 | Stopped and explained rejection |
| 1234 | HTTP 200, `success=false`, invalid UUID | 1 | Stopped without claiming success |
| 1235 | Write timeout / HTTP 504 | 1 | Reported uncertain outcome; no duplicate attempt |
| 1236 | Read-only HTTP 503 | 2 | One retry, then stopped |
| 1237 | Successful write | 1 | Confirmed once |

Outputs and counts are saved in `n8n/tests/tool-error-policy-results.json`.
These runs test policy behavior with simulated results, not a complete WhatsApp
conversation or every real HTTP tool.

## Limit

Stopping after a specific error is model-driven, not a deterministic circuit
breaker. The iteration limit is enforced by n8n, and node retries are disabled,
but the model could still repeat a tool call within that budget. Guaranteed
per-tool rejection of repeated writes would require a guarded executor and
idempotency; those are not implemented by this prompt change. Other existing
issues (missing tool credentials, stale node references, webhook verification)
are outside this fix.
