# Laboratory: valid transaction JSON

Execution `1194` called `register_transaction` nine times and failed before sending
the request with `The value in the "JSON Body" field is not valid JSON`. The old
template interpolated text into JSON, including an extra pair of quotes around
the household name. A supplied name could produce `""Familia A""`.

The laboratory already used a JavaScript object body after issue 1. This fix
keeps that approach and tightens normalization:

- n8n serializes the object; quotes, backslashes and newlines are data, not JSON
  syntax. The node uses `contentType = "json"`, `specifyBody = "json"`.
- Absent optional household/date/auxiliar fields, including textual `null`, become
  actual JSON nulls.
- Invoice detail can arrive as an array or a JSON-encoded array. Invalid JSON or
  the wrong shape stops evaluation before sending the request. It is never
  silently replaced with an empty array, which previously lost invoice detail.
- The amount must be finite and greater than zero. Numeric strings are accepted,
  but text such as `25 BOB` or `25,50` is rejected instead of partially parsed.
  Amounts are requested without currency symbols or thousands separators.
- The WhatsApp sender stays bound to webhook metadata, outside the model's control.

The sanitized parameter patch is `n8n/patches/transaction-json-body.json`. The
`auxliar` model input key is kept for compatibility. A subsequent issue 6 fix
removes the model date input completely and always sends `p_transaction_date: null`.
The JSON fix itself changed no SQL function, credential, production workflow or
real record.

Validation: `node --test tests/n8n-transaction-json.test.mjs
tests/n8n-node-references.test.mjs` passes 17 expression tests, including reproduction
of the historical double-quote failure. These tests exercise object construction
and JSON serialization, not an end-to-end transaction through WhatsApp. Backend
business validation still applies after the body is constructed.
