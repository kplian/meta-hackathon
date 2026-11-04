import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { completeAuthCallback, initialAuthUrl } from '../lib/auth';
import { authErrorKey } from '../features/auth-session/protocol';
const RECOVERY_KEY = 'auth.pendingPasswordRecovery';

/** Complete email/OAuth links before displaying the login screen or household. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const clearAuthError = useCallback(() => setAuthError(''), []);
  const finishRecovery = useCallback(async () => { await AsyncStorage.removeItem(RECOVERY_KEY); setRecovery(false); }, []);
  useEffect(() => {
    let cancelled = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setRecovery(false); setAuthError(''); void AsyncStorage.removeItem(RECOVERY_KEY).catch(() => {}); }
    });
    async function consume(url: string | null) {
      if (!url) return;
      const result = await completeAuthCallback(url);
      if (!cancelled && result.handled) {
        setAuthError('');
        if (result.recovery) {
          const { data } = await supabase.auth.getSession();
          if (data.session) await AsyncStorage.setItem(RECOVERY_KEY, data.session.user.id);
          if (!cancelled) setRecovery(true);
        }
      }
    }
    async function initialize() {
      try { await consume((await initialAuthUrl()) ?? null); }
      catch (error) { if (!cancelled) setAuthError(authErrorKey(error)); }
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!cancelled) { setSession(data.session); const recoveryOwner = await AsyncStorage.getItem(RECOVERY_KEY); if (!cancelled) setRecovery(!!data.session && recoveryOwner === data.session.user.id); }
      } catch (error) { if (!cancelled) setAuthError(authErrorKey(error)); }
      finally { if (!cancelled) setLoading(false); }
    }
    const incoming = Linking.addEventListener('url', ({ url }) => { void consume(url).catch(error => { if (!cancelled) setAuthError(authErrorKey(error)); }); });
    const webReturn = () => { void consume(window.location.href).catch(error => { if (!cancelled) setAuthError(authErrorKey(error)); }); };
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('hashchange', webReturn);
    void initialize();
    return () => { cancelled = true; listener.subscription.unsubscribe(); incoming.remove(); if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('hashchange', webReturn); };
  }, []);
  return { session, loading, authError, clearAuthError, recovery, finishRecovery };
}
