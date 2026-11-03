import { makeRedirectUri } from 'expo-auth-session';
import appConfig from '../../app.json';
import * as WebBrowser from 'expo-web-browser';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Linking, Platform } from 'react-native';
import { applyAuthCallback, callbackMatchesApp, cleanAuthCallbackUrl } from '../features/auth-session/protocol';

WebBrowser.maybeCompleteAuthSession();

const APP_SCHEME = appConfig.expo.scheme;

/** Use the same allow-listed app root for email confirmation, recovery and OAuth. */
export function getAuthRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin + '/';
  return makeRedirectUri({ scheme: APP_SCHEME });
}
export async function initialAuthUrl() {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : await Linking.getInitialURL();
}
let pendingCallback: { url: string; result: ReturnType<typeof applyAuthCallback> } | null = null;
export async function completeAuthCallback(url: string) {
  if (!callbackMatchesApp(url, getAuthRedirectUri())) return { handled: false, recovery: false };
  if (pendingCallback?.url === url) return pendingCallback.result;
  const result = applyAuthCallback(supabase.auth, url);
  pendingCallback = { url, result };
  try { return await result; }
  finally {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && callbackMatchesApp(window.location.href, getAuthRedirectUri())) {
      const clean = cleanAuthCallbackUrl(window.location.href);
      window.history.replaceState(null, '', clean);
    }
    // Native Linking and the OAuth browser may deliver the same one-use callback.
    setTimeout(() => { if (pendingCallback?.result === result) pendingCallback = null; }, 30000);
  }
}
export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: getAuthRedirectUri() } });
  if (error) throw error;
}
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: getAuthRedirectUri() });
  if (error) throw error;
}
export async function changePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
}

/** OAuth/OIDC provider driving the "Continuar con ..." button (default: google). */
export function getOidcProvider(): Provider {
  const raw = process.env.EXPO_PUBLIC_SUPABASE_OIDC_PROVIDER?.trim().toLowerCase();
  return (raw || 'google') as Provider;
}

/** Human-readable label for the configured OIDC provider. */
export function getOidcProviderLabel(): string {
  const provider = getOidcProvider();
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** Whether organization SSO is configured (EXPO_PUBLIC_SUPABASE_SSO_DOMAIN). */
export function isSsoConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_SSO_DOMAIN?.trim());
}

/**
 * Completes an OAuth/SSO flow: opens the authorization URL in the system
 * browser and exchanges the returned tokens for a Supabase session.
 */
async function openBrowserSession(url: string, redirectTo: string): Promise<void> {
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (result.type !== 'success') {
    throw new Error('Sign-in was cancelled.');
  }

  const completed = await completeAuthCallback(result.url);
  if (!completed.handled) throw new Error('Sign-in did not return a session.');

}

/** Email + password sign-in against Supabase Auth (real users). */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
}

/** Email sign-up. The database creates a household unless a pending household invitation matches. */
export async function signUpWithEmail(email: string, password: string, name?: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(), password,
    options: { emailRedirectTo: getAuthRedirectUri(), ...(name?.trim() ? { data: { full_name: name.trim().slice(0, 100) } } : {}) },
  });
  if (error) throw error;
  return !data.session;
}

/**
 * Demo-mode sign-in using the shared demo account from env vars.
 * Create the matching user once in Supabase Studio (Authentication > Add user).
 */
export async function signInWithDemo(): Promise<void> {
  const email = process.env.EXPO_PUBLIC_DEMO_EMAIL;
  const password = process.env.EXPO_PUBLIC_DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error('Demo account is not configured (EXPO_PUBLIC_DEMO_EMAIL / EXPO_PUBLIC_DEMO_PASSWORD).');
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * OAuth sign-in with the provider from EXPO_PUBLIC_SUPABASE_OIDC_PROVIDER.
 * Requires that provider enabled in the Supabase dashboard with the app's
 * redirect URI allow-listed.
 */
export async function signInWithOidcProvider(): Promise<void> {
  const redirectTo = getAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: getOidcProvider(),
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  await openBrowserSession(data.url, redirectTo);
}

/**
 * Organization SSO sign-in using EXPO_PUBLIC_SUPABASE_SSO_DOMAIN.
 * Requires SSO configured for that domain in the Supabase dashboard.
 */
export async function signInWithSSO(): Promise<void> {
  const domain = process.env.EXPO_PUBLIC_SUPABASE_SSO_DOMAIN?.trim();
  if (!domain) {
    throw new Error('SSO is not configured (EXPO_PUBLIC_SUPABASE_SSO_DOMAIN).');
  }
  const redirectTo = getAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithSSO({
    domain,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  await openBrowserSession(data.url, redirectTo);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
