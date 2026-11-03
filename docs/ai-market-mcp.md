# Market data for the messaging assistant

## Implementation

The read-only `market` MCP tool exposes `search`, `quote`, `fx` and `estimate_purchase`. Its managed Supabase credential calls the new `asset-market-mcp` Edge Function. The function accepts only the backend service-role key and resolves the registered messaging identity with the existing `f_messaging_context_lab` RPC before contacting Twelve Data. It reuses `_shared/asset-market.ts`; the app's existing `asset-market` function is unchanged. No new database tables or migrations are needed. Quotes do not post transactions, sync asset valuations or execute trades.

The model cannot choose the sender, URL, secret or a write operation. `payload` remains a serialized JSON string at the MCP boundary. Server-side limits and a strict operation/argument allow-list reject invalid calls. Credentials are references in n8n and secret values stay out of Git and model input.

`fx` reports USD per one original currency unit. `estimate_purchase` returns both rate directions, household cost and instrument quantity. An explicit user exchange rate takes precedence. At 12 BOB/USD, a 100 USD purchase costs 1,200 BOB. The backend performs the arithmetic. Prices/rates retain their provider timestamps and are indicative references, not guaranteed live or local cash/execution prices.

## Prompt changes

The assistant discovers exact instrument symbols before pricing (BTC/USD, never bare BTC), obtains missing market references instead of claiming no access, preserves user rates, presents dated proposals and requests confirmation before accounting movements. A lookup or proposal never claims a purchase was saved. A later rate/confirmation message must not repeat an already recorded salary. Six bounded agent iterations permit discovery, pricing and relevant account reads.

## Validation on 2026-11-02

- Real Twelve Data calls through the shared code: Bitcoin discovery, BTC/USD quote, 100 USD estimate at the explicit 12 BOB/USD rate, and BOB/USD reference FX all succeeded. The Bitcoin quote was dated at the start of the day and must not be labeled live.
- Local tests cover authorization, unknown identity, identity outage, exclusion of write operations, crypto USD validation, missing provider configuration, FX direction, user-rate precedence, 100 USD → 1,200 BOB, invalid amounts/rates and transport identity isolation.
- Isolated n8n model scenarios used fixture tools, no database writes and no channel delivery. Execution 1374 searched for Bitcoin and passed exact BTC/USD to estimate_purchase, reported 0.00125 BTC at the fixture price of 80,000 USD and 1,200 BOB cost, and did not write. Execution 1376 returned both FX directions in English. Execution 1378 explained a provider-plan rejection in Portuguese with one call and no invented quote/retry.
- An initial permissive fixture accepted bare BTC; tightening the fixture exposed that gap and the revised prompt was retested with strict exact-symbol validation. Fixture numbers are synthetic and are not current prices.

## Deployment gate

The MCP draft contains the market node; the published server and messaging prompt are unchanged until the endpoint is deployed and checked. Supabase CLI currently reports AccessTokenRequiredError. Run `npx supabase login`, then `npm run market:mcp:deploy`. Check anonymous rejection and an authorized market call through n8n before publishing the server and updated messaging prompt. Actual end-to-end MCP/provider checks remain pending. Do not report this capability as live until these pass.

## Investment rejection fix (2026-11-02)

Migration `20261102220000_investment_exchange_rate_precision.sql` is applied and recorded in cloud migration history. It increases stored USD-per-household-unit precision to 24 decimal places and updates both the app RPC and the private MCP snapshot to retain that precision before settlement validation. The existing eight-decimal USD tolerance is unchanged; truly mismatched rates still reject.

`tests/investment-fx-precision.sql` passed with reciprocal 1/12 and 1/6.96 rates, finite rates, purchase/sale cash symmetry, journal balance checks, invalid FX rejection and the private MCP path. The existing investment-movement and seven-area MCP SQL suites also passed. All fixtures use ROLLBACK. A private reproduction of the reported user's exact 1,200 BOB / 100 USD purchase succeeded under ROLLBACK; no real purchase was retained.

The stricter priority policy was published to the messaging laboratory while retaining its existing market-unavailable instructions until the market backend is deployed. Isolated execution 1401 made one assets/move call, received the simulated settlement rejection and stopped without adjusting decimals or retrying. This is a model behavior check, not a new backend-wide retry lock. The temporary evaluation workflow was archived. Provider deployment still requires an authorized Supabase CLI session.
