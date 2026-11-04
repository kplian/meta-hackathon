# WhatsApp ownership verification

The optional WhatsApp card is shared by onboarding and Profile. It supports English, Spanish and Portuguese.

1. Enter the international number and request verification while signed in.
2. On mobile, open the prepared WhatsApp message and **send it**. On desktop, scan the locally generated QR with the phone or open WhatsApp Web. Instructions and a manual fallback are shown in place.
3. The native Meta trigger supplies the real sender and bot account to `budget.f_messaging_ingress_lab`. A LINK message is handled before the AI. The app polls its own status and offers Continue after confirmation.

## Database and permissions

Migration `20261103120000_whatsapp_ownership_verification.sql` adds:

- `tchannel.verified_at`, the server-owned ownership proof; the compatibility `config_json.verified` field is also updated on confirmation.
- Private bot routing configuration and private hashed, random 256-bit challenges. Codes expire after ten minutes, work once, are bound to user/channel/phone/bot, and are invalidated when the phone changes or another code is issued. Limit: one request per minute, five per hour.
- Authenticated RPCs `f_begin_whatsapp_verification`, `f_my_whatsapp_verification`; `f_set_my_whatsapp` now safely handles changes/removal as a security-definer function using only `auth.uid()`.
- Restrictive policies prevent authenticated clients from directly writing WhatsApp channels, including self-verification or changing their channel type. Channel administration must use the owner's RPC.
- A unique active verified WhatsApp owner per canonical phone. Conflicting ownership fails closed; it does not transfer someone else's link.
- Context resolution and the lab transaction adapter now require verified WhatsApp ownership. MCP delegates to that same context resolver. Telegram behavior is unchanged.

Existing phone registrations are **not grandfathered as verified**. They must complete this flow before the lab assistant accepts financial requests. The old non-laboratory workflow is outside this change and must not be used as a fallback to bypass verification.

## n8n

Only Resolve registration, Authorized context and Registration reply change; existing native trigger credentials, webhook URL, AI model, audio configuration and channel delivery remain intact. Verification success/failure replies are deterministic and use the app-selected language. No LINK message is sent to the AI or its memory. Unknown/malformed codes get a generic localized failure without revealing ownership information.

Bot public number/account are initialized from the existing native WhatsApp event metadata. When changing the Meta bot, update the private settings row together with its native trigger configuration.

## Checks

`tests/whatsapp-ownership.sql` runs transactionally with temporary users and verifies sender/account binding, expiry, single use, removal, duplicate ownership, backend authorization, MCP gating and real-role RLS against self-verification. No test financial transactions are kept.

`tests/whatsapp-verification.test.mjs` checks mobile/web links, expiry and deterministic pre-AI routing in all three languages. A real phone must perform the final send itself; automated tests never send WhatsApp messages on the user's behalf.
