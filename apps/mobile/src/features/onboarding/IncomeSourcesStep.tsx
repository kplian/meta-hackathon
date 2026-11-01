import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Database } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

type Source = Database['budget']['Tables']['tincome_source']['Row'];
const frequencies = ['weekly', 'biweekly', 'monthly', 'yearly', 'variable'] as const;
type Frequency = typeof frequencies[number];
interface Props {
  householdId: string;
  userId: string;
  currency: string;
  members: { id: string; fullName: string }[];
  finishing: boolean;
  onFinish: () => Promise<void>;
  onBack: () => void;
}

export default function IncomeSourcesStep({ householdId, userId, currency, members, finishing, onFinish, onBack }: Props) {
  const { t, i18n } = useTranslation('onboarding');
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [memberId, setMemberId] = useState<string | null>(null);
  const busy = saving || finishing || loading;

  async function load() {
    setLoading(true); setLoadFailed(false); setError(null);
    const result = await supabase.schema('budget').from('tincome_source').select('*')
      .eq('household_id', householdId).eq('status', 'active').is('deleted_at', null).order('created_at');
    if (result.error) { setError(t('income.loadError')); setLoadFailed(true); }
    else setSources(result.data ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [householdId]);

  function reset() {
    setName(''); setAmount(''); setFrequency('monthly');
    setMemberId(null); setEditingId(null); setShowForm(false); setError(null);
  }
  async function save() {
    const normalized = amount.trim().replace(',', '.');
    if (!name.trim() || !/^\d+(\.\d{1,2})?$/.test(normalized) || !Number.isFinite(Number(normalized))) {
      setError(t('income.validation')); return;
    }
    setSaving(true); setError(null);
    try {
      const values = { household_id: householdId, household_member_id: memberId, name: name.trim(),
        estimated_amount: Number(normalized), currency, frequency };
      const result = editingId
        ? await supabase.schema('budget').from('tincome_source').update({ ...values, updated_at: new Date().toISOString(), updated_by: userId })
          .eq('id', editingId).eq('household_id', householdId).select('*').single()
        : await supabase.schema('budget').from('tincome_source').insert({ ...values, created_by: userId }).select('*').single();
      if (result.error) throw result.error;
      setSources((rows) => editingId ? rows.map((row) => row.id === editingId ? result.data : row) : [...rows, result.data]);
      reset();
    } catch { setError(t('saveError')); }
    finally { setSaving(false); }
  }
  async function remove(source: Source) {
    setSaving(true); setError(null);
    const result = await supabase.schema('budget').from('tincome_source')
      .update({ status: 'inactive', deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', source.id).eq('household_id', householdId).select('id').single();
    if (result.error) setError(t('saveError'));
    else { setSources((rows) => rows.filter((row) => row.id !== source.id)); if (editingId === source.id) reset(); }
    setSaving(false);
  }
  function edit(source: Source) {
    setEditingId(source.id); setName(source.name); setAmount(String(source.estimated_amount));
    setFrequency(source.frequency as Frequency);
    setMemberId(source.household_member_id); setShowForm(true); setError(null);
  }
  async function finish() {
    if (showForm && (name.trim() || amount.trim() || editingId)) { setError(t('income.unsaved')); return; }
    await onFinish();
  }
  const choice = (label: string, selected: boolean, action: () => void, key: string) => (
    <Pressable key={key} disabled={busy} onPress={action} accessibilityRole="button" accessibilityState={{ selected, disabled: busy }}
      className={`rounded-full border px-4 py-2 ${selected ? 'bg-pine border-pine' : 'bg-white border-[#D3E8DC]'}`}>
      <Text className={selected ? 'font-semibold text-white' : 'text-pine'}>{label}</Text>
    </Pressable>
  );
  const inputClass = 'mt-2 rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-4 py-3 text-base text-pine';
  return (
    <View className="mt-6 gap-4" testID="onboarding-income-sources">
      <View className="flex-row items-start gap-3 rounded-2xl bg-white p-4">
        <Ionicons name="information-circle-outline" size={22} color="#0B3D2E" />
        <Text className="flex-1 text-sm leading-5 text-sage">{t('income.note')}</Text>
      </View>
      {loading ? <ActivityIndicator color="#0B3D2E" /> : sources.map((source) => (
        <View key={source.id} className="rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-pine">{source.name}</Text>
          <Text className="mt-1 text-base font-semibold text-pine">{source.currency} {source.estimated_amount.toLocaleString(i18n.language)} · {t(`income.${source.frequency}`)}</Text>
          <Text className="mt-2 text-sm text-sage">{members.find((member) => member.id === source.household_member_id)?.fullName ?? t('income.general')}</Text>
          <View className="mt-3 flex-row gap-5">
            <Pressable disabled={busy} onPress={() => edit(source)} accessibilityRole="button" className="py-2"><Text className="font-semibold text-pine">{t('income.edit')}</Text></Pressable>
            <Pressable disabled={busy} onPress={() => void remove(source)} accessibilityRole="button" className="py-2"><Text className="text-red-700">{t('income.remove')}</Text></Pressable>
          </View>
        </View>
      ))}
      {!loading && !loadFailed && !showForm ? (
        <Pressable disabled={busy} onPress={() => setShowForm(true)} accessibilityRole="button" className="items-center rounded-2xl border border-[#D3E8DC] bg-white p-5">
          <Ionicons name="add-circle-outline" size={28} color="#0B3D2E" />
          <Text className="mt-2 font-bold text-pine">{t(sources.length ? 'income.addAnother' : 'income.configure')}</Text>
        </Pressable>
      ) : null}
      {showForm ? (
        <View className="rounded-3xl bg-white p-5">
          <Text className="text-lg font-bold text-pine">{t(editingId ? 'income.edit' : 'income.add')}</Text>
          <Text className="mt-5 font-semibold text-pine">{t('income.name')}</Text>
          <TextInput value={name} onChangeText={setName} maxLength={100} editable={!busy} accessibilityLabel={t('income.name')} placeholder={t('income.placeholder')} className={inputClass} />
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1"><Text className="font-semibold text-pine">{t('income.amount')}</Text>
              <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={18} editable={!busy} accessibilityLabel={t('income.amount')} placeholder="0.00" className={inputClass} /></View>
            <View className="w-24"><Text className="font-semibold text-pine">{t('income.currency')}</Text>
              <Text accessibilityLabel={t('income.currency')} className={inputClass}>{currency}</Text></View>
          </View>
          <Text className="mt-5 font-semibold text-pine">{t('income.frequency')}</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">{frequencies.map((value) => choice(t(`income.${value}`), frequency === value, () => setFrequency(value), value))}</View>
          <Text className="mt-5 font-semibold text-pine">{t('income.recipient')}</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {choice(t('income.general'), memberId === null, () => setMemberId(null), 'general')}
            {members.map((member) => choice(member.fullName, memberId === member.id, () => setMemberId(member.id), member.id))}
          </View>
          <Pressable disabled={busy} onPress={() => void save()} accessibilityRole="button" className="mt-5 items-center rounded-xl bg-mint py-3">
            {saving ? <ActivityIndicator color="#0B3D2E" /> : <Text className="font-bold text-pine">{t('income.save')}</Text>}
          </Pressable>
          <Pressable disabled={busy} onPress={reset} accessibilityRole="button" className="mt-2 items-center p-3"><Text className="text-sage">{t('income.cancel')}</Text></Pressable>
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text> : null}
      {loadFailed ? <Pressable onPress={() => void load()} accessibilityRole="button" className="p-3"><Text className="text-pine">{t('income.retry')}</Text></Pressable> : null}
      <Pressable disabled={busy || loadFailed} onPress={() => void finish()} accessibilityRole="button"
        className={`mt-4 items-center rounded-2xl bg-pine py-4 ${busy || loadFailed ? 'opacity-50' : ''}`}>
        {finishing ? <ActivityIndicator color="white" /> : <Text className="text-base font-bold text-white">{t(sources.length ? 'continue' : 'income.skip')}</Text>}
      </Pressable>
      <Pressable disabled={busy} onPress={onBack} accessibilityRole="button" className="items-center p-3"><Text className="font-semibold text-sage">{t('back')}</Text></Pressable>
    </View>
  );
}
