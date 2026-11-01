# Household onboarding

All onboarding UI and feature translations live here. HomeScreen is the integration point: it checks the active household and renders OnboardingScreen until setup_completed_at is set.

- OnboardingGate.tsx: loading/error handling and entry into the onboarding flow.
- OnboardingScreen.tsx: household name, existing members, additional family profiles and completion.
- IncomeSourcesStep.tsx: optional estimated income sources, shared or member-specific, with create/edit/soft-delete.
- i18n.ts: Spanish, English and Portuguese in an isolated onboarding namespace.
- Backend changes stay in supabase/migrations, including signup provisioning and member registration.

Normal Auth signup creates a household and its creator membership transactionally. The default name uses family_name when available, otherwise the profile name. Auth updates do not create another household. Existing memberships are preserved. Invitation links are not implemented here and will need their own registration flow.

The flow has five steps: household name/currency, members, optional income sources, optional assets, and a household pyramid plan. Completion is only saved after the plan is selected and its percentages total 100%. Sources are persisted independently and survive returning to earlier steps or reloading.

## Assets

- `AssetsStep.tsx` owns the optional asset form and USD opening-asset list.
- Asset types and icons are stored in `budget.tasset_type`; translations stay in this feature.
- `f_register_household_asset` atomically creates a position, its individual auxiliar, a USD asset account and balanced opening entries in the common transaction journal against initial equity. Retries use request IDs and cannot silently change the original payload.
- `ttransaction` / `ttransaction_detail` hold the opening journal, identified as `opening_balance`, `patrimony`, USD. The temporary `tasset_entry` table was removed after validating migration to the common journal. Daily reports exclude these entries.
- Quantity supports fractional units. A manually reported purchase price is distinguished from an estimated property value or a market estimate. Current quote fallback is not historical cost; provider and quote timestamp are saved.
- Removal soft-deletes the position and creates reversing journal entries; no purchase, sale or transfer is executed.
- This step does not expose ongoing asset management. Backend valuation history, market refreshes and optional management revaluation are documented in `docs/accounting-assets.md`; sales and realized gains are not implemented.

### Symbol discovery and quotes

Twelve Data `symbol_search` discovers stocks/ETFs and USD crypto pairs; `cryptocurrencies` supports name discovery such as Bitcoin. `quote` returns a timestamped USD reference price. Searches are explicit to conserve API credits. The server caches responses and applies a per-user request limit. Availability and delays depend on the provider subscription.

Set backend-only `TWELVE_DATA_KEY` in the root `.env`, then run `npm run market:serve` in a separate terminal. The app calls the authenticated `asset-market` Edge Function; never add this key to `EXPO_PUBLIC_*`. For hosted Supabase, deploy this function and configure its backend secret separately. Ordinary signup and household data do not depend on the market provider.

Provider documentation: https://twelvedata.com/docs

Tests: `npm run test:market`. For reversible SQL integration checks, run `tests/assets-ledger.sql` with psql against the local database. All SQL test data is rolled back.

Savings and monetary investments preserve the original currency balance and its initial USD conversion. The asset form also saves optional interest/reward and monthly reminder preferences in `tasset_yield_settings`; it does not activate alerts or yield updates. See `docs/accounting-assets.md` for backend details.

For non-USD monetary positions, the form can fetch an initial FX reference through `asset-market` (`action: fx`, original `currency`). The backend uses Twelve Data `exchange_rate`; original balance, USD-per-unit rate, provider and provider timestamp are saved. Manual input remains available.

## Pyramid plan

`PyramidStep.tsx` uses global templates from the existing pyramid tables, shows a segmented pyramid with descriptions and editable percentages, and previews monthly amounts in the household currency. The initial choices are 50/30/20 and the existing five-level 20% template. Values are validated in integer hundredths on the frontend; saving is disabled until all fields are valid and sum to exactly 100%. Valid decimal percentages such as 33.33/33.33/33.34 are supported.

`pyramid-calculations.ts` normalizes estimated income: monthly unchanged, weekly ×52/12, yearly ÷12 and twice-monthly ×2. Variable-frequency sources and other currencies are explicitly excluded rather than guessed or mixed. No income is required to choose a plan; the preview displays zero with an explanation. When the plan totals 100%, cent rounding is distributed so the allocations add up to the monthly estimate.

`f_select_household_pyramid` saves a household copy with its own levels, percentages and category mappings; `thousehold.financial_pyramid_id` identifies the selected plan. Global templates stay unchanged. The RPC also checks 100%, authorization and level codes. It does not create accounting entries or divide each level's amount among individual category budgets (`tbudget`). Future reports may recompute level amounts from updated income estimates.

Template reads are global or household-scoped; global templates are read-only to ordinary clients. The legacy administrative screens are separate from onboarding and do not yet enforce this onboarding validation when editing household levels individually.

Checks: `npm run test:pyramid` and reversible SQL `tests/pyramid-selection.sql`.
