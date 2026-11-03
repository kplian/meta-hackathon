import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { pendingInvitationToken, clearInvitation } from './storage';
import './i18n';
type Invitation = { id: string; household_name: string; expires_at: string };
export default function InvitationGate({ session, token, children }: { session: Session; token: string | null; children: (householdId?: string) => ReactNode }) {
  const { t } = useTranslation('householdAccess');
  const [ready, setReady] = useState(false); const [invites, setInvites] = useState<Invitation[]>([]);
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [canSkip, setCanSkip] = useState(false); const [skipped, setSkipped] = useState(false); const [selected, setSelected] = useState<string>();
  const load = useCallback(async () => {
    const stored = await pendingInvitationToken();
    let warning = '';
    if (stored) {
      const { data, error } = await supabase.rpc('f_inspect_household_invitation', { p_token: stored });
      if (error) throw error;
      const status = (data as { status: string }).status;
      if (status === 'invalid' || status === 'wrong_email') warning = status === 'invalid' ? 'invalid' : 'wrongEmail';
      else if (status === 'accepted') await clearInvitation();
    }
    const { data, error } = await supabase.rpc('f_my_household_invitations'); if (error) throw error;
    const { data: home, error: homeError } = await supabase.rpc('f_ensure_my_household'); if (homeError) throw homeError;
    return { invitations: data as unknown as Invitation[], warning, home: home as string | null };
  }, []);
  const apply = useCallback((result: Awaited<ReturnType<typeof load>>) => { setInvites(result.invitations); setNotice(result.warning); setCanSkip(!!result.home); setReady(true); }, []);
  useEffect(() => {
    let cancelled = false;
    load().then(result => { if (!cancelled) apply(result); }).catch(() => { if (!cancelled) { setError('error'); setReady(true); } });
    return () => { cancelled = true; };
  }, [load, apply, token, session.user.id]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); try { await action(); } catch (err) { setError(err instanceof Object && 'message' in err && String(err.message).includes('VERIFIED_EMAIL_REQUIRED') ? 'verifiedEmail' : 'error'); } finally { setBusy(false); }
  }
  async function accept(id: string) {
    const { data, error } = await supabase.rpc('f_accept_household_invitation', { p_invitation_id: id }); if (error) throw error;
    await clearInvitation(); setSelected(data as string); setInvites([]); setNotice(''); setSkipped(true);
  }
  async function decline(id: string) {
    const { error } = await supabase.rpc('f_decline_household_invitation', { p_invitation_id: id }); if (error) throw error;
    await clearInvitation(); apply(await load());
  }
  if (ready && !error && ((!notice && !invites.length) || skipped)) return <>{children(selected)}</>;
  return <View className="flex-1 bg-mint"><ScrollView contentContainerClassName="flex-grow justify-center p-5"><View className="rounded-2xl bg-white p-6 gap-4 w-full max-w-xl self-center">
    {!ready ? <><ActivityIndicator color="#0B3D2E" /><Text className="text-pine">{t('loading')}</Text></> : <>
      <Text className="text-xl font-bold text-pine">{t('invitations')}</Text>
      {notice ? <Text accessibilityRole="alert" className="text-pine">{t(notice)}</Text> : null}
      {invites.map(invite => <View key={invite.id} className="rounded-xl border border-[#D3E8DC] p-4 gap-3">
        <Text className="text-lg font-bold text-pine">{invite.household_name}</Text><Text className="text-sm text-sage">{t('joinHelp')}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => accept(invite.id))} className="rounded-xl bg-pine p-3"><Text className="text-center font-bold text-white">{t('accept')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => decline(invite.id))} className="p-3"><Text className="text-center text-sage">{t('decline')}</Text></Pressable>
      </View>)}
      {error ? <Text accessibilityRole="alert" className="text-red-700">{t(error)}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { await supabase.auth.refreshSession(); apply(await load()); })} className="p-3"><Text className="text-center font-semibold text-pine">{t('refresh')}</Text></Pressable>
      {canSkip ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { await clearInvitation(); setNotice(''); setSkipped(true); })} className="p-3"><Text className="text-center text-pine">{t('dismiss')}</Text></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { await clearInvitation(); await signOut(); })} className="p-3"><Text className="text-center text-sage">{t('switchAccount')}</Text></Pressable>
    </>}
  </View></ScrollView></View>;
}
