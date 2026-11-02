# Laboratory: WhatsApp reply failures

## Findings

Historical production executions 994 and 996 failed with HTTP 401 / Authentication
Error. Execution 928 failed with a Meta account-access error, and 912 with an
Authorization Error. These are different from malformed message payloads.

Later production executions 1190 and 1227 have a successful send response with a
message identifier. That proves API acceptance for those requests, not delivery
to the recipient. No production setting or credential was changed by this fix.

Manual laboratory execution 1238 reused `Header Auth Meta 1` to GET the configured
phone ID with `fields=id`. It returned HTTP 200 and the expected object. Thus the
current credential can authenticate and access that phone object. This read-only
check does not independently prove messaging permission, unlimited token lifetime,
or recipient delivery. No replacement token was created or needed for that check.
The temporary probe branch was removed.

## Laboratory changes

- The normalizer returns no item for delivery/read/failure status callbacks and
  events without a message. Previously it returned `{ignore:true}`, which could
  reach the default reply branch and attempt to send an invalid response.
- The main formatter validates sender metadata and requires nonempty string output
  from the agent, then creates an explicit WhatsApp text payload. It does not
  stringify arbitrary objects or send an undefined body.
- The unsupported-message branch builds a proper text response. Previously it
  submitted the raw normalized event (`ignore`, `type`, `from`, etc.) as if it were
  a WhatsApp send request.
- Both HTTP send nodes use JSON, return the full Meta response, retain HTTP errors
  as execution failures, stop on error, and disable automatic retries. A 15-second
  timeout bounds waiting, but a timeout still has an uncertain delivery outcome;
  it must not automatically cause another send.

No error workflow, external alert, persistent delivery tracking or retry queue was
added. Status events are ignored for replies, not stored or reconciled into a
delivery report. Outgoing messages and subsequent delivery events still need a
separate delivery-tracking design if required. Very long replies, recipient/window
restrictions, and future token expiry are not solved by payload validation.

## Validation

- `node --test tests/n8n-whatsapp-replies.test.mjs
  tests/n8n-transaction-json.test.mjs tests/n8n-node-references.test.mjs`: 26 passing
  tests, including eight reply/normalizer checks.
- n8n execution 1239 injected a synthetic delivered-status callback into the lab
  Webhook. It finished successfully at the normalizer, with zero output items and
  neither send node executed.
- No real WhatsApp message was sent and no financial record was modified. The
  laboratory remains unpublished. A real conversation is still needed to verify
  end-to-end delivery.

Sanitized parameter changes: `n8n/patches/whatsapp-replies.json`. In addition, both
send nodes have `retryOnFail=false` and `onError=stopWorkflow`. Existing credentials
and the active workflow remain unchanged.
