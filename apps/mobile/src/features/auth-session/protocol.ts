import type { SupabaseClient } from '@supabase/supabase-js';
export type EmailVerificationType = 'email' | 'signup' | 'invite' | 'recovery' | 'email_change' | 'magiclink';
export type AuthCallback = { kind: 'none' } | { kind: 'error'; code: string } | { kind: 'tokens'; accessToken: string; refreshToken: string; recovery: boolean } | { kind: 'code'; code: string } | { kind: 'otp'; tokenHash: string; type: EmailVerificationType };
const authKeys = ['access_token','refresh_token','expires_in','expires_at','token_type','type','provider_token','provider_refresh_token','code','token_hash','error','error_code','error_description'];
export function parseAuthCallback(input: string): AuthCallback {
  let url: URL; try { url = new URL(input); } catch { return { kind: 'none' }; }
  const hash = new URLSearchParams(url.hash.slice(1));
  const get = (key: string) => hash.get(key) || url.searchParams.get(key);
  if (get('error') || get('error_code')) return { kind: 'error', code: get('error_code') || get('error')! };
  const accessToken = get('access_token'), refreshToken = get('refresh_token');
  if (accessToken || refreshToken) return accessToken && refreshToken ? { kind: 'tokens', accessToken, refreshToken, recovery: get('type') === 'recovery' } : { kind: 'error', code: 'invalid_callback' };
  const code = url.searchParams.get('code'); if (code) return { kind: 'code', code };
  const tokenHash = get('token_hash'), type = get('type');
  if (tokenHash) return type && ['email','signup','invite','recovery','email_change','magiclink'].includes(type) ? { kind: 'otp', tokenHash, type: type as EmailVerificationType } : { kind: 'error', code: 'invalid_callback' };
  return { kind: 'none' };
}
export function callbackMatchesApp(input: string, redirect: string): boolean {
  try {
    const url = new URL(input), expected = new URL(redirect);
    return url.protocol === expected.protocol && url.host === expected.host && url.pathname.replace(/\/+$/, '') === expected.pathname.replace(/\/+$/, '');
  } catch { return false; }
}
export function cleanAuthCallbackUrl(input: string): string {
  const url = new URL(input), hash = new URLSearchParams(url.hash.slice(1));
  for (const key of authKeys) { url.searchParams.delete(key); hash.delete(key); }
  url.hash = hash.toString(); return url.toString();
}
export function validateEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function passwordValidation(password: string, confirmation: string): 'shortPassword' | 'passwordMismatch' | null {
  return password.length < 8 ? 'shortPassword' : password !== confirmation ? 'passwordMismatch' : null;
}
export function authErrorKey(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : error instanceof Error ? error.message : '';
  if (['email_not_confirmed'].includes(code)) return 'emailUnconfirmed';
  if (['invalid_credentials','user_not_found'].includes(code)) return 'invalidCredentials';
  if (['otp_expired','flow_state_expired','AUTH_CALLBACK_EXPIRED','access_denied'].includes(code)) return 'expiredLink';
  if (['weak_password'].includes(code)) return 'shortPassword';
  if (['email_address_invalid','validation_failed'].includes(code)) return 'invalidEmail';
  if (/rate_limit|over_request_rate/.test(code)) return 'rateLimited';
  if (/cancel/i.test(code)) return 'cancelled';
  return 'error';
}

/** Shared by email links and OAuth. The SDK validates the session with Supabase. */
export async function applyAuthCallback(auth: SupabaseClient['auth'], input: string): Promise<{ handled: boolean; recovery: boolean }> {
  const callback = parseAuthCallback(input);
  if (callback.kind === 'none') return { handled: false, recovery: false };
  if (callback.kind === 'error') throw Object.assign(new Error('Authentication link failed'), { code: callback.code });
  const result = callback.kind === 'tokens' ? await auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken })
    : callback.kind === 'code' ? await auth.exchangeCodeForSession(callback.code)
    : await auth.verifyOtp({ token_hash: callback.tokenHash, type: callback.type });
  if (result.error) throw result.error;
  if (!result.data.session) throw new Error('Authentication link did not create a session');
  return { handled: true, recovery: callback.kind === 'tokens' ? callback.recovery : callback.kind === 'otp' && callback.type === 'recovery' };
}
