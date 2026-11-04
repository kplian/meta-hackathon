import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { shareableInvitation } from './storage';
import './i18n';
export type MemberInvitation = { id: string; email: string; expires_at: string; member_id: string | null };
type ShareLink = { id: string; token: string; email: string; expires_at: string };
export default function MemberInvitationForm({ householdId, memberId, memberName, invitations, onChanged }: {
  householdId: string; memberId: string; memberName: string; invitations: MemberInvitation[]; onChanged: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation('householdAccess');
  const pending = invitations[0];
  const [email, setEmail] = useState(''); const [shared, setShared] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!pending?.id) return;
    let cancelled = false;
    supabase.rpc('f_get_household_invitation_link', { p_invitation_id: pending.id }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setError(t('error')); return; }
      setShared(data as ShareLink); setError(''); setCopied(false);
    });
    return () => { cancelled = true; };
  }, [pending?.id, reload, t]);
  const current = shared && (!pending || shared.id === pending.id) ? shared : null;
  let link = ''; let linkError = false;
  if (current) { try { link = shareableInvitation(current.token); } catch { linkError = true; } }
  async function create() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t('invalidEmail')); return; }
    setBusy(true); setError(''); setCopied(false);
    try {
      shareableInvitation('0'.repeat(64));
      const { data, error } = await supabase.rpc('f_create_household_invitation', { p_household_id: householdId, p_email: email.trim().toLowerCase(), p_member_id: memberId });
      if (error) throw error;
      setShared({ ...(data as Omit<ShareLink, 'email'>), email: email.trim().toLowerCase() });
      await onChanged();
    } catch (err) { setError(t(err instanceof Error && err.message === 'APP_URL_REQUIRED' ? 'appUrl' : 'error')); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('f_revoke_household_invitation', { p_invitation_id: id });
      if (error) throw error;
      await onChanged(); setShared(null);
    } catch { setError(t('error')); } finally { setBusy(false); }
  }
  async function copy() { if (!current || !link) return; try { await Clipboard.setStringAsync(t('shareText', { email: current.email, url: link })); setCopied(true); } catch { setError(t('error')); } }
  async function share() { if (!current || !link) return; try { await Share.share({ message: t('shareText', { email: current.email, url: link }) }); } catch { setError(t('error')); } }
  return <View className="gap-3">
    <Text className="text-lg font-bold text-pine">{t('inviteMember', { name: memberName })}</Text>
    <Text className="text-sm text-sage">{t('preserves')}</Text>
    {!pending && !current ? <>
      <Text className="text-sm font-semibold text-pine">{t('email')}</Text>
      <TextInput accessibilityLabel={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} className="rounded-xl border border-[#D3E8DC] p-3 text-pine" />
      <Text className="text-sm text-sage">{t('emailHelp')}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void create()} className={`rounded-xl bg-pine p-3 ${busy ? 'opacity-50' : ''}`}><Text className="text-center font-bold text-white">{t('create')}</Text></Pressable>
    </> : <>
      <Text className="font-semibold text-pine">{t('pendingMember')}</Text>
      <Text className="text-pine">{current?.email || pending?.email}</Text>
      {link ? <View className="rounded-xl bg-[#F4FAF6] p-4 gap-3">
        <Text className="text-sm text-sage">{t('existingLink')}</Text>
        <Text selectable accessibilityLabel={t('invitationLink')} className="text-xs text-pine">{link}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void copy()} className="rounded-xl bg-pine p-3"><Text className="text-center font-bold text-white">{t(copied ? 'copied' : 'copy')}</Text></Pressable>
        {Platform.OS !== 'web' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void share()} className="p-3"><Text className="text-center font-semibold text-pine">{t('share')}</Text></Pressable> : null}
        <Text className="text-sm text-sage">{t('expiresOn', { date: new Date(current!.expires_at).toLocaleString(i18n.language) })}</Text>
        {/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(link) ? <Text className="text-sm text-sage">{t('localWarning')}</Text> : null}
      </View> : !error && !linkError ? <ActivityIndicator color="#0B3D2E" /> : null}
      {pending ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void revoke(pending.id)} className="p-3"><Text className="text-center text-red-700">{t('revoke')}</Text></Pressable> : null}
    </>}
    {linkError ? <Text accessibilityRole="alert" className="text-red-700">{t('appUrl')}</Text> : null}
    {error ? <><Text accessibilityRole="alert" className="text-red-700">{error}</Text>{pending ? <Pressable accessibilityRole="button" onPress={() => { setError(''); setReload(value => value + 1); }} className="p-3"><Text className="text-center text-pine">{t('reloadLink')}</Text></Pressable> : null}</> : null}
  </View>;
}
