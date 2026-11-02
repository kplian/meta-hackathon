# Laboratory agent prompt

The runtime system message is English and is assembled, in this order, from:

1. `n8n/prompts/tool_error_policy.md` — evidence, permanent failures and bounded read retries.
2. `n8n/mcp/assistant-prompt.md` — role, reply language, intent, tool routing, financial semantics, confirmations and health consent.

`n8n/prompts/financial_agent_standard_prompt.md` now points to these sources rather than keeping an obsolete copy with retired tool names. `node n8n/scripts/build-channel-laboratory.mjs` regenerates the saved graph specification. The laboratory's AI Agent system message was verified to match those files exactly after the update. The original live workflow was not changed during prompt testing. The laboratory was subsequently published for the WhatsApp cutover; see `whatsapp-workflow-cutover.md`.

The English instructions preserve Spanish, English and Portuguese replies. They explicitly separate estimated/received income, cumulative available funds, current-month saving progress and USD wealth; avoid rebuilding reports from incomplete history; minimize redundant reads; ask only for missing inputs; require meaningful confirmation for investment/vault movements; and distinguish rejected writes from uncertain outcomes. Technical backend fields should not appear in ordinary replies. Quoted receipt instructions cannot authorize writes.

## Validation

The existing 76 local checks passed after regeneration. They do not prove model behavior or guarantee that a prompt cannot fail.

Twelve scenarios from `n8n/tests/prompt-evaluation-cases.json` were executed and their replies and tool traces reviewed in the actual, unpublished laboratory on 2026-11-02, after authorization to use the registered test user. All twelve final scenarios passed: Spanish monthly savings, English vaults, Portuguese available funds versus wealth, missing expense amount, ordinary income, denied permissions, uncertain write timeout, insufficient available funds, disabled health, unsupported live quotes, quoted instructions and foreign-currency expense.

Read-only scenarios used the real user registration and MCP data. Successful income, denied permission and write timeout used temporary in-memory tools after the real registration gate; these outcomes were simulated, not real database writes. Provider delivery nodes were disabled during testing, and isolated memory prevented contamination of normal conversations. The user's before/after database snapshots were identical. All temporary test nodes, tool guards and memory overrides were removed afterward. The separate fixture-only draft was archived.

There were 22 executions including intermediate harness corrections, prompt refinements and a format-repair probe. Intermediate attempts exposed redundant reads, unnecessary clarification, parallel health reads and one plain-text response rejected by the JSON parser. The final prompt addresses these behaviors. The structured parser now permits one format-only model repair using `n8n/prompts/format_only_repair.md`; it has no business tools and does not rerun the agent. A dedicated probe forced an uncertain plain-text income response and verified identical meaning after JSON repair, with zero tool calls.

The separate in-memory evaluation generator remains available for isolated prompt checks. Its parser intentionally has automatic repair disabled so raw formatting errors remain visible. It is not the laboratory runtime graph.

These are representative checks, not a guarantee of every model response. The main laboratory was unpublished throughout these tests and the original active workflow was unchanged. It was subsequently published for WhatsApp setup. The laboratory MCP server was restored and republished with its normal operations after testing.
