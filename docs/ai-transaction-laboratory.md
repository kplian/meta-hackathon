# Messaging transaction authorization: laboratory

The inactive [laboratory workflow](https://dev-n8n.kplian.com/workflow/Mp1ACq1Zxypiktdg)
now calls `budget.f_register_transaction_ai_lab`. The active workflow and existing
`f_register_transaction_ai` / `f_register_transaction` functions are unchanged.

## Contract

- Only `service_role` can execute the laboratory RPC. Public and authenticated
  app clients cannot call it; the function also checks `auth.role()`.
- The workflow supplies `p_channel_type = "whatsapp"` and `p_channel_code` directly
  from `Webhook.body.entry[0].changes[0].value.messages[0].from`. Neither value is
  supplied by the model. Telegram is supported by the SQL contract, but is not
  wired into this WhatsApp laboratory.
- The adapter resolves one active, non-deleted user/channel and one active,
  non-deleted household membership. A supplied household name must match exactly
  (ignoring case and surrounding whitespace). Missing or ambiguous matches fail;
  the adapter never silently posts to another household.
- The accounting implementation uses the resolved actor without fabricating a
  user JWT. It also rejects auxiliars belonging to another household.
- The HTTP tool uses a JSON object body with `specifyBody = "json"`. Its description
  tells the model not to repeat an authorization/configuration error or claim a
  failed transaction succeeded. This is prompt guidance, not deterministic retry
  prevention or idempotency.

## Isolation and migration

`20261102121000_ai_transaction_lab_authorization.sql` snapshots the existing core
accounting function into an owner-only `messaging_private` schema. It changes only
the actor authorization block and adds auxiliar scope checks. This deliberately
isolates the experiment from production; it is not the final shared-engine
refactor. Subsequent changes to the app's accounting function do not automatically
propagate to this snapshot. Consolidate the accounting implementation when
promoting the fix to production.

The migration derives the laboratory adapter from the existing AI adapter,
replacing sender/household resolution and routing to the private implementation.
It checks the expected source blocks and fails if they have changed. The deployed
adapter contained a debugging `raise exception 'aqui';`; only the laboratory copy
removes that exception. The migration is recorded in the remote Supabase history.

The original public RPC permissions remain unchanged to avoid altering production.
Restricting those existing RPCs is still required when promoting the fix.

## Validation

`tests/ai-transaction-authorization.sql` creates temporary users and households,
then rolls back all test data. It verifies real SQL role permissions, backend role
checks, channel/platform matching, inactive membership, household selection, income
and expense posting without a user JWT, balanced journal entries, cash balance
(`100 - 25 = 75`), cross-household auxiliar rejection, negative amount rejection,
and unchanged app authentication. Run with `psql -X -v ON_ERROR_STOP=1 -f
tests/ai-transaction-authorization.sql` using a private DB connection.

n8n manual execution `1232` called the lab RPC with the existing `Supabase account 2`
credential and an unregistered synthetic sender. It returned
`CHANNEL_NOT_REGISTERED_OR_AMBIGUOUS`, confirming the backend credential reaches
the new RPC. That probe created no transaction and sent no WhatsApp message; its
temporary workflow branch was removed. An end-to-end model/WhatsApp transaction has
not been exercised by this change.

## Deferred prerequisite

Webhook authenticity verification is deferred at the user's request. This fix
assumes the platform already verified the sender. It does not make the current
webhook trustworthy. The laboratory remains unpublished; no Meta App Secret was
added and no platform callback was changed.
