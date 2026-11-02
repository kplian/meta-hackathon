# MCP messaging acceptance checks

The 2026-11-02 acceptance run used a configured cloud user and its linked WhatsApp, with actual registration checks, the shared agent and the authenticated MCP. No real provider sends were made. Private household data and chat transcripts are deliberately excluded from this document and Git.

Coverage: 19 scenarios, 24 executions including retries after fixes; 70 local tests. Scenarios include identity/member lookup, estimated versus received income, available cash versus USD wealth, monthly saving progress, expenses by member, empty vaults, ten closed months, opening balances, health without consent, missing transaction data, insufficient investment funds, unsupported live quotes, permanent write errors, unknown senders in ES/EN/PT plus ambiguous language, a foreign household request and a forced agent failure.

Chat writes were blocked before database access while acceptance tests ran. Successful CRUD, transaction accounting, position units, vault transfers, health preferences/profiles and meal-plan validation were tested separately through `tests/family-mcp-existing-user.sql`, inside a transaction that always rolls back. Run it with `psql -v user_email=... -f tests/family-mcp-existing-user.sql` only against an intended test account whose health module is initially disabled and which has one active household and WhatsApp channel. That test uses the real actor but leaves no changes behind.

The before/after household snapshot matched exactly. Probe nodes, QA memory keys and temporary read-only guards were removed. The messaging laboratory stays unpublished, and the original active workflow stays unchanged.

## Fixes retained

- Migration `20261102183000_messaging_whatsapp_number_format.sql` canonicalizes the optional E.164 plus sign only for WhatsApp phone matching, preserving stored phone values, Telegram identifiers, active membership checks and ambiguous-owner rejection. `tests/messaging-whatsapp-number-format.sql` covers both registration and transaction actor resolution.
- Finance vocabulary now selects the message language even without greetings, rather than falling back to the profile's language. Generic signup notices still work without the model.
- MCP operation argument descriptions are concise to avoid nested `}}` in expression strings; full tool descriptions retain their business schema.
- The health subworkflow must be published for this n8n instance's production MCP calls. Its caller allow-list remains restricted to the MCP server. Health denial never implies missing profiles or plans.
- Agent execution failures route to `Assistant failure reply` and then normal channel formatting; all languages warn about checking history before repeating a financial write with an uncertain outcome.

## Boundaries

These tests do not establish signed webhook delivery or phone ownership. The linked channel's `verified` flag is separate from matching its number. Do not switch live provider callbacks as part of this test procedure.

The MCP currently has no market-search/quote tool, so unsupported live-price requests must receive an honest limitation. Cloud `asset-market` deployment also requires a separate authenticated Supabase CLI session; SQL access alone cannot deploy Edge Functions.

Case prompts: `n8n/tests/mcp-acceptance-cases.json`. They contain no private household data. The forced-failure scenario additionally overrides the agent prompt for one manual execution and restores it immediately.

Never run the `blocked_write_es` prompt against an unrestricted live user: it intentionally requests a write. It requires the temporary read-only MCP guards used during QA. The SQL rollback suite is the safe way to verify successful writes.
