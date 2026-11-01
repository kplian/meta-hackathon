import './i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import MemberProfileCard from './MemberProfileCard';
import MealPlanCard from './MealPlanCard';
import type { HealthContext } from './types';

export default function HealthView({ householdId }: { householdId: string }) {
  const { t } = useTranslation('health');
  const [context, setContext] = useState<HealthContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    supabase.rpc('f_get_family_health_context', { p_household_id: householdId }).then(
      (result) => {
        if (cancelled) return;
        if (result.error) setError(true);
        else setContext(result.data as unknown as HealthContext);
        setLoading(false);
      },
      () => { if (!cancelled) { setError(true); setLoading(false); } },
    );
    return () => { cancelled = true; };
  }, [householdId, refresh]);

  return (
    <ScrollView className="flex-1 rounded-t-3xl bg-[#F4FAF6]" contentContainerClassName="p-4 pb-10">
      <View className="mx-auto w-full max-w-[1000px] gap-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-extrabold text-pine">{t('title')}</Text>
            <Text className="mt-2 text-sm text-sage">{t('subtitle')}</Text>
          </View>
          <Pressable
            disabled={loading}
            onPress={() => setRefresh((value) => value + 1)}
            accessibilityRole="button"
            accessibilityLabel={t('refresh')}
            className="h-12 w-12 items-center justify-center rounded-full bg-mint"
          >
            <Ionicons name="refresh" size={22} color="#0B3D2E" />
          </Pressable>
        </View>

        {loading && !context ? (
          <View className="items-center gap-3 py-12">
            <ActivityIndicator color="#0B3D2E" />
            <Text className="text-sage">{t('loading')}</Text>
          </View>
        ) : error || !context ? (
          <View className="rounded-2xl bg-white p-5">
            <Text accessibilityRole="alert" className="text-red-700">{t('error')}</Text>
            <Pressable onPress={() => setRefresh((value) => value + 1)} accessibilityRole="button" className="py-3">
              <Text className="font-bold text-pine">{t('retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="rounded-3xl bg-white p-5">
              <Text className="mb-3 text-xl font-extrabold text-pine">{t('membersTitle')}</Text>
              <View className="gap-3">
                {context.members.map((member) => (
                  <MemberProfileCard
                    key={`${member.member_id}-${refresh}`}
                    member={member}
                    onSaved={() => setRefresh((value) => value + 1)}
                  />
                ))}
              </View>
            </View>
            <MealPlanCard householdId={householdId} context={context} refresh={refresh} />
          </>
        )}
      </View>
    </ScrollView>
  );
}
