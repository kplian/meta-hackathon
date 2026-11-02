import CountryPicker from './CountryPicker';
import { detectCountry, supportedCountry, splitPhone, internationalPhone, type CountryCode } from './countries';
import './i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface Props { userId: string; householdCountry?: string | null; onboarding?: boolean; onContinue?: () => void }

export default function WhatsAppCard({ userId, householdCountry, onboarding = false, onContinue }: Props) {
  const { t } = useTranslation('whatsapp');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<CountryCode | undefined>(() => supportedCountry(householdCountry) ?? detectCountry());
  const [editing, setEditing] = useState(!onboarding);
  const [loading, setLoading] = useState(true);
  const [failedLoad, setFailedLoad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.schema('budget').from('tchannel').select('channel_code')
      .eq('user_id', userId).eq('channel_type', 'whatsapp').eq('status', 'active')
      .is('deleted_at', null).order('created_at', { ascending: false }).limit(1)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setFailedLoad(!!loadError);
        if (loadError) setError(t('error'));
        else {
          const existing = data?.[0]?.channel_code ?? '';
          const parts = splitPhone(existing, supportedCountry(householdCountry) ?? detectCountry());
          setPhone(parts.national); setCountry(parts.country);
          if (existing) setEditing(true);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, householdCountry, t]);

  async function save(remove = false) {
    const normalized = remove ? '' : internationalPhone(phone, country);
    if (normalized === undefined) { setError(t('invalid')); return; }
    setBusy(true); setError(''); setSaved(false);
    try {
      const result = await supabase.rpc('f_set_my_whatsapp', { p_phone: normalized });
      if (result.error) throw result.error;
      const parts = splitPhone(normalized, country);
      setPhone(parts.national); setCountry(parts.country); setSaved(!remove); onContinue?.();
    } catch { setError(t('error')); }
    finally { setBusy(false); }
  }
  return <View className="rounded-2xl bg-white p-5 gap-3">
    <Text className="text-lg font-bold text-pine">{t(onboarding ? 'question' : 'title')}</Text>
    {onboarding ? <Text className="text-sm text-sage">{t('help')}</Text> : null}
    {loading ? <ActivityIndicator color="#0B3D2E" /> : editing ? <>
      <Text className="font-semibold text-pine">{t('label')}</Text>
      <View className="flex-row items-start gap-2">
        <View style={{ maxWidth: '48%', flexShrink: 1 }}><CountryPicker value={country} disabled={busy || failedLoad} onChange={(value) => { setCountry(value); setSaved(false); }} /></View>
        <View style={{ flex: 1, minWidth: 100 }}>
      <TextInput value={phone} onChangeText={(value) => { setPhone(value); setSaved(false); }}
        editable={!busy && !failedLoad} keyboardType="phone-pad" autoComplete="tel" maxLength={30}
        accessibilityLabel={t('label')} placeholder={t('nationalPlaceholder')}
        className="rounded-xl border border-[#D3E8DC] px-4 py-3 text-pine" />
        </View>
      </View>
      <Text className="text-sm text-sage">{t('hint')}</Text>
      <Text className="text-xs text-sage">{t('status')}</Text>
      <Pressable accessibilityRole="button" disabled={busy || failedLoad} onPress={() => void save()}
        className={`rounded-xl bg-pine p-3 items-center ${busy || failedLoad ? 'opacity-50' : ''}`}>
        <Text className="font-bold text-white">{t('save')}</Text>
      </Pressable>
      {!onboarding && phone ? <Pressable disabled={busy || failedLoad} accessibilityRole="button" onPress={() => void save(true)}>
        <Text className="text-center text-red-700">{t('remove')}</Text>
      </Pressable> : null}
    </> : <Pressable disabled={busy || failedLoad} accessibilityRole="button" onPress={() => setEditing(true)} className="rounded-xl bg-pine p-3">
      <Text className="text-center font-bold text-white">{t('add')}</Text>
    </Pressable>}
    {error ? <Text accessibilityRole="alert" className="text-red-700">{error}</Text> : null}
    {saved ? <Text accessibilityRole="alert" className="text-pine">{t('saved')}</Text> : null}
    {onboarding ? <Pressable disabled={busy} accessibilityRole="button" onPress={onContinue} className="p-3">
      <Text className="text-center font-semibold text-sage">{t('later')}</Text>
    </Pressable> : null}
  </View>;
}
