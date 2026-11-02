import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { MealPlan } from './types';

export default function MealPlanView({ plan, currency, testID }: { plan: MealPlan; currency: string; testID?: string }) {
  const { t, i18n } = useTranslation('health');
  const [openDay, setOpenDay] = useState(0);
  const money = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: currency || 'BOB' }).format(value);

  return (
    <View className="mt-5 gap-4" testID={testID}>
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
  );
}
