# Monthly budgets over messaging

Published in the laboratory MCP and messaging workflow on 2026-11-02. `budgets` supports `summary`, `categories` and `set {category_key,monthly_limit}`. The household follows the shared routing rule: one is automatic, several require an explicit target. Only an administrator can set a budget. The budget is monthly planning, not an income/expense, cash reservation or transaction.

## Pyramid ceiling

With a selected pyramid, combined active monthly budgets are capped at estimated monthly household income minus its saving reserve. Example: 10,000 BOB estimated income and 20% saving → 2,000 BOB reserved → 8,000 BOB maximum combined budgets. This is a global cap, not an additional per-area cap.

The estimate uses the dashboard's exact normalization: monthly ×1, weekly ×52/12, biweekly ×2, yearly ÷12. Inactive/deleted, variable and other-currency estimates do not contribute. This is not received income, available cash or wealth. The reserve is rounded to currency cents before subtraction. With no selected pyramid, no pyramid cap is imposed. With a pyramid and zero fixed estimates, only zero planned budgets fit.

An update replaces the category's previous amount. Deleted/inactive budgets are excluded; reactivation is checked. If estimates later decrease, existing budgets are not silently rewritten: summary flags the excess and only non-increasing corrective changes are permitted until within the new cap. No income estimate or pyramid is changed to accommodate a budget request.

## Database enforcement

Migration `20261102230000_mcp_budgets_and_pyramid_cap.sql` is applied and recorded in Supabase. It adds an owner-only capacity helper, a budget table trigger and a private budget action routed through the existing backend-only `f_family_mcp` gateway. Trigger enforcement also covers direct frontend writes, not only the agent. Household row locking serializes budget writes. The trigger handles INSERT..ON CONFLICT UPDATE correctly and sees preceding rows in multirow writes. Membership checks precede capacity reads for authenticated frontend writes; nonfinite estimates/amounts cannot produce a spendable cap. Private helpers are not callable by frontend/API roles.

The model reads summary, resolves the actual category key and checks the proposed total before set. It does not register expenses for budgets, silently reduce requested amounts, consume the saving reserve or guess a household. Complete explicit requests do not require redundant confirmation. An excess is explained with the available allowance and alternatives.

## Validation

`tests/mcp-budget-pyramid.sql` passed on cloud with ROLLBACK: no-pyramid behavior, exact and exceeded caps, replacement/idempotent set, direct frontend updates, soft deletion/reactivation, estimate normalization, corrective reductions, zero estimates, 0%/100% saving, multirow writes, invalid amounts/category, nonfinite data, foreign access, multiple-household selection and admin-only writes. No financial transactions were generated. Existing household and seven-area MCP SQL regression suites also passed.

Six isolated model checks passed using the currently configured model: Spanish create (1438), rejection without writing above the cap (1439), replacement (1440), missing target among two households (1441), English (1442), Portuguese (1443). These use in-memory fixtures, not real budget writes or channel sends. Temporary evaluation workflow archived. The 88 local messaging/MCP/market checks passed.

A read-only check with the authorized real user returned estimated income 10,000 BOB, saving reserve 2,000 BOB, spending limit 8,000 BOB and existing planned budgets zero. No real-user budget was changed. The new tool is published with its existing managed Supabase credential, and the live prompt includes budget routing and the cap rules. Other collaborators' model/audio settings and market-permission work were preserved.
