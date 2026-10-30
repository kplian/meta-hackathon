import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const APP_SCHEME = 'aifamilybudget';

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

  const fragment = result.url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('Sign-in did not return a session.');
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
}

/** Email + password sign-in against Supabase Auth (real users). */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
}

/** Email + password sign-up. Households are created afterwards from the app or bot. */
export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
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
  const redirectTo = makeRedirectUri({ scheme: APP_SCHEME });
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
  const redirectTo = makeRedirectUri({ scheme: APP_SCHEME });
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
