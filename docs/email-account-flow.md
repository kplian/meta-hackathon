# Email registration, confirmation and sign-in

An invitation opens the sign-up tab. A person can create an account with email/password, confirm the email using Supabase's link, and return to the app with an authenticated session. Pending household invitations are resolved from the verified account email, including when confirmation happens in a different browser or device. The household acceptance screen remains available after sign-in.

The login screen has explicit Sign up / Sign in controls, password confirmation and visibility controls, a Check your email state, resend with cooldown, password recovery, and localized errors in Spanish, English and Portuguese. Existing accounts can sign out and sign in again with their email/password. Passwords are never retained outside the active input component or stored to resume confirmation.

`getAuthRedirectUri()` supplies the current web app root (or the native Expo redirect) for signup, resend, recovery, Google and SSO. This address must be allow-listed in Supabase Authentication URL Configuration. In web development it is normally `http://localhost:8090/`. Native app builds use the scheme in `apps/mobile/app.json` (currently `arkia`).

`useSession` processes initial URLs, native incoming URLs and web hash changes before displaying the authenticated app. The shared callback handler uses Supabase `setSession`, `exchangeCodeForSession` or `verifyOtp`; tokens are validated by the SDK/backend and then removed from the browser address, preserving the invitation. Duplicate native/OAuth delivery is deduplicated briefly. Recovery links open a dedicated password screen; the recovery marker is bound to the session's user and survives refresh until completion/sign-out.

Cloud was checked read-only: email signup is enabled and automatic email confirmation is disabled (`mailer_autoconfirm: false`). Local Supabase configuration now also requires email confirmation; use its Mailpit inbox for local email tests. No database migration or new Edge Function is needed for this frontend change.

## Validation

- `tests/auth-email-flow.test.mjs`: email-session restoration, callback origin/path validation, malformed/expired/rejected links, missing-session rejection, PKCE and token-hash callbacks, recovery routing, invitation preservation and token removal.
- Temporary isolated cloud account: real password authentication, browser callback restoration on first load and with an already-open app, logout and password re-entry; tests do not use real users' passwords or send confirmation/reset emails to family members.
- TypeScript and lint for the changed authentication files.

Email delivery and public/native callback allow-lists are service/deployment configuration. Links sent before the updated redirect was configured keep their original destination; an unconfirmed user can request a new link, and already-confirmed users can sign in normally.

The browser integration test restores a real backend-issued confirmed session through the callback handler. It does not send confirmation emails to real family members. The temporary account, household and sessions are removed after the test. SMTP delivery itself is not exercised by automated checks.
