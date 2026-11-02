# WhatsApp laboratory cutover check

Initial comparison on 2026-11-02; updated after the authorized laboratory activation. The original workflow was not changed.

| Item | Published original | Laboratory draft |
| --- | --- | --- |
| Workflow | `F7dFtCgnYp7SkGFw` | `Mp1ACq1Zxypiktdg` |
| State | Active at last inspection | Published |
| Receive trigger | Generic Webhook | Native WhatsApp Trigger |
| POST path | `/webhook/43fd3e8a-3030-4f4e-9bbf-9fde84360135` | Native-generated path; differs from original |
| GET verification path | `/webhook/a4423db9-4b1e-4d81-9af7-baa0ce1907e2` | Same native endpoint as its POST |
| Verification token | Existing manually configured token | Generated from native trigger node ID |
| Send credential | `Header Auth Meta 1` | Same credential ID |
| Graph API | `v26.0` | `v26.0` |
| Destination phone-number ID | From incoming Meta metadata | From normalized incoming Meta metadata |
| POST signature verification | Not present in the inspected workflow | Native trigger validates HMAC with app secret |

The laboratory's media download nodes also use the original send credential. Its WhatsApp delivery node is enabled and the workflow is now published. Its native receive credential is `WhatsApp DEV`; the original generic receive webhook has no corresponding credential to compare. The Meta application/account relationship has not been verified through the provider API.

## Consequence

Merely assigning the old path or copying its verification branch is not equivalent to the current native trigger: native n8n uses a fixed `webhook` suffix, a node-ID verification token and app-level callback registration. Its activation can reject an existing callback at another URL. Do not deactivate the original until the callback transition is planned.

The simplest cutover retains the send credential and changes Meta's callback to the native trigger URL, with its corresponding verification token, during the switch. Coordinate the existing app subscription with native registration, then test a real incoming message and delivery. Revert to the original subscription/workflow on failure.

Keeping the public URL requires routing infrastructure (an alias/proxy preserving the exact raw request body and signature headers) plus compatible app subscription registration, or a custom ingress that validates Meta's signature before normalization. That is additional implementation, not a route-name edit. No proxy access or app-secret environment binding was available in this check, so no unverified generic ingress was substituted.

The existing original exposes separate GET and POST routes. This check does not establish which URL Meta currently has configured; inspect its actual app subscription before cutover. Telegram is a separate provider transition and was not changed.

## Cutover progress (2026-11-02)

The laboratory was activated with authorization. Its first verification request failed because n8n could not decrypt the `WhatsApp DEV` credential. After the user re-saved the credential, a GET challenge against the production endpoint returned the exact challenge text with HTTP 200. The user subsequently reported completing the Meta configuration. A real inbound WhatsApp message and successful delivery are still pending verification; challenge success alone does not establish end-to-end messaging.

Production callback: `https://dev-n8n.kplian.com/webhook/9790db85-a5fd-498e-ae36-fc3539439826/webhook`. Use the native trigger node ID as its verification token, not the former manual token. App ID and App Secret remain in managed n8n credentials and are never exported to this repository.
