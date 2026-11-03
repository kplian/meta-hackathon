# Additional households and automatic routing

Enabled in the published messaging laboratory and MCP server on 2026-11-02. Market support remains staged separately; this release does not activate the pending market endpoint.

## Before the agent

`f_messaging_context_lab` already resolves a verified WhatsApp/Telegram channel to the user and returns every active household membership, including ID, name, currency and role. `Authorized context` and `assistantInput` pass this list to the model before it acts. No extra household-list call is needed when the current context suffices.

With one household, use it automatically. With several, an explicit name selects its authorized ID. Without a target, ask which household before a scoped write. Neither the original, first, last-used nor newly created household is an implicit default in this case. A clarification selects the pending operation only. The backend still returns SELECT_HOUSEHOLD if several exist and no ID is supplied; foreign IDs are rejected.

## Creation

The existing household tool now supports `create` with serialized payload `{name,currency}`. It requires an existing admin membership and binds ownership to the resolved user, never a model-supplied user ID. The name and currency are validated. Provisioning reuses the household trigger, creating the chart, budget categories and creator member/admin with their personal auxiliar. setup_completed_at stays empty: creating a household does not complete onboarding or create another login.

A backend request key replays the same creation without duplicating it. Reuse with different terms is rejected. Names already present in the user's active memberships are rejected case-insensitively. Actor locking serializes these checks. The owner-only request table is inaccessible to API users/service_role and cascades on household/user deletion.

The operation routes before existing-household selection, so creating an additional household does not ask which existing household to target. Its response contains the new household and the refreshed membership list; any later ambiguous operation in that same turn must ask for its target.

## Database and validation

Migration `20261102223000_mcp_create_additional_households.sql` is applied and recorded in cloud. It adds the private creation helper/request record and routes `household/create` through the existing service-role-only `f_family_mcp` gateway. The legacy `f_create_household_ai` function is not used.

`tests/mcp-households.sql` passed against cloud under ROLLBACK: one-household default, additional admin/auxiliar/chart provisioning, request replay, duplicate names, refreshed pre-agent context, ambiguous write blocked, explicit household write, foreign-household denial, identity override rejection, invalid currency, unknown identity and member-only denial. Existing seven-area MCP SQL regression passed too. No test households, logins or transactions were retained.

Five model scenarios passed with both the earlier DeepSeek evaluation model (1426–1430) and the model currently configured in the live workflow (1431–1435): sole-household income writes directly; two-household income without target asks with zero tools/writes; explicitly named Trabajo routes to its ID; creation uses household/create; creation followed by an untargeted income asks rather than choosing the new household. These model tests use in-memory fixture tools, no real writes and no delivery. Temporary QA workflow archived. The 88 local messaging/MCP/market tests also passed.

Only the household tool description and the relevant live prompt routing/creation instructions were changed in n8n. Other collaborators' existing model/audio configuration was preserved. The repository generator includes the future market prompt as well; the published prompt retains the market-unavailable boundary until that separate deployment completes.
