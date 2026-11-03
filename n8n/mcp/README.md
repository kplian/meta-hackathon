> **Market update (2026-11-02):** The existing messaging laboratory is now published. The new eighth MCP tool and revised market prompt are prepared in code, but are not yet published: deployment of `asset-market-mcp` requires CLI login. The current live server still has its original seven tools. See [market validation](../../docs/ai-market-mcp.md). Historical unpublished status below describes earlier testing.

# Family MCP — hackathon laboratory

Saved in n8n:

- [MCP server](https://dev-n8n.kplian.com/workflow/T10NektvCIWMoozy): eight area tools including read-only market data, authenticated with Bearer Auth.
- [Private health subworkflow](https://dev-n8n.kplian.com/workflow/rMiWu16s5hrsLEIs): callable only by the MCP workflow; generates, validates and saves meal plans.
- [Messaging laboratory](https://dev-n8n.kplian.com/workflow/Mp1ACq1Zxypiktdg): one MCP Client Tool replaces all seven individual HTTP tools. WhatsApp/Telegram routing is unchanged.

**Status:** the authenticated MCP server is published. Five migrations are applied and recorded in remote Supabase.
Server and client credentials were created by the user and bound in n8n. Live client validation passed (execution 1254; MCP server execution 1255).
The messaging laboratory is deliberately unpublished; the original active workflow is untouched.

## Credential handoff (no secrets in Git or chat)

The n8n connector can select existing credentials, but cannot create them. The browser automation policy requires the user to enter and save new authentication credentials personally.

1. In **Family MCP** → **Connect to Bearer Auth**, create a credential named **Family MCP backend**. Enter a new random secret as the raw Bearer Token (without `Bearer `). Save it. Do not reuse the Meta/Supabase token.
2. In the messaging laboratory's **Family MCP client**, create **Multiple Headers Auth**, named **Family MCP client**, with these headers:

   | Name | Value |
   |---|---|
   | `Authorization` | `Bearer ` followed by the same new secret |
   | `X-Family-Channel` | Expression: `{{ $('Authorized context').item.json.transport.channel }}` |
   | `X-Family-Sender` | Expression: `{{ $('Authorized context').item.json.transport.senderId }}` |

   The last two values must be in **Expression** mode. They are determined by the validated message, never by `$fromAI`. n8n evaluates credential expressions per execution; test with two different senders before using real accounts.
3. Close the editors so the connector can finish credential binding and publish **only the MCP server**. Its URL is `https://dev-n8n.kplian.com/mcp/family-finance-lab`.
4. Test unauthorized requests, initialize/tools/list, unknown identity, and two isolated test identities. Then test the laboratory with delivery disabled. Do not publish the messaging laboratory or switch real bot callbacks during these checks.

The secret authenticates a **trusted backend**. Anyone holding it could assert a channel identity, so never share the MCP credential with end users. Supabase service-role credentials stay in n8n's existing managed credential. Missing/unknown identity fails closed.

## Database

`budget.f_family_mcp(channel_type, channel_code, area, operation, payload, request_key)` is executable only by `service_role`. It resolves an active `tchannel` and user, then checks the selected household membership. The model gets only `operation` and business `payload`; transport headers provide identity independently.

`family_mcp_private` holds owner-only snapshots of 17 app RPCs. Their authorization uses a transaction-local, backend-only actor context rather than impersonating a user JWT. Existing accounting rules, member auxiliaries, quantities, USD positions, household-currency operating cash and vaults are reused. Existing app RPCs are not rewritten. **When changing an app RPC later, review and resync its private snapshot in a new migration.**

The migrations applied here are `20261031340000`, `20261031350000`, `20261031351000`, `20261031360000` (existing health migrations previously missing remotely), and `20261102150000` (MCP gateway and private functions).

Opening assets and investment/vault movements use their existing request UUID idempotency. The gateway derives a UUID from actor, area, operation, MCP session and request ID when one is absent. Other CRUD/transaction operations do not gain universal replay protection; write retries remain disabled by policy.

## Areas and boundaries

Each tool takes `operation` and `payload` as strings. `payload` contains serialized JSON (`"{}"` for no fields), parsed before calling Supabase. This avoids n8n’s JSON-tool schema rejecting empty objects. The exact operation/payload catalog lives in `catalog.mjs`: household/member administration, estimated income, actual movements, investments, vaults, reports and health. No household creation, invitations, arbitrary SQL, accounting reversals, or standalone budget administration is exposed. Health requires explicit opt-in. Meal generation reuses the app's pure prompt/validation helpers and the existing Groq credential. The configured model (`qwen/qwen3.8-27b`) was verified by a real models query and JSON completion, using synthetic input only. Allergen conflicts block saves; an over-budget plan remains flagged by the saved plan's `within_budget` value. No automatic correction loop is included.

Market support is implemented through `supabase/functions/asset-market-mcp`, reusing the app's shared Twelve Data code. Only the trusted service-role credential is accepted; the handler resolves the active WhatsApp/Telegram identity before provider calls. The model can choose search/quote/fx/estimate_purchase and business arguments, never the transport identity, URL, secret or a write action. No database migration or asset/valuation write is performed by market lookup.

Deploy with `npm run market:mcp:deploy` after `npx supabase login`. This uploads only the Twelve Data key and the versioned backend function. The app's existing authenticated `asset-market` endpoint is unchanged. Publish the new MCP server draft and the updated messaging prompt only after endpoint and authorized MCP checks pass. Until deployment, the previously published server/prompt remain operational.

`fx` returns USD per one original currency unit. `estimate_purchase` calculates quantity and household cost, preserves an explicit user rate in household units per USD, or fetches/inverts reference FX when absent. It returns both rate directions and quote timestamps. Estimates are indicative and never execute trades or post accounting entries. Provider reference rates are not promised local cash rates. The model must present the proposal and obtain confirmation before moving money.

## Rebuild and checks

```sh
node n8n/mcp/build.mjs rMiWu16s5hrsLEIs
node n8n/scripts/build-channel-laboratory.mjs
node --experimental-strip-types --test tests/meal-plan.test.mjs tests/messaging-adapters.test.mjs tests/n8n-node-references.test.mjs tests/n8n-transaction-json.test.mjs tests/n8n-whatsapp-replies.test.mjs
```

Validate generated SDK code with the n8n workflow validator before saving. Set the health workflow caller allow-list to the actual MCP workflow ID after recreation. Generated code contains credential IDs/names only, never credential values.

`tests/family-mcp.sql` runs against migrated Supabase with `ON_ERROR_STOP` and `ROLLBACK`: seven areas, actor attribution, cash/investment/vault balances, investment retry, member creation, health opt-in and allergens, unknown users, cross-household denial and admin restrictions. It leaves no test users or transactions.

Validation evidence: 67 local tests passed; remote SQL tests passed before and after deployment. n8n executions 1245–1247 checked registration rejection, a valid meal plan, and allergen rejection with synthetic pinned services; no WhatsApp/Telegram sends. Executions 1244 and 1248 verified real model availability and JSON output. Probe nodes were removed. Live checks after credential handoff are recorded below as they complete.

## Live connection verified after credential handoff

- User-created credentials are bound: server `KeI3AmnpkQ4ExZaT` (Bearer Auth account), client `KY5EZMF56w8Zf31U` (Multiple Headers Auth account). Values remain encrypted in n8n.
- Missing authorization received HTTP 403. The authenticated client discovered the MCP tools and called `household/list` with serialized `"{}"`; Supabase returned `success:true,data:[]` for a disposable registered profile without households.
- Server runs 1250/1253 and 1255 showed the correct A/B sender headers from separate message executions. No sender was supplied by the model. Registration checks remained connected during final tests.
- The first schema test rejected empty JSON objects; switching the tool payload argument to a JSON string fixed this. A subsequent run using the old test conversation produced a malformed operation; the backend rejected it without writes. A fresh conversation completed successfully. MCP conversations now use the versioned memory key `messaging:mcp-v1:<user.id>` to avoid stale tool-call formats, while still sharing memory across linked channels.
- Both delivery nodes were disabled throughout the probes. No real messages were sent. Probe nodes and both disposable profiles/channels were removed, then delivery nodes restored in the **unpublished** laboratory draft. The original published workflow version is still `57e0fde3-ebb9-4f1d-9cc9-560b39d0186a`.
- 67 local tests pass. The public MCP endpoint is active; the messaging laboratory is not activated and provider callbacks have not been switched.

## Configured-user acceptance follow-up

See `docs/ai-mcp-acceptance.md` for the 19-scenario acceptance run, the WhatsApp-format migration, language and expression fixes, active private health subworkflow and localized agent-error route. Current local messaging/MCP checks total 70 tests. The laboratory remains unpublished, with temporary QA restrictions removed.
