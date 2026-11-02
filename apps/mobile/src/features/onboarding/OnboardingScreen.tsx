import './i18n';
import IncomeSourcesStep from './IncomeSourcesStep';
import AssetsStep from './AssetsStep';
import PyramidStep from './PyramidStep';
import HealthStep from './HealthStep';
import MealPlanStep from './MealPlanStep';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { HouseholdRow, HouseholdMemberRow } from '../../lib/budget-schema';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';

type StepId = 'home' | 'members' | 'healthAsk' | 'health' | 'income' | 'assets' | 'pyramid' | 'mealPlan';
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
  const [step, setStep] = useState<StepId>('home');
  const [healthOptIn, setHealthOptIn] = useState<boolean | null>(() => {
    const prefs = (household?.preferences ?? {}) as Record<string, unknown>;
    return typeof prefs.health_opt_in === 'boolean' ? prefs.health_opt_in : null;
  });
  const [householdId, setHouseholdId] = useState(household?.id ?? null);
  const [name, setName] = useState(household?.name ?? '');
  const [currency, setCurrency] = useState(household?.currency?.trim() || 'BOB');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberName, setMemberName] = useState('');
  const [memberType, setMemberType] = useState<MemberType>('other');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps: StepId[] = ['home', 'members', 'healthAsk', ...(healthOptIn ? ['health' as const] : []), 'income', 'assets', 'pyramid', ...(healthOptIn ? ['mealPlan' as const] : [])];
  const stepIndex = steps.indexOf(step);
  const go = (offset: number) => { setError(null); setStep(steps[Math.min(steps.length - 1, Math.max(0, stepIndex + offset))]); };
  const wide = step === 'pyramid' || step === 'mealPlan';
  const copy: Record<StepId, [string, string]> = {
    home: ['homeTitle', 'homeSubtitle'],
    members: ['membersTitle', 'membersSubtitle'],
    healthAsk: ['healthAsk.title', 'healthAsk.subtitle'],
    health: ['health.title', 'health.subtitle'],
    income: ['income.title', 'income.subtitle'],
    assets: ['assets.title', 'assets.subtitle'],
    pyramid: ['pyramid.title', 'pyramid.subtitle'],
    mealPlan: ['mealPlan.title', 'mealPlan.subtitle'],
  };

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
    if (step !== 'members' || !householdId) return;
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
      setStep('members');
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

  function continueFromMembers() {
    if (memberName.trim()) { setError(t('unsavedMember')); return; }
    if (loading || !members.length) return;
    go(1);
  }

  async function chooseHealth(value: boolean) {
    if (!householdId) return;
    const id = householdId;
    await run(async () => {
      const r = await supabase.rpc('f_set_household_preference', { p_household_id: id, p_key: 'health_opt_in', p_value: value });
      if (r.error) throw r.error;
      setHealthOptIn(value);
      setStep(value ? 'health' : 'income');
    });
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
        <View className={`w-full self-center ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
          <View className="mb-8 flex-row items-center justify-between">
            <Text className="text-xl font-extrabold text-pine">Budget</Text>
            <Pressable disabled={busy} onPress={() => void signOut()} accessibilityRole="button">
              <Text className="text-sm text-sage">{t('signOut')}</Text>
            </Pressable>
          </View>
          <View className="mb-8 flex-row gap-2">
            {steps.map((id, i) => <View key={id} className={`h-1.5 flex-1 rounded-full ${stepIndex >= i ? 'bg-pine' : 'bg-[#CCDFD3]'}`} />)}
          </View>
          <Text className="text-xs font-bold uppercase tracking-widest text-sage">{t('step', { step: stepIndex + 1, total: steps.length })}</Text>
          <Text className="mt-3 text-3xl font-extrabold text-pine">{t(copy[step][0])}</Text>
          <Text className="mt-3 text-base leading-6 text-sage">{t(copy[step][1])}</Text>
          {step === 'home' ? (
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
          ) : step === 'members' ? (
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
          ) : step === 'healthAsk' ? (
            <View className="mt-8 gap-4">
              <Pressable disabled={busy} onPress={() => void chooseHealth(true)} accessibilityRole="radio"
                accessibilityState={{ checked: healthOptIn === true, disabled: busy }}
                className={`rounded-3xl border bg-white p-5 ${healthOptIn === true ? 'border-pine' : 'border-[#D3E8DC]'} ${busy ? 'opacity-50' : ''}`}>
                <Ionicons name="nutrition-outline" size={28} color="#0B3D2E" />
                <Text className="mt-3 text-lg font-bold text-pine">{t('healthAsk.yes')}</Text>
                <Text className="mt-1 text-sm leading-5 text-sage">{t('healthAsk.yesHelp')}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => void chooseHealth(false)} accessibilityRole="radio"
                accessibilityState={{ checked: healthOptIn === false, disabled: busy }}
                className={`rounded-3xl border bg-white p-5 ${healthOptIn === false ? 'border-pine' : 'border-[#D3E8DC]'} ${busy ? 'opacity-50' : ''}`}>
                <Ionicons name="arrow-forward-circle-outline" size={28} color="#0B3D2E" />
                <Text className="mt-3 text-lg font-bold text-pine">{t('healthAsk.no')}</Text>
                <Text className="mt-1 text-sm leading-5 text-sage">{t('healthAsk.noHelp')}</Text>
              </Pressable>
              <Text className="text-xs text-sage">{t('healthAsk.later')}</Text>
            </View>
          ) : householdId ? (
            step === 'health' ? <HealthStep householdId={householdId} finishing={busy} onFinish={async () => go(1)} onBack={() => go(-1)} />
            : step === 'income' ? <IncomeSourcesStep householdId={householdId} userId={userId}
              currency={currency.trim()} members={members} finishing={busy}
              onFinish={async () => go(1)} onBack={() => go(-1)} />
            : step === 'assets' ? <AssetsStep householdId={householdId} currency={currency.trim()} finishing={busy}
              onFinish={async () => go(1)} onBack={() => go(-1)} />
            : step === 'pyramid' ? <PyramidStep householdId={householdId} currency={currency.trim()} finishing={busy}
              onFinish={healthOptIn ? async () => go(1) : finish} onBack={() => go(-1)}
              onEditIncome={() => { setError(null); setStep('income'); }} />
            : step === 'mealPlan' ? <MealPlanStep householdId={householdId} currency={currency.trim()} finishing={busy} onFinish={finish} onBack={() => go(-1)} />
            : null
          ) : null}
          {error ? <Text accessibilityRole="alert" className="mt-4 text-sm text-red-700">{error}</Text> : null}
          {step === 'home' || step === 'members' ? <Pressable disabled={busy || loading} onPress={() => void (step === 'home' ? saveName() : continueFromMembers())}
            accessibilityRole="button" className={`mt-8 items-center rounded-2xl bg-pine py-4 ${busy || loading ? 'opacity-50' : ''}`}>
            {busy ? <ActivityIndicator color="white" /> : <Text className="text-base font-bold text-white">{t('continue')}</Text>}
          </Pressable> : null}
          {step === 'members' || step === 'healthAsk' ? <Pressable disabled={busy} onPress={() => go(-1)} accessibilityRole="button" className="mt-3 items-center p-3">
            <Text className="font-semibold text-sage">{t('back')}</Text>
          </Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
