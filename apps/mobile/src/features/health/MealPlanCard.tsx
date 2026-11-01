import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
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
  const [openDay, setOpenDay] = useState(0);

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
    setOpenDay(0);
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
        <View className="mt-5 gap-4">
          <View className="flex-row flex-wrap items-end justify-between gap-2">
            <View>
              <Text className="text-xs text-sage">
                {t('week', { date: new Date(`${plan.week_start}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' }) })}
              </Text>
              <Text className="text-xs text-sage">{t('estimated')}</Text>
              <Text className="text-2xl font-extrabold text-pine">
                {money(plan.estimated_cost)}
                {plan.budget_amount ? <Text className="text-sm font-semibold text-sage"> {t('ofBudget', { budget: money(plan.budget_amount) })}</Text> : null}
              </Text>
            </View>
            {plan.budget_amount ? (
              <View className={`rounded-full px-3 py-1 ${plan.within_budget ? 'bg-[#E6F4EC]' : 'bg-[#FDE8E6]'}`}>
                <Text className={`text-xs font-bold ${plan.within_budget ? 'text-pine' : 'text-[#B53D35]'}`}>
                  {plan.within_budget ? t('withinBudget') : t('overBudget')}
                </Text>
              </View>
            ) : null}
          </View>
          {plan.summary ? <Text className="text-sm leading-5 text-pine">{plan.summary}</Text> : null}

          <View className="gap-2">
            {plan.days.map((day, index) => (
              <View key={index} className="overflow-hidden rounded-2xl border border-[#E2EFE8]">
                <Pressable
                  onPress={() => setOpenDay(openDay === index ? -1 : index)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: openDay === index }}
                  className="flex-row items-center justify-between bg-[#F4FAF6] px-4 py-3"
                >
                  <Text className="font-bold text-pine">{day.day}</Text>
                  <Ionicons name={openDay === index ? 'chevron-up' : 'chevron-down'} size={16} color="#0B3D2E" />
                </Pressable>
                {openDay === index ? (
                  <View className="gap-3 px-4 py-3">
                    {day.meals.map((meal, mealIndex) => (
                      <View key={mealIndex}>
                        <Text className="text-[11px] font-bold uppercase tracking-wider text-sage">
                          {t(`meal.${meal.type}`, { defaultValue: meal.type })}
                          {meal.for ? ` · ${t('onlyFor', { name: meal.for })}` : ''}
                        </Text>
                        <Text className="text-sm font-semibold text-pine">{meal.name}</Text>
                        {meal.ingredients.length ? <Text className="text-xs text-sage">{meal.ingredients.join(', ')}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          {plan.shopping_list.length ? (
            <View>
              <Text className="mb-2 text-base font-extrabold text-pine">{t('shopping')}</Text>
              {plan.shopping_list.map((item, index) => (
                <View key={index} className="flex-row items-center border-b border-[#E9F5EE] py-2">
                  <Text className="flex-1 text-sm text-pine">{item.item}</Text>
                  <Text className="w-[90px] text-xs text-sage">{item.quantity}</Text>
                  <Text className="w-[90px] text-right text-sm font-semibold text-pine">{money(item.cost)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {plan.activities.length ? (
            <View className="gap-2">
              <Text className="text-base font-extrabold text-pine">{t('activitiesTitle')}</Text>
              {plan.activities.map((activity, index) => (
                <View key={index} className="flex-row items-start rounded-2xl bg-[#F4FAF6] p-3">
                  <Ionicons name="bicycle-outline" size={18} color="#0B6E4F" />
                  <View className="ml-2 flex-1">
                    <Text className="text-sm font-bold text-pine">{activity.name}{activity.for ? ` · ${activity.for}` : ''}</Text>
                    {activity.why ? <Text className="text-xs text-sage">{activity.why}</Text> : null}
                  </View>
                  <Text className="text-xs font-bold text-pine">{activity.cost > 0 ? money(activity.cost) : t('free')}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text className="text-xs leading-5 text-sage">{t('disclaimer')}</Text>
        </View>
      )}
    </View>
  );
}
