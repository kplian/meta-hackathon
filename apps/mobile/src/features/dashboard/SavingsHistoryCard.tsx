import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

type Month = { month: string; income: number; expenses: number; saving: number };
type Report = { currency: string; months: Month[] };
export default function SavingsHistoryCard({ householdId, refresh }: { householdId: string; refresh: number }) {
  const { t, i18n } = useTranslation('monthlyDashboard');
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setData(null);
    supabase.rpc('f_closed_month_savings_report', { p_household_id: householdId, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }).then(result => {
      if (cancelled) return;
      if (result.error) setError(true);
      else { const report = result.data as unknown as Report; setData(report); setSelected(report.months.at(-1)?.month ?? null); }
      setLoading(false);
    }, () => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [householdId, refresh, retry]);
  const money = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: data?.currency || 'USD', maximumFractionDigits: 2 }).format(value);
  const date = (month: string) => new Date(`${month}-01T12:00:00`);
  const monthLabel = (month: string) => date(month).toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' });
  const current = data?.months.find(month => month.month === selected);
  const maxPositive = Math.max(0, ...data?.months.map(month => month.saving) ?? []);
  const minNegative = Math.min(0, ...data?.months.map(month => month.saving) ?? []);
  const range = maxPositive - minNegative || 1;
  const baseline = 16 + 150 * maxPositive / range;
  return <View className="rounded-3xl bg-white p-5" testID="savings-history">
    <Text className="text-xl font-extrabold text-pine">{t('historyTitle')}</Text>
    <Text className="mt-2 text-sm leading-5 text-sage">{t('historySubtitle')}</Text>
    {loading ? <ActivityIndicator className="my-6" color="#0B3D2E" /> : error ? <View className="mt-4"><Text accessibilityRole="alert" className="text-red-700">{t('historyError')}</Text><Pressable onPress={() => setRetry(value => value + 1)} accessibilityRole="button" className="py-3"><Text className="font-bold text-pine">{t('retry')}</Text></Pressable></View> : data ? <>
      <Text className="mt-4 text-xs font-semibold text-sage">{data.currency} · {t('historyLegend')}</Text>
      {data.months.every(month => month.income === 0 && month.expenses === 0) ? <Text className="mt-3 text-sm text-sage">{t('historyEmpty')}</Text> : null}
      <Svg width="100%" height={220} viewBox="0 0 500 220" accessibilityLabel={t('historyTitle')}>
        <Line x1={5} x2={495} y1={baseline} y2={baseline} stroke="#A8BCAF" strokeWidth={1} />
        {data.months.map((month, index) => {
          const height = Math.abs(month.saving) / range * 150;
          const x = index * 49 + 10;
          return <ViewlessBar key={month.month} x={x} y={month.saving >= 0 ? baseline - height : baseline} height={height} selected={selected === month.month} negative={month.saving < 0} label={`${monthLabel(month.month)}: ${money(month.saving)}`} onPress={() => setSelected(month.month)} month={date(month.month).toLocaleDateString(i18n.language, { month: 'short' })} year={date(month.month).getFullYear().toString().slice(-2)} />;
        })}
      </Svg>
      {current ? <View className="rounded-2xl bg-[#F4FAF6] p-4">
        <Text className="mb-3 font-bold text-pine">{monthLabel(current.month)}</Text>
        {(['income', 'expenses', 'saving'] as const).map(key => <View key={key} className="mt-1 flex-row justify-between gap-3"><Text className="flex-1 text-sm text-sage">{t(`history_${key}`)}</Text><Text className="text-sm font-bold" style={{ color: key === 'saving' && current.saving < 0 ? '#B53D35' : '#0B3D2E' }}>{money(current[key])}</Text></View>)}
      </View> : null}
      <View className="mt-3 flex-row flex-wrap gap-2">{data.months.map(month => <Pressable key={month.month} accessibilityRole="button" accessibilityState={{ selected: selected === month.month }} accessibilityLabel={`${monthLabel(month.month)}: ${money(month.saving)}`} onPress={() => setSelected(month.month)} className={`rounded-lg border px-3 py-2 ${selected === month.month ? 'border-pine bg-mint' : 'border-[#D3E8DC]'}`}><Text className="text-xs text-pine">{monthLabel(month.month)}</Text></Pressable>)}</View>
      <Text className="mt-4 text-xs leading-5 text-sage">{t('historyNote')}</Text>
    </> : null}
  </View>;
}
function ViewlessBar({ x, y, height, selected, negative, label, onPress, month, year }: { x: number; y: number; height: number; selected: boolean; negative: boolean; label: string; onPress: () => void; month: string; year: string }) {
  return <>
    <Rect x={x} y={y} width={30} height={Math.max(height, 1)} fill={negative ? '#B53D35' : '#21815E'} opacity={selected ? 1 : 0.65} onPress={onPress} accessibilityLabel={label} />
    <SvgText x={x + 15} y={190} textAnchor="middle" fontSize={12} fill="#52695E">{month}</SvgText>
    <SvgText x={x + 15} y={207} textAnchor="middle" fontSize={11} fill="#52695E">{year}</SvgText>
  </>;
}
