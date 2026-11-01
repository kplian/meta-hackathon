import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

type Group = { id: string; name: string | null; amount: number; percentage: number; is_global: boolean };
type Report = { currency: string; total: number; groups: Group[] };
const palette = ['#0B6E4F', '#5797BA', '#DBA35C', '#986BB3', '#D47B67', '#5F9F94'];
export default function MemberExpensesCard({ householdId, refresh }: { householdId: string; refresh: number }) {
  const { t, i18n } = useTranslation('monthlyDashboard');
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setData(null); setSelected(null);
    supabase.rpc('f_member_expenses_report', { p_household_id: householdId, p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }).then(result => {
      if (cancelled) return;
      if (result.error) setError(true); else setData(result.data as unknown as Report);
      setLoading(false);
    }, () => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [householdId, refresh, retry]);
  const money = (amount: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: data?.currency || 'USD' }).format(amount);
  const percentage = (value: number) => `${value.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`;
  const name = (group: Group) => group.is_global ? t('memberGlobal') : group.name || t('memberFallback');
  const color = (group: Group, index: number) => group.is_global ? '#76877E' : palette[index % palette.length];
  const valid = data && data.total > 0 && data.groups.every(group => group.amount >= 0);
  let start = -Math.PI / 2;
  return <View className="rounded-3xl bg-white p-5" testID="member-expenses">
    <Text className="text-xl font-extrabold text-pine">{t('memberExpensesTitle')}</Text>
    <Text className="mt-2 text-sm leading-5 text-sage">{t('memberExpensesSubtitle')}</Text>
    {loading ? <ActivityIndicator className="my-6" color="#0B3D2E" /> : error ? <View className="mt-4"><Text accessibilityRole="alert" className="text-red-700">{t('memberExpensesError')}</Text><Pressable onPress={() => setRetry(value => value + 1)} accessibilityRole="button" className="py-3"><Text className="font-bold text-pine">{t('retry')}</Text></Pressable></View> : data ? <>
      <Text className="mt-4 text-3xl font-extrabold text-pine">{money(data.total)}</Text>
      {!data.groups.length ? <Text className="mt-4 text-sm text-sage">{t('memberExpensesEmpty')}</Text> : <>
        {valid ? <View className="my-5 items-center"><Svg width={240} height={240} viewBox="0 0 240 240" accessibilityLabel={t('memberExpensesTitle')}>
          {data.groups.map((group, index) => {
            const angle = group.amount / data.total * Math.PI * 2;
            const end = start + angle;
            const path = `M 120 120 L ${120 + 112 * Math.cos(start)} ${120 + 112 * Math.sin(start)} A 112 112 0 ${angle > Math.PI ? 1 : 0} 1 ${120 + 112 * Math.cos(end)} ${120 + 112 * Math.sin(end)} Z`;
            start = end;
            const label = `${name(group)}: ${money(group.amount)} · ${percentage(group.percentage)}`;
            return angle >= Math.PI * 2 - 1e-8 ? <Circle key={group.id} cx={120} cy={120} r={112} fill={color(group, index)} onPress={() => setSelected(group.id)} accessibilityLabel={label} /> : <Path key={group.id} d={path} fill={color(group, index)} stroke="white" strokeWidth={2} onPress={() => setSelected(group.id)} accessibilityLabel={label} />;
          })}
        </Svg></View> : <Text className="mt-4 text-sm text-red-700">{t('memberExpensesInvalid')}</Text>}
        {data.groups.map((group, index) => <Pressable key={group.id} accessibilityRole="button" accessibilityState={{ selected: selected === group.id }} onPress={() => setSelected(group.id)} className={`mt-1 flex-row flex-wrap items-center gap-2 rounded-xl px-2 py-3 ${selected === group.id ? 'bg-mint' : 'bg-[#F4FAF6]'}`}>
          <View className="h-3 w-3 rounded-full" style={{ backgroundColor: color(group, index) }} /><Text className="min-w-[90px] flex-1 text-sm font-semibold text-pine">{name(group)}</Text><Text className="text-sm font-bold text-pine">{money(group.amount)}</Text><Text className="w-[50px] text-right text-xs text-sage">{valid ? percentage(group.percentage) : '—'}</Text>
        </Pressable>)}
      </>}
      <Text className="mt-4 text-xs leading-5 text-sage">{t('memberExpensesNote')}</Text>
    </> : null}
  </View>;
}
