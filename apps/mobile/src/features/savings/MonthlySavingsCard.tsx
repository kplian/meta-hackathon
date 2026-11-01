import './i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

import { isSavings, type Savings } from './summary';
export type { Savings } from './summary';
export type SavingsMonth = { currency: string; month: string; savings?: Savings };

export function MonthlySavingsSummary({ data }: { data: SavingsMonth }) {
  const { t, i18n } = useTranslation('monthlySavings');
  const money = (amount: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: data.currency }).format(amount);
  const s = data.savings;
  if (!isSavings(s)) return <Text accessibilityRole="alert" className="rounded-2xl bg-white p-5 text-pine">{t('backendUpdate')}</Text>;
  const month = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  const progress = s.target > 0 ? Math.max(0, Math.min(100, s.generated / s.target * 100)) : 0;
  return <View className="rounded-3xl border border-[#D3E8DC] bg-white p-5" testID="monthly-savings-summary">
    <Text accessibilityRole="header" className="text-lg font-bold text-pine">{t('title')} · {month(data.month)}</Text>
    <View className="mt-4 flex-row flex-wrap gap-5">
      <View className="min-w-[220px] flex-1">
        <Text className="text-sm text-sage">{t('generated')}</Text>
        <Text className={`mt-2 text-3xl font-extrabold ${s.generated < 0 ? 'text-red-700' : 'text-pine'}`}>{money(s.generated)}</Text>
        <Text className="mt-2 text-xs leading-5 text-sage">{t('formula')}</Text>
        <Text className="mt-3 font-semibold text-pine">{s.target > 0 ? t('target', { amount: money(s.target) }) : t('noTarget')}</Text>
        {s.target > 0 ? <>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2EFE8]"><View style={{ width: `${progress}%`, height: 8, backgroundColor: s.achieved ? '#23785B' : '#5797BA' }} /></View>
          <Text className="mt-2 text-sm font-semibold text-pine">{s.achieved ? t('achieved') : t('gap', { amount: money(s.gap) })}</Text>
        </> : null}
        <Text className="mt-2 text-xs leading-5 text-sage">{t('provisional')}</Text>
      </View>
      <View className="min-w-[220px] flex-1 rounded-2xl bg-[#F4FAF6] p-4">
        <Text className="font-bold text-pine">{t('allocated')}</Text>
        <Text className="mt-3 text-sm text-sage">{t('investments')}</Text><Text className="mt-1 text-lg font-bold text-pine">{money(s.investment_contributions)}</Text>
        <Text className="mt-3 text-sm text-sage">{t('vaults')}</Text><Text className="mt-1 text-lg font-bold text-pine">{money(s.vault_contributions)}</Text>
        <Text className="mt-3 text-xs leading-5 text-sage">{t('returns', { amount: money(s.investment_returns + s.vault_returns) })}</Text>
        <Text className="mt-3 text-xs leading-5 text-sage">{t('transferNote')}</Text>
      </View>
    </View>
    <Text className="mt-4 border-t border-[#E2EFE8] pt-4 text-sm leading-5 text-sage">{t('prior', { month: month(s.previous_month), amount: money(s.previous_generated) })}</Text>
  </View>;
}

export default function MonthlySavingsCard({ householdId, refresh }: { householdId: string; refresh: number }) {
  const { t } = useTranslation('monthlySavings');
  const [data, setData] = useState<SavingsMonth | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setData(null); setError(false);
    supabase.rpc('f_monthly_pyramid_dashboard', { p_household_id: householdId, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }).then(result => {
      if (cancelled) return;
      if (result.error) setError(true); else setData(result.data as unknown as SavingsMonth);
    }, () => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [householdId, refresh]);
  if (error) return <Text accessibilityRole="alert" className="rounded-2xl bg-white p-5 text-red-700">{t('loadError')}</Text>;
  if (!data) return <View className="flex-row items-center gap-3 rounded-2xl bg-white p-5"><ActivityIndicator color="#0B3D2E" /><Text className="text-sage">{t('loading')}</Text></View>;
  return <MonthlySavingsSummary data={data} />;
}
