import './i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface Props { userId: string; onboarding?: boolean; onContinue?: () => void }

export default function WhatsAppCard({ userId, onboarding = false, onContinue }: Props) {
  const { t } = useTranslation('whatsapp');
  const [phone, setPhone] = useState('');
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
        else { setPhone(data?.[0]?.channel_code ?? ''); if (data?.length) setEditing(true); }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, t]);

  async function save(remove = false) {
    const normalized = remove ? '' : phone.replace(/[\s().-]/g, '');
    if (!remove && !/^\+[1-9]\d{7,14}$/.test(normalized)) { setError(t('invalid')); return; }
    setBusy(true); setError(''); setSaved(false);
    try {
      const result = await supabase.rpc('f_set_my_whatsapp', { p_phone: normalized });
      if (result.error) throw result.error;
      setPhone(normalized); setSaved(!remove); onContinue?.();
    } catch { setError(t('error')); }
    finally { setBusy(false); }
  }
  return <View className="rounded-2xl bg-white p-5 gap-3">
    <Text className="text-lg font-bold text-pine">{t(onboarding ? 'question' : 'title')}</Text>
    {onboarding ? <Text className="text-sm text-sage">{t('help')}</Text> : null}
    {loading ? <ActivityIndicator color="#0B3D2E" /> : editing ? <>
      <Text className="font-semibold text-pine">{t('label')}</Text>
      <TextInput value={phone} onChangeText={(value) => { setPhone(value); setSaved(false); }}
        editable={!busy && !failedLoad} keyboardType="phone-pad" autoComplete="tel" maxLength={30}
        accessibilityLabel={t('label')} placeholder="+59171234567"
        className="rounded-xl border border-[#D3E8DC] px-4 py-3 text-pine" />
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
