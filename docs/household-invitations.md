# Household access and invitations

The Household screen opens the active household's member list. Add a member with name and relationship first; their row then offers Invite to the app (or View invitation if pending). Registered accounts show Already has access. The signed-in person's own row has My WhatsApp, using the same verification flow as Profile/onboarding. There is no standalone invitation form or direct invite-new-person shortcut. Only an active household administrator can create or cancel invitations. The user copies the invitation text or opens the native share sheet; the app does not send messages automatically.

Invitations expire after seven days, are revocable and grant only the household `member` role. Acceptance requires a signed-in account with the exact **verified email**. A link alone never grants access. Original tokens are hashed; a recoverable share token is kept only in the private invitation table and is returned solely by an authenticated household-admin RPC. Pending invitations can also be accepted after signing in with the invited email, so OAuth redirects do not lose the invitation.

New accounts with a valid pending invitation do not provision a separate household. The application shows an acceptance screen first. Declining all invitations allows creation of the user's own household. Existing accounts retain their original households and gain membership in the invited one.

When inviting an existing family profile, the accepted account reuses its personal auxiliary, so expense history stays associated with the same person. Estimated income sources, health profile and yield notification preferences move to the new active membership. The old placeholder membership is archived. Each person separately registers and verifies their own WhatsApp; no phone is copied from the inviter.

## Configuration

On web, links use the app's current origin. Set `EXPO_PUBLIC_APP_URL` to the public HTTPS frontend address to override it, and when generating links from a native mobile build. A localhost link cannot be opened on someone else's phone; the UI explains this limitation. The public frontend host must serve the application for its root URL with `?invite=...`. No custom route/server endpoint is needed.

Migrations `20261103130000_household_invitations.sql` and `20261103131000_invitation_decline_household_provisioning.sql` contain the private table, authenticated RPCs and signup trigger update, plus a narrow owner-bound exception for nested zero-budget initialization when a declined invite leads to a personal household. This does not deploy a new Edge Function or require a paid invitation service. Supabase Auth handles login and its normal email confirmation.

## Verification

`tests/household-invitations.sql` runs under ROLLBACK with temporary users. It checks verified recipient email, wrong accounts, admin-only invitations, expiration/revocation, acceptance replay, no extra signup household, retention of an existing account's home, preservation of member auxiliary/profile/income data independent WhatsApp verification and expense registration, and declining into a personal household.

`tests/household-invitation-links.test.mjs` covers web/native link capture and malformed tokens. No real invitations or messages are sent by tests.

Migration `20261103140000_member_invitation_status.sql` adds the member ID to the administrator-only pending-invitation response, so each row shows only its own invitations.

Migration `20261103150000_retrieve_pending_invitation_links.sql` adds stable link retrieval. New invitations retain their original link; older invitations receive an additional share token without invalidating their original hashed link. Opening View invitation now loads that link automatically, with copy/share, original expiry and cancellation; it does not create a replacement invitation. `tests/household-invitation-retrieval.sql` checks repeat retrieval, admin authorization, no duplicate/expiry changes, legacy compatibility and revocation.
