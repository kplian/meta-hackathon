import CountryPicker from './CountryPicker';
import { detectCountry, supportedCountry, splitPhone, internationalPhone, type CountryCode } from './countries';
import './i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import VerificationQr from './VerificationQr';
import { linkExpired, whatsappLink, type VerificationLink } from './verification';

interface Props { userId: string; householdCountry?: string | null; onboarding?: boolean; onContinue?: () => void }
type Status = { phone?: string | null; verified?: boolean };
type BeginResult = Partial<VerificationLink> & { success?: boolean; verified?: boolean; error?: string };

export default function WhatsAppCard({ userId, householdCountry, onboarding = false, onContinue }: Props) {
  const { t, i18n } = useTranslation('whatsapp');
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<CountryCode | undefined>(() => supportedCountry(householdCountry) ?? detectCountry());
  const [editing, setEditing] = useState(!onboarding);
  const [loading, setLoading] = useState(true);
  const [loadedUser, setLoadedUser] = useState('');
  const [failedLoad, setFailedLoad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState<VerificationLink | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('f_my_whatsapp_verification').then(({ data, error: loadError }) => {
      if (cancelled) return;
      setLoadedUser(userId); setPending(null); setError(''); setVerified(false);
      setFailedLoad(!!loadError);
      if (loadError) setError(t('error'));
      else {
        const status = data as Status | null;
        const parts = splitPhone(status?.phone ?? '', supportedCountry(householdCountry) ?? detectCountry());
        setPhone(parts.national); setCountry(parts.country); setVerified(status?.verified === true);
        if (status?.phone) setEditing(true);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId, householdCountry, t]);

  useEffect(() => {
    if (!pending || verified) return;
    let cancelled = false; let checking = false;
    async function check() {
      if (linkExpired(pending!)) { if (!cancelled) setExpired(true); return; }
      if (checking) return;
      checking = true;
      const { data, error: statusError } = await supabase.rpc('f_my_whatsapp_verification');
      checking = false;
      if (cancelled || statusError) return;
      const status = data as Status | null;
      if (status?.verified && status.phone === internationalPhone(phone, country)) {
        setVerified(true); setPending(null); setError('');
      }
    }
    const timer = setInterval(() => void check(), 4000);
    void check();
    return () => { cancelled = true; clearInterval(timer); };
  }, [pending, verified, phone, country]);

  function changed() { setVerified(false); setPending(null); setExpired(false); setError(''); }
  async function begin() {
    const normalized = internationalPhone(phone, country);
    if (!normalized) { setError(t('invalid')); return; }
    setBusy(true); setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('f_begin_whatsapp_verification', { p_phone: normalized, p_locale: i18n.language.split('-')[0] });
      if (rpcError) throw rpcError;
      const result = data as BeginResult;
      if (!result.success) { setError(t(result.error === 'RATE_LIMITED' ? 'rateLimited' : 'error')); return; }
      if (result.verified) { setVerified(true); setPending(null); return; }
      if (!result.message || !result.bot_phone || !result.expires_at) throw Error('Invalid verification response');
      setPending({ message: result.message, bot_phone: result.bot_phone, expires_at: result.expires_at }); setExpired(false);
    } catch { setError(t('error')); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('f_set_my_whatsapp', { p_phone: '' });
      if (rpcError) throw rpcError;
      setPhone(''); changed();
    } catch { setError(t('error')); }
    finally { setBusy(false); }
  }
  async function open(web = false) {
    if (!pending || linkExpired(pending)) { setExpired(true); return; }
    try { await Linking.openURL(whatsappLink(pending, web)); } catch { setError(t('openError')); }
  }
  return <View className="rounded-2xl bg-white p-5 gap-3">
    <Text className="text-lg font-bold text-pine">{t(onboarding ? 'question' : 'title')}</Text>
    {onboarding ? <Text className="text-sm text-sage">{t('help')}</Text> : null}
    {loading || loadedUser !== userId ? <ActivityIndicator color="#0B3D2E" /> : editing ? <>
      <Text className="font-semibold text-pine">{t('label')}</Text>
      <View className="flex-row items-start gap-2">
        <View style={{ maxWidth: '48%', flexShrink: 1 }}><CountryPicker value={country} disabled={busy || failedLoad} onChange={(value) => { setCountry(value); changed(); }} /></View>
        <View style={{ flex: 1, minWidth: 100 }}>
          <TextInput value={phone} onChangeText={(value) => { setPhone(value); changed(); }} editable={!busy && !failedLoad}
            keyboardType="phone-pad" autoComplete="tel" maxLength={30} accessibilityLabel={t('label')} placeholder={t('nationalPlaceholder')}
            className="rounded-xl border border-[#D3E8DC] px-4 py-3 text-pine" />
        </View>
      </View>
      <Text className="text-sm text-sage">{t('hint')}</Text>
      {verified ? <View className="rounded-xl bg-[#EAF5EF] p-4 gap-2">
        <Text accessibilityRole="alert" className="font-bold text-pine">{t('verified')}</Text>
        <Text className="text-sm text-pine">{t('verifiedHelp')}</Text>
        {onboarding ? <Pressable accessibilityRole="button" onPress={onContinue} className="rounded-xl bg-pine p-3"><Text className="text-center font-bold text-white">{t('continue')}</Text></Pressable> : null}
      </View> : pending && !expired ? <View className="rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] p-4 gap-3">
        <Text className="font-bold text-pine">{t('instructionsTitle')}</Text>
        <Text className="text-sm text-pine">{t(desktop ? 'desktopInstructions' : 'mobileInstructions')}</Text>
        {desktop ? <VerificationQr value={whatsappLink(pending)} label={t('qrLabel')} /> : null}
        <Text className="text-sm font-semibold text-pine">{t('senderReminder', { phone: internationalPhone(phone, country) })}</Text>
        <Pressable accessibilityRole="button" onPress={() => void open()} className="rounded-xl bg-pine p-3"><Text className="text-center font-bold text-white">{t('openWhatsApp')}</Text></Pressable>
        {desktop ? <Pressable accessibilityRole="button" onPress={() => void open(true)} className="p-2"><Text className="text-center font-semibold text-pine">{t('openWeb')}</Text></Pressable> : null}
        <Text className="text-xs text-sage">{t('waiting')}</Text>
        <Text className="text-xs text-sage">{t('expires')}</Text>
        <Text className="text-xs text-sage">{t('manual', { phone: `+${pending.bot_phone}` })}</Text>
        <Text selectable className="text-xs text-pine" style={{ flexShrink: 1 }}>{pending.message}</Text>
      </View> : <>
        <Text className="text-sm text-sage">{t(expired ? 'expired' : 'status')}</Text>
        <Pressable accessibilityRole="button" disabled={busy || failedLoad} onPress={() => void begin()}
          className={`rounded-xl bg-pine p-3 items-center ${busy || failedLoad ? 'opacity-50' : ''}`}>
          {busy ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">{t(expired ? 'newCode' : 'verify')}</Text>}
        </Pressable>
      </>}
      {!onboarding && phone ? <Pressable disabled={busy || failedLoad} accessibilityRole="button" onPress={() => void remove()} className="p-2"><Text className="text-center text-red-700">{t('remove')}</Text></Pressable> : null}
    </> : <Pressable disabled={busy || failedLoad} accessibilityRole="button" onPress={() => setEditing(true)} className="rounded-xl bg-pine p-3"><Text className="text-center font-bold text-white">{t('add')}</Text></Pressable>}
    {error ? <Text accessibilityRole="alert" className="text-red-700">{error}</Text> : null}
    {onboarding && !verified ? <Pressable disabled={busy} accessibilityRole="button" onPress={onContinue} className="p-3"><Text className="text-center font-semibold text-sage">{t('later')}</Text></Pressable> : null}
  </View>;
}
