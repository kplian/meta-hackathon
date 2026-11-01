import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import MealPlanView from './MealPlanView';
import type { HealthContext, MealPlan } from './types';

type Props = { householdId: string; context: HealthContext; refresh: number };

export default function MealPlanCard({ householdId, context, refresh }: Props) {
  const { t, i18n } = useTranslation('health');
  const currency = context.household.currency;
  const food = context.food;
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState('');
  const [budget, setBudget] = useState(food.suggested_weekly ? String(food.suggested_weekly) : '');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.rpc('f_get_meal_plan', { p_household_id: householdId }).then(
      (result) => {
        if (cancelled) return;
        setPlan(result.error ? null : ((result.data as unknown as MealPlan | null) ?? null));
        setLoading(false);
      },
      () => { if (!cancelled) setLoading(false); },
    );
    return () => { cancelled = true; };
  }, [householdId, refresh]);

  const money = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: currency || 'BOB' }).format(value);
  const budgetNumber = Number(budget.replace(',', '.'));
  const budgetValid = budget === '' || (Number.isFinite(budgetNumber) && budgetNumber > 0);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    const response = await supabase.functions.invoke('meal-plan', {
      body: {
        action: 'generate',
        householdId,
        request: request.trim() || undefined,
        budget: budget === '' ? undefined : budgetNumber,
        language: (i18n.language || 'es').slice(0, 2),
      },
    });
    setGenerating(false);
    if (response.error) {
      let code = 'default';
      try { code = (await response.error.context.json()).error ?? code; } catch { /* No response body. */ }
      setError(code);
      return;
    }
    setPlan((response.data as { plan: MealPlan }).plan);
  };

  return (
    <View className="rounded-3xl bg-white p-5" testID="meal-plan">
      <Text className="text-xl font-extrabold text-pine">{t('planTitle')}</Text>
      <Text className="mt-1 text-sm leading-5 text-sage">{t('planSubtitle')}</Text>

      <Text className="mt-4 rounded-xl bg-[#F4FAF6] p-3 text-xs leading-5 text-pine">
        {food.monthly_budget
          ? t('foodStatus', { spent: money(food.spent_month), budget: money(food.monthly_budget), weekly: money(food.suggested_weekly ?? 0) })
          : t('foodNoBudget')}
      </Text>

      <View className="mt-4 gap-3">
        <View className="flex-row flex-wrap gap-3">
          <View className="min-w-[140px] flex-1 gap-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-sage">{t('weeklyBudget')} ({currency})</Text>
            <TextInput
              value={budget}
              onChangeText={setBudget}
              keyboardType="decimal-pad"
              accessibilityLabel={t('weeklyBudget')}
              className="rounded-xl border border-[#D3E8DC] bg-white px-3 py-2.5 text-sm text-pine"
            />
          </View>
          <View className="min-w-[200px] flex-[2] gap-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-sage">{t('request')}</Text>
            <TextInput
              value={request}
              onChangeText={setRequest}
              placeholder={t('requestPlaceholder')}
              placeholderTextColor="#8AA197"
              maxLength={500}
              accessibilityLabel={t('request')}
              className="rounded-xl border border-[#D3E8DC] bg-white px-3 py-2.5 text-sm text-pine"
            />
          </View>
        </View>
        <Pressable
          onPress={() => void generate()}
          disabled={generating || !budgetValid}
          accessibilityRole="button"
          className={`flex-row items-center justify-center rounded-2xl bg-pine py-3.5 ${generating || !budgetValid ? 'opacity-60' : 'active:opacity-85'}`}
        >
          {generating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />}
          <Text className="ml-2 text-sm font-bold text-white">
            {generating ? t('generating') : plan ? t('regenerate') : t('generate')}
          </Text>
        </Pressable>
        {error ? (
          <Text accessibilityRole="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {t(`err.${error}`, { defaultValue: t('err.default') })}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator className="my-6" color="#0B3D2E" />
      ) : !plan ? (
        <Text className="mt-5 text-sm text-sage">{t('noPlan')}</Text>
      ) : (
        <MealPlanView key={plan.id} plan={plan} currency={currency} />
      )}
    </View>
  );
}
