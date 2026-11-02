# Laboratory: transaction date comes from the database

The model no longer provides a transaction date. `register_transaction` sends
`p_transaction_date: null`, and the laboratory RPC always uses PostgreSQL `now()`
even if a caller supplies a date. The legacy RPC argument remains for signature
compatibility but is ignored. No session claims or timezone settings are changed.

Migration: `20261102130000_ai_lab_server_transaction_date.sql`, applied and recorded
in the remote Supabase migration history. Only `f_register_transaction_ai_lab`
is changed. The active workflow and original RPC remain unchanged.

The value is a `timestamptz`: a real instant, independent of its displayed timezone.
Storage can display UTC while clients/reports show that instant in the appropriate
local timezone. This change does not repair or change timezone grouping in reports.
It uses the database transaction timestamp, not the WhatsApp message timestamp.
Backdating and scheduling future transactions through this laboratory are not
supported. The system prompt explicitly tells the model not to promise them.

Validation:

- `tests/ai-transaction-authorization.sql` sends dates in 2000 and 2099 and checks
  the persisted income/expense timestamps equal database `now()`. All fixtures
  and postings are rolled back.
- `tests/n8n-transaction-json.test.mjs` rejects any attempt to request a date via
  `$fromAI` and confirms missing, past, future and invalid model dates all yield
  a null RPC date, leaving the server authoritative.

The expression tests cover payload construction; the SQL tests verify persistence.
Neither test sends a WhatsApp message or changes real financial records.
