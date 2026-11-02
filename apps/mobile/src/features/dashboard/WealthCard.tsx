import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

type Asset = { id: string; name: string; alias: string | null; symbol: string | null; value_usd: number; percentage: number; valuation_as_of: string; current_quantity: number; unit_code: string; current_unit_price_usd: number; valuation_basis: string; quote_missing: boolean; has_untracked_movements: boolean };
type Report = { total: number; assets: Asset[] };
const colors = ['#0B6E4F', '#5797BA', '#DBA35C', '#986BB3', '#D47B67', '#5F9F94', '#6B79AC', '#AA773D'];

export default function WealthCard({ householdId, refresh }: { householdId: string; refresh: number }) {
  const { t, i18n } = useTranslation('monthlyDashboard');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setReport(null); setSelected(null);
    supabase.rpc('f_household_wealth_report', { p_household_id: householdId }).then(result => {
      if (cancelled) return;
      if (result.error) setError(true); else setReport(result.data as unknown as Report);
      setLoading(false);
    }, () => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [householdId, refresh, retry]);
  const money = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD' }).format(value);
  const units = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 12 });
  const percentage = (value: number) => `${value.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`;
  const validChart = report && report.total > 0 && report.assets.every(asset => asset.value_usd >= 0);
  let start = -Math.PI / 2;
  return <View className="rounded-3xl bg-white p-5" testID="household-wealth">
    <Text className="text-xl font-extrabold text-pine">{t('wealthTitle')}</Text>
    <Text className="mt-1 text-sm leading-5 text-sage">{t('wealthSubtitle')}</Text>
    {loading ? <ActivityIndicator className="my-6" color="#0B3D2E" /> : error ? <View className="mt-4"><Text accessibilityRole="alert" className="text-red-700">{t('error')}</Text><Pressable onPress={() => setRetry(value => value + 1)} accessibilityRole="button" className="py-3"><Text className="font-bold text-pine">{t('retry')}</Text></Pressable></View> : report ? <>
      <Text className="mt-4 text-3xl font-extrabold text-pine">{money(report.total)}</Text>
      {!report.assets.length ? <Text className="mt-4 text-sm text-sage">{t('wealthEmpty')}</Text> : <>
        {validChart ? <View className="my-5 items-center">
          <Svg width={240} height={240} viewBox="0 0 240 240" accessibilityLabel={t('wealthChart')}>
            {report.assets.filter(asset => asset.value_usd > 0).map(asset => {
              const index = report.assets.findIndex(item => item.id === asset.id);
              const angle = asset.value_usd / report.total * Math.PI * 2;
              const end = start + angle;
              const path = `M 120 120 L ${120 + 112 * Math.cos(start)} ${120 + 112 * Math.sin(start)} A 112 112 0 ${angle > Math.PI ? 1 : 0} 1 ${120 + 112 * Math.cos(end)} ${120 + 112 * Math.sin(end)} Z`;
              start = end;
              const onPress = () => setSelected(asset.id);
              const label = `${asset.alias || asset.name}: ${money(asset.value_usd)}, ${percentage(asset.percentage)}`;
              return angle >= Math.PI * 2 - 1e-8 ? <Circle key={asset.id} cx={120} cy={120} r={112} fill={colors[index % colors.length]} onPress={onPress} accessibilityLabel={label} /> : <Path key={asset.id} d={path} fill={colors[index % colors.length]} stroke="white" strokeWidth={2} onPress={onPress} accessibilityLabel={label} />;
            })}
          </Svg>
          {selected ? <Text accessibilityLiveRegion="polite" className="mt-3 text-center font-semibold text-pine">{report.assets.filter(asset => asset.id === selected).map(asset => `${asset.alias || asset.name} · ${money(asset.value_usd)} · ${percentage(asset.percentage)}`).join('')}</Text> : null}
        </View> : <Text className="mt-4 text-sm text-sage">{t(report.assets.some(asset => asset.value_usd < 0) ? 'wealthNegative' : 'wealthZero')}</Text>}
        <View className="mt-3 flex-row border-b border-[#D3E8DC] pb-3"><Text className="flex-1 font-bold text-pine">{t('wealthAsset')}</Text><Text className="w-[110px] text-right font-bold text-pine">USD</Text><Text className="w-[55px] text-right font-bold text-pine">%</Text></View>
        {report.assets.map((asset, index) => <Pressable key={asset.id} accessibilityRole="button" onPress={() => setSelected(asset.id)} className={`flex-row items-center border-b border-[#E9F5EE] py-3 ${selected === asset.id ? 'bg-[#F4FAF6]' : ''}`}>
          <View className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
          <View className="flex-1 pr-2"><Text className="text-sm font-semibold text-pine">{asset.alias || asset.name}</Text>{asset.alias || asset.symbol ? <Text className="mt-1 text-xs text-sage">{[asset.alias ? asset.name : '', asset.symbol].filter(Boolean).join(' · ')}</Text> : null}<Text className="mt-1 text-xs text-sage">{units(asset.current_quantity)} {asset.unit_code === 'UNIT' ? t('wealthUnit', { count: asset.current_quantity }) : asset.unit_code}</Text>
            <Text className="mt-1 text-xs text-sage">{t(asset.valuation_basis === 'shared_quote' ? 'wealthSharedPrice' : asset.valuation_basis === 'position_valuation' ? 'wealthIndividualPrice' : 'wealthInitialPrice')}</Text>
            <Text className="mt-1 text-xs text-sage">{new Date(asset.valuation_as_of).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}</Text>
            {asset.quote_missing ? <Text className="mt-1 text-xs text-[#986329]">{t('wealthMissingQuote')}</Text> : null}
            {asset.has_untracked_movements ? <Text className="mt-1 text-xs text-[#986329]">{t('wealthLegacyUnits')}</Text> : null}</View>
          <Text className="w-[110px] text-right text-sm font-bold text-pine">{money(asset.value_usd)}</Text><Text className="w-[55px] text-right text-xs text-sage">{validChart ? percentage(asset.percentage) : '—'}</Text>
        </Pressable>)}
        <View className="mt-3 flex-row justify-between"><Text className="font-bold text-pine">{t('wealthTotal')}</Text><Text className="font-extrabold text-pine">{money(report.total)}</Text></View>
      </>}
      <Text className="mt-4 text-xs leading-5 text-sage">{t('wealthNote')}</Text>
    </> : null}
  </View>;
}
