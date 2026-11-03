import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import './i18n';
export default function AddMemberForm({ householdId, onCreated }: { householdId: string; onCreated: () => Promise<void> }) {
  const { t } = useTranslation('householdAccess');
  const [name, setName] = useState(''); const [type, setType] = useState('other');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save() {
    if (!name.trim()) { setError(t('nameRequired')); return; }
    setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('f_add_household_member', { p_household_id: householdId, p_name: name.trim(), p_member_type: type });
      if (error) throw error;
      await onCreated();
    } catch { setError(t('error')); } finally { setBusy(false); }
  }
  return <View className="gap-3">
    <Text className="text-xl font-bold text-pine">{t('addMember')}</Text>
    <Text className="text-sm text-sage">{t('createFirst')}</Text>
    <Text className="font-semibold text-pine">{t('name')}</Text>
    <TextInput accessibilityLabel={t('name')} value={name} onChangeText={setName} maxLength={100} editable={!busy} autoCapitalize="words" className="rounded-xl border border-[#D3E8DC] p-3 text-pine" />
    <Text className="font-semibold text-pine">{t('type')}</Text>
    <View className="flex-row flex-wrap gap-2">{['dad','mom','son','other'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === type }} disabled={busy} onPress={() => setType(value)} className={`rounded-xl p-3 ${value === type ? 'bg-pine' : 'bg-[#F4FAF6]'}`}><Text className={value === type ? 'text-white' : 'text-pine'}>{t(value)}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} className="rounded-xl bg-pine p-3">{busy ? <ActivityIndicator color="white" /> : <Text className="text-center font-bold text-white">{t('addMember')}</Text>}</Pressable>
    {error ? <Text accessibilityRole="alert" className="text-red-700">{error}</Text> : null}
  </View>;
}
