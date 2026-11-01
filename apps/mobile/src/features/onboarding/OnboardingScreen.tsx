import './i18n';
import IncomeSourcesStep from './IncomeSourcesStep';
import AssetsStep from './AssetsStep';
import PyramidStep from './PyramidStep';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { HouseholdRow, HouseholdMemberRow } from '../../lib/budget-schema';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';

type MemberType = 'dad' | 'mom' | 'son' | 'other';
type Member = HouseholdMemberRow & { fullName: string };
const memberTypes: MemberType[] = ['dad', 'mom', 'son', 'other'];

interface Props {
  household: HouseholdRow | null;
  userId: string;
  onComplete: () => void;
}

export default function OnboardingScreen({ household, userId, onComplete }: Props) {
  const { t } = useTranslation('onboarding');
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [householdId, setHouseholdId] = useState(household?.id ?? null);
  const [name, setName] = useState(household?.name ?? '');
  const [currency, setCurrency] = useState(household?.currency?.trim() || 'BOB');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberName, setMemberName] = useState('');
  const [memberType, setMemberType] = useState<MemberType>('other');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMembers(id: string) {
    const result = await supabase.schema('budget').from('thousehold_member')
      .select('*, tuser!thousehold_member_user_id_fkey(full_name)')
      .eq('household_id', id).eq('status', 'active').is('deleted_at', null)
      .order('created_at');
    if (result.error) throw result.error;
    setMembers((result.data ?? []).map((row) => ({
      ...row, fullName: row.tuser?.full_name ?? t('member'),
    })).sort((a, b) => Number(b.user_id === userId) - Number(a.user_id === userId)));
  }

  useEffect(() => {
    if (step !== 2 || !householdId) return;
    let cancelled = false;
    setLoading(true);
    loadMembers(householdId).catch(() => {
      if (!cancelled) setError(t('loadError'));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [step, householdId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (err) {
      setError(err && typeof err === 'object' && 'message' in err
        ? String(err.message) : t('saveError'));
    }
    finally { setBusy(false); }
  }

  async function saveName() {
    if (!name.trim()) { setError(t('nameRequired')); return; }
    if (!/^[A-Z]{3}$/.test(currency.trim())) { setError(t('currencyInvalid')); return; }
    await run(async () => {
      if (householdId) {
        const result = await supabase.schema('budget').from('thousehold')
          .update({ name: name.trim(), currency: currency.trim(), updated_at: new Date().toISOString(), updated_by: userId })
          .eq('id', householdId).select('id').single();
        if (result.error) throw result.error;
      } else {
        const result = await supabase.rpc('f_create_household', { p_name: name.trim(), p_currency: currency.trim(), p_user_id: userId });
        if (result.error) throw result.error;
        const data = result.data as { success: boolean; household_id: string; message?: string };
        if (!data.success) throw new Error(data.message ?? t('saveError'));
        setHouseholdId(data.household_id);
      }
      setStep(2);
    });
  }

  async function addMember() {
    if (!householdId || !memberName.trim()) { setError(t('memberNameRequired')); return; }
    await run(async () => {
      const result = await supabase.rpc('f_add_household_member', {
        p_household_id: householdId, p_name: memberName.trim(), p_member_type: memberType,
      });
      if (result.error) throw result.error;
      setMemberName('');
      setMemberType('other');
      await loadMembers(householdId);
    });
  }

  async function updateType(member: Member, value: MemberType) {
    await run(async () => {
      const result = await supabase.schema('budget').from('thousehold_member')
        .update({ member_type: value, updated_at: new Date().toISOString(), updated_by: userId })
        .eq('id', member.id).select('id').single();
      if (result.error) throw result.error;
      setMembers((rows) => rows.map((row) => row.id === member.id ? { ...row, member_type: value } : row));
    });
  }

  function continueToIncome() {
    if (memberName.trim()) { setError(t('unsavedMember')); return; }
    if (loading || !members.length) return;
    setError(null);
    setStep(3);
  }

  async function finish() {
    if (!householdId || loading || !members.length) return;
    if (memberName.trim()) { setError(t('unsavedMember')); return; }
    await run(async () => {
      const result = await supabase.schema('budget').from('thousehold')
        .update({ setup_completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: userId })
        .eq('id', householdId).select('id').single();
      if (result.error) throw result.error;
      onComplete();
    });
  }

  const typePicker = (value: string, onChange: (type: MemberType) => void) => (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {memberTypes.map((type) => (
        <Pressable key={type} disabled={busy} onPress={() => onChange(type)} accessibilityRole="button"
          accessibilityState={{ selected: value === type, disabled: busy }}
          className={`rounded-full border px-4 py-2 ${value === type ? 'bg-pine border-pine' : 'bg-white border-[#D3E8DC]'}`}>
          <Text className={value === type ? 'font-semibold text-white' : 'text-pine'}>{t(`${type}`)}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-mint" testID="onboarding-screen">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow px-6 py-8">
        <View className={`w-full self-center ${step === 5 ? 'max-w-3xl' : 'max-w-xl'}`}>
          <View className="mb-8 flex-row items-center justify-between">
            <Text className="text-xl font-extrabold text-pine">Budget</Text>
            <Pressable disabled={busy} onPress={() => void signOut()} accessibilityRole="button">
              <Text className="text-sm text-sage">{t('signOut')}</Text>
            </Pressable>
          </View>
          <View className="mb-8 flex-row gap-2">
            {[1, 2, 3, 4, 5].map(value => <View key={value} className={`h-1.5 flex-1 rounded-full ${step >= value ? 'bg-pine' : 'bg-[#CCDFD3]'}`} />)}
          </View>
          <Text className="text-xs font-bold uppercase tracking-widest text-sage">{t('step', { step })}</Text>
          <Text className="mt-3 text-3xl font-extrabold text-pine">{t(step === 1 ? 'homeTitle' : step === 2 ? 'membersTitle' : step === 3 ? 'income.title' : step === 4 ? 'assets.title' : 'pyramid.title')}</Text>
          <Text className="mt-3 text-base leading-6 text-sage">{t(step === 1 ? 'homeSubtitle' : step === 2 ? 'membersSubtitle' : step === 3 ? 'income.subtitle' : step === 4 ? 'assets.subtitle' : 'pyramid.subtitle')}</Text>
          {step === 1 ? (
            <View className="mt-8 rounded-3xl bg-white p-6">
              <Ionicons name="home-outline" size={32} color="#0B3D2E" />
              <Text className="mb-2 mt-5 font-semibold text-pine">{t('homeName')}</Text>
              <TextInput value={name} onChangeText={setName} maxLength={100} editable={!busy}
                accessibilityLabel={t('homeName')} placeholder={t('homePlaceholder')}
                className="rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-4 py-3 text-base text-pine" />
              <Text className="mb-2 mt-6 font-semibold text-pine">{t('homeCurrency')}</Text>
              <Text className="mb-3 text-sm leading-5 text-sage">{t('currencyHelp')}</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {['BOB', 'USD', 'EUR', 'PEN', 'CLP', 'ARS', 'BRL', 'COP', 'MXN'].map((code) => (
                  <Pressable key={code} disabled={busy} onPress={() => setCurrency(code)}
                    accessibilityRole="button" accessibilityState={{ selected: currency === code, disabled: busy }}
                    className={`rounded-full border px-4 py-2 ${currency === code ? 'bg-pine border-pine' : 'border-[#D3E8DC] bg-white'}`}>
                    <Text className={currency === code ? 'font-semibold text-white' : 'text-pine'}>{code}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={currency} onChangeText={(value) => setCurrency(value.toUpperCase())}
                autoCapitalize="characters" autoCorrect={false} maxLength={3} editable={!busy}
                accessibilityLabel={t('homeCurrency')} placeholder="BOB"
                className="rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-4 py-3 text-base text-pine" />
            </View>
          ) : step === 2 ? (
            <View className="mt-6 gap-4">
              <Text className="font-semibold text-pine">{name.trim()}</Text>
              {loading ? <ActivityIndicator color="#0B3D2E" /> : members.map((member) => (
                <View key={member.id} className="rounded-2xl bg-white p-5">
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-mint">
                      <Ionicons name="person-outline" size={20} color="#0B3D2E" />
                    </View>
                    <Text className="flex-1 text-base font-bold text-pine">{member.fullName}{member.user_id === userId ? ` (${t('you')})` : ''}</Text>
                  </View>
                  {typePicker(member.member_type, (type) => void updateType(member, type))}
                </View>
              ))}
              <View className="rounded-3xl border border-[#D3E8DC] bg-white p-5">
                <Text className="mb-3 text-lg font-bold text-pine">{t('addMember')}</Text>
                <TextInput value={memberName} onChangeText={setMemberName} maxLength={100} editable={!busy}
                  accessibilityLabel={t('memberName')} placeholder={t('memberName')}
                  className="rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-4 py-3 text-base text-pine" />
                {typePicker(memberType, setMemberType)}
                <Pressable disabled={busy || loading} onPress={() => void addMember()} accessibilityRole="button" className="mt-4 items-center rounded-xl bg-mint py-3">
                  <Text className="font-bold text-pine">+ {t('addMember')}</Text>
                </Pressable>
              </View>
            </View>
          ) : householdId ? (
            step === 3 ? <IncomeSourcesStep householdId={householdId} userId={userId}
              currency={currency.trim()} members={members} finishing={busy}
              onFinish={() => { setError(null); setStep(4); return Promise.resolve(); }} onBack={() => { setStep(2); setError(null); }} />
              : step === 4 ? <AssetsStep householdId={householdId} currency={currency.trim()} finishing={busy}
                onFinish={() => { setError(null); setStep(5); return Promise.resolve(); }}
                onBack={() => { setStep(3); setError(null); }} />
              : <PyramidStep householdId={householdId} currency={currency.trim()} finishing={busy} onFinish={finish}
                onBack={() => { setStep(4); setError(null); }} onEditIncome={() => { setStep(3); setError(null); }} />
          ) : null}
          {error ? <Text accessibilityRole="alert" className="mt-4 text-sm text-red-700">{error}</Text> : null}
          {step < 3 ? <Pressable disabled={busy || loading} onPress={() => void (step === 1 ? saveName() : continueToIncome())}
            accessibilityRole="button" className={`mt-8 items-center rounded-2xl bg-pine py-4 ${busy || loading ? 'opacity-50' : ''}`}>
            {busy ? <ActivityIndicator color="white" /> : <Text className="text-base font-bold text-white">{t('continue')}</Text>}
          </Pressable> : null}
          {step === 2 ? <Pressable disabled={busy} onPress={() => { setStep(1); setError(null); }} accessibilityRole="button" className="mt-3 items-center p-3">
            <Text className="font-semibold text-sage">{t('back')}</Text>
          </Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
