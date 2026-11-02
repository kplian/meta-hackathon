import './i18n';
import { isSavings } from '../savings/summary';
import { MonthlySavingsSummary, type Savings } from '../savings/MonthlySavingsCard';
import SavingsHistoryCard from './SavingsHistoryCard';
import MemberExpensesCard from './MemberExpensesCard';
import WealthCard from './WealthCard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type Level = { code: string; name: string; color: string | null; percentage: number; allocated: number; spent: number };
type Summary = { month: string; currency: string; income: number; estimated_income: number; excluded_estimates: number; expenses: number; unclassified: number; excluded_currency_count: number; levels: Level[]; savings?: Savings };

export default function MonthlyDashboard({ householdId, householdName }: { householdId: string; householdName: string }) {
  const { t, i18n } = useTranslation('monthlyDashboard');
  const { t: savingsText } = useTranslation('monthlySavings');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [chartWidth, setChartWidth] = useState(140);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setData(null);
    supabase.rpc('f_monthly_pyramid_dashboard', { p_household_id: householdId, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
      .then(result => {
        if (cancelled) return;
        if (result.error) setError(true);
        else setData(result.data as unknown as Summary);
        setLoading(false);
      }, () => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [householdId, refresh]);
  const money = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: data?.currency || 'USD' }).format(value);
  const percent = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const visibleLevels = data?.levels.filter(level => level.allocated > 0 && (level.code !== 'saving' || isSavings(data?.savings))) ?? [];
  const month = data ? new Date(`${data.month}-01T12:00:00`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }) : '';
  return <ScrollView className="flex-1 rounded-t-3xl bg-[#F4FAF6]" contentContainerClassName="p-4 pb-10">
    <View className="mx-auto w-full max-w-[1000px] gap-5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1"><Text className="text-sm text-sage">{householdName} · {month || t('month')}</Text><Text className="mt-1 text-2xl font-extrabold text-pine">{t('title')}</Text><Text className="mt-2 text-sm text-sage">{t('subtitle')}</Text></View>
        <Pressable disabled={loading} onPress={() => setRefresh(value => value + 1)} accessibilityRole="button" accessibilityLabel={t('refresh')} className="h-12 w-12 items-center justify-center rounded-full bg-mint"><Ionicons name="refresh" size={22} color="#0B3D2E" /></Pressable>
      </View>
      {loading ? <View className="items-center gap-3 py-12"><ActivityIndicator color="#0B3D2E" /><Text className="text-sage">{t('loading')}</Text></View> : error ? <View className="rounded-2xl bg-white p-5"><Text accessibilityRole="alert" className="text-red-700">{t('error')}</Text><Pressable onPress={() => setRefresh(value => value + 1)} accessibilityRole="button" className="mt-3 py-3"><Text className="font-bold text-pine">{t('retry')}</Text></Pressable></View> : data ? <>
        <View className="flex-row flex-wrap gap-3">
          <View className="min-w-[140px] flex-1 rounded-2xl bg-pine p-5">
            <Text className="text-sm text-white">{t('incomeTitle')}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} className="mt-2 text-2xl font-extrabold text-white">{money(data.estimated_income)}</Text>
            <Text className="mt-3 text-xs leading-5 text-[#C8E1D4]">{t('receivedLegend', { amount: money(data.income) })}</Text>
          </View>
          <View className="min-w-[140px] flex-1 rounded-2xl border border-[#D3E8DC] bg-white p-5">
            <Text className="text-sm text-sage">{t('expenses')}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} className="mt-2 text-2xl font-extrabold text-pine">{money(data.expenses)}</Text>
          </View>
        </View>
        {data.estimated_income <= 0 ? <Text className="rounded-xl bg-[#FFF1E6] p-4 text-sm leading-5 text-pine">{t('noIncome')}</Text> : null}
        {!data.levels.length ? <Text className="rounded-2xl bg-white p-5 text-pine">{t('noPlan')}</Text> : <View className="rounded-3xl bg-white p-4" onLayout={event => setChartWidth(Math.max(80, Math.min(300, event.nativeEvent.layout.width * 0.4 - 16)))}>
          {[...visibleLevels].reverse().map((level, index) => {
            const saving = level.code === 'saving';
            const amount = saving && data.savings ? data.savings.generated : level.spent;
            const used = level.allocated > 0 ? Math.max(0, amount) / level.allocated * 100 : null;
            const over = !saving && amount > level.allocated;
            const color = over ? '#B53D35' : level.color?.trim() || '#5797BA';
            const shapeWidth = chartWidth * (0.45 + 0.55 * index / Math.max(1, visibleLevels.length - 1));
            const inset = chartWidth * 0.55 / (2 * Math.max(1, visibleLevels.length - 1));
            return <View key={level.code} className="flex-row items-center gap-3 py-1">
              <View style={{ width: chartWidth, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', minHeight: 146 }}>
                <View style={{ width: shapeWidth, height: 138, overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', width: shapeWidth, height: 138, borderLeftWidth: inset, borderRightWidth: inset, borderBottomWidth: 138, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color, opacity: 0.2 }} />
                  <View style={{ position: 'absolute', bottom: 0, width: shapeWidth, height: 138 * Math.min(1, Math.max(0, used === null ? (over ? 1 : 0) : used / 100)), overflow: 'hidden' }}>
                    <View style={{ position: 'absolute', bottom: 0, width: shapeWidth, height: 138, borderLeftWidth: inset, borderRightWidth: inset, borderBottomWidth: 138, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
                  </View>
                  <View style={{ position: 'absolute', top: 52, left: 0, right: 0, alignItems: 'center' }}><Text style={{ color: (used !== null && used >= 65) || (used === null && over) ? '#FFFFFF' : '#0B3D2E', fontWeight: '800', fontSize: 18 }}>{used === null ? '—' : `${percent(used)}%`}</Text></View>
                </View>
              </View>
              <View className="flex-1 py-3"><Text className="font-bold text-pine">{t(level.code, { defaultValue: level.name })}</Text><Text className="mt-1 text-xs leading-5 text-sage">{t('allocation', { percent: percent(level.percentage), amount: money(level.allocated) })}</Text><Text className="mt-2 text-lg font-extrabold text-pine">{money(amount)}</Text><Text className="mt-1 text-xs font-semibold" style={{ color: over ? '#B53D35' : '#52695E' }}>{used === null ? '—' : saving ? savingsText('progress', { percent: percent(used) }) : t('used', { percent: percent(used) })}</Text><Text className="mt-1 text-xs leading-5" style={{ color: over ? '#B53D35' : '#52695E' }}>{saving ? (data.savings?.achieved ? savingsText('achieved') : savingsText('gap', { amount: money(data.savings?.gap ?? 0) })) : t(over ? 'over' : 'remaining', { amount: money(Math.abs(level.allocated - level.spent)) })}</Text></View>
            </View>;
          })}
        </View>}
        <MonthlySavingsSummary data={data} />
        {data.unclassified > 0 ? <Text className="rounded-xl bg-[#FFF1E6] p-4 text-sm text-pine">{t('unclassified', { amount: money(data.unclassified) })}</Text> : null}
        {data.excluded_currency_count > 0 ? <Text className="text-sm text-sage">{t('excluded')}</Text> : null}
        {data.excluded_estimates > 0 ? <Text className="text-sm text-sage">{t('excludedEstimates')}</Text> : null}
        <Text className="text-xs leading-5 text-sage">{t('note')}</Text>
      </> : null}
      <WealthCard householdId={householdId} refresh={refresh} />
      <MemberExpensesCard householdId={householdId} refresh={refresh} />
      <SavingsHistoryCard householdId={householdId} refresh={refresh} />
    </View>
  </ScrollView>;
}
