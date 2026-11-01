import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase, type Database } from '../../lib/supabase';
import { allocateIncome, monthlyIncome, percentageSummary, percentageUnits } from './pyramid-calculations';

type Pyramid = Database['budget']['Tables']['tfinancial_pyramid']['Row'];
type Level = Database['budget']['Tables']['tfinancial_pyramid_level']['Row'];
type Template = Pyramid & { levels: Level[] };
interface Props { householdId: string; currency: string; finishing: boolean; onFinish: () => Promise<void>; onBack: () => void; onEditIncome: () => void }

export default function PyramidStep({ householdId, currency, finishing, onFinish, onBack, onEditIncome }: Props) {
  const { t, i18n } = useTranslation('onboarding');
  const { width, fontScale } = useWindowDimensions();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [customMode, setCustomMode] = useState(false);
  const [income, setIncome] = useState(0);
  const [excluded, setExcluded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = loading || saving || finishing;
  const selected = templates.find(item => item.id === selectedId);
  const levels = selected?.levels ?? [];
  const summary = percentageSummary(levels.map(level => percentages[level.code] ?? ''));
  const allocations = summary.valid ? allocateIncome(income, summary.units as number[]) : summary.units.map(value => value === null ? null : Math.round(income * value / 100) / 100);
  const money = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(value);
  const label = (template: Template, level: Level) => t(`pyramid.levels.${template.code}.${level.code}.name`, { defaultValue: level.name || level.code });
  const description = (template: Template, level: Level) => t(`pyramid.levels.${template.code}.${level.code}.description`, { defaultValue: level.description || '' });
  const title = (template: Template) => t(`pyramid.templates.${template.code}.name`, { defaultValue: template.name || template.code });
  const chartWidth = Math.max(90, Math.min(280, (Math.min(width - 48, 768) - 40) * 0.42));
  const layerHeight = Math.max(136, 130 * fontScale);

  function choose(template: Template) {
    setSelectedId(template.id);
    setCustomMode(false);
    setPercentages(Object.fromEntries(template.levels.map(level => [level.code, String(level.min_percentage)])));
    setError(null);
  }
  async function load() {
    setLoading(true); setLoadFailed(false); setError(null);
    try {
      const [home, catalog, sources] = await Promise.all([
        supabase.schema('budget').from('thousehold').select('financial_pyramid_id,business_type_id').eq('id', householdId).single(),
        supabase.schema('budget').from('tfinancial_pyramid').select('*').is('household_id', null).eq('selectable_template', true).eq('status', 'active').is('deleted_at', null),
        supabase.schema('budget').from('tincome_source').select('estimated_amount,currency,frequency').eq('household_id', householdId).eq('status', 'active').is('deleted_at', null),
      ]);
      if (home.error || catalog.error || sources.error) throw home.error ?? catalog.error ?? sources.error;
      const available = (catalog.data ?? []).filter(item => item.business_type_id === home.data.business_type_id)
        .sort((a, b) => ['essential', 'balanced', 'wealth'].indexOf(a.code) - ['essential', 'balanced', 'wealth'].indexOf(b.code));
      if (!available.length) throw new Error('No templates');
      const levelIds = [...available.map(item => item.id), ...(home.data.financial_pyramid_id ? [home.data.financial_pyramid_id] : [])];
      const [allLevels, saved] = await Promise.all([
        supabase.schema('budget').from('tfinancial_pyramid_level').select('*').in('financial_pyramid_id', levelIds).eq('status', 'active').is('deleted_at', null).order('order_by'),
        home.data.financial_pyramid_id ? supabase.schema('budget').from('tfinancial_pyramid').select('id,code,source_template_id,customized').eq('id', home.data.financial_pyramid_id).single() : Promise.resolve({ data: null, error: null }),
      ]);
      if (allLevels.error || saved.error) throw allLevels.error ?? saved.error;
      const items = available.map(item => ({ ...item, levels: (allLevels.data ?? []).filter(level => level.financial_pyramid_id === item.id) }));
      if (items.some(item => item.levels.length < 2)) throw new Error('Incomplete template');
      setTemplates(items);
      const previous = items.find(item => item.id === saved.data?.source_template_id || item.code === saved.data?.code);
      choose(previous ?? items.find(item => item.code === 'balanced') ?? items[0]);
      if (previous && saved.data) {
        setCustomMode(saved.data.customized);
        const savedLevels = (allLevels.data ?? []).filter(level => level.financial_pyramid_id === saved.data?.id);
        if (savedLevels.length === previous.levels.length) setPercentages(Object.fromEntries(savedLevels.map(level => [level.code, String(level.min_percentage)])));
      }
      const estimate = monthlyIncome(sources.data ?? [], currency);
      setIncome(estimate.total); setExcluded(estimate.excluded);
    } catch { setLoadFailed(true); setError(t('pyramid.loadError')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [householdId, currency]);

  async function save() {
    if (!selected || !summary.valid) { setError(t('pyramid.totalError')); return; }
    setSaving(true); setError(null);
    try {
      const result = await supabase.rpc('f_select_household_pyramid', {
        p_household_id: householdId, p_template_id: selected.id, p_customized: customMode,
        p_percentages: Object.fromEntries(levels.map(level => [level.code, (percentageUnits(percentages[level.code]) ?? 0) / 100])),
      });
      if (result.error) throw result.error;
      await onFinish();
    } catch { setError(t('pyramid.saveError')); }
    finally { setSaving(false); }
  }
  return <View className="mt-6 gap-5" testID="onboarding-pyramid">
    <View className="rounded-2xl bg-pine p-5">
      <Text className="text-sm text-white">{t('pyramid.income')}</Text>
      <Text className="mt-2 text-3xl font-extrabold text-white">{money(income)}</Text>
      <Text className="mt-2 text-xs leading-5 text-white">{t(income > 0 ? 'pyramid.incomeHelp' : 'pyramid.noIncome')}</Text>
      {excluded ? <Text className="mt-2 text-xs leading-5 text-white">{t('pyramid.excluded', { count: excluded })}</Text> : null}
      <Pressable disabled={busy} onPress={onEditIncome} accessibilityRole="button" className="mt-2 self-start py-2"><Text className="font-bold text-white underline">{t('pyramid.editIncome')}</Text></Pressable>
    </View>
    {loading ? <ActivityIndicator color="#0B3D2E" /> : null}
    {!loading && !loadFailed ? <>
      <Text className="font-bold text-pine">{t('pyramid.choose')}</Text>
      <View className="flex-row flex-wrap gap-3">{templates.map(template => <Pressable key={template.id} disabled={busy} onPress={() => { if (customMode || selectedId !== template.id) choose(template); }} accessibilityRole="radio" accessibilityState={{ checked: !customMode && selectedId === template.id }} className={`min-w-[140px] flex-1 rounded-2xl border p-4 ${!customMode && selectedId === template.id ? 'border-pine bg-white' : 'border-[#CCDFD3] bg-[#F4FAF6]'}`}>
        <View className="flex-row items-center justify-between"><Text className="flex-1 text-lg font-extrabold text-pine">{title(template)}</Text><Ionicons name={!customMode && selectedId === template.id ? 'radio-button-on' : 'radio-button-off'} size={20} color="#0B3D2E" /></View>
        <Text className="mt-2 text-sm leading-5 text-sage">{t(`pyramid.templates.${template.code}.description`, { defaultValue: template.description || '' })}</Text>
      <Text className="mt-3 text-sm font-bold text-pine">{template.levels.map(level => `${level.min_percentage}%`).join(' / ')}</Text>
      </Pressable>)}</View>
      <Pressable disabled={busy} onPress={() => { setCustomMode(true); setError(null); }} accessibilityRole="radio" accessibilityState={{ checked: customMode }} className={`rounded-2xl border p-4 ${customMode ? 'border-pine bg-white' : 'border-[#CCDFD3] bg-[#F4FAF6]'}`}>
        <View className="flex-row items-center justify-between"><Text className="flex-1 text-lg font-bold text-pine">{t('pyramid.customTitle')}</Text><Ionicons name={customMode ? 'radio-button-on' : 'radio-button-off'} size={20} color="#0B3D2E" /></View>
        <Text className="mt-2 text-sm leading-5 text-sage">{t('pyramid.customHelp')}</Text>
      </Pressable>
      {selected ? <View className="rounded-3xl bg-white p-5">
        <Text className="mb-5 text-lg font-bold text-pine">{customMode ? t('pyramid.customTitle') : title(selected)}</Text>
        {[...levels].reverse().map((level, index) => {
          const size = chartWidth * (0.45 + 0.55 * index / Math.max(1, levels.length - 1));
          const inset = chartWidth * 0.55 / (2 * Math.max(1, levels.length - 1));
          const raw = percentages[level.code] ?? '';
          const valid = percentageUnits(raw) !== null;
          const valueIndex = levels.findIndex(item => item.id === level.id);
          const allocation = allocations[valueIndex];
          return <View key={level.code} className="flex-row items-center gap-3" style={{ minHeight: layerHeight }}>
            <View style={{ width: chartWidth, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}>
              <View style={{ width: size, height: layerHeight - 8, borderLeftWidth: inset, borderRightWidth: inset, borderBottomWidth: layerHeight - 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: level.color?.trim() || '#5797BA' }} />
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: '800', fontSize: Math.min(23, Math.max(14, size * 0.25)) }}>{valid ? `${raw.replace(',', '.')}%` : '—'}</Text></View>
            </View>
            <View className="flex-1 py-3">
              <Text className="font-bold text-pine">{label(selected, level)}</Text>
              <Text className="mt-1 text-xs leading-4 text-sage">{description(selected, level)}</Text>
              <Text className="mt-2 text-base font-extrabold text-pine">{typeof allocation === 'number' ? money(allocation) : '—'}</Text>
              <Text className="text-xs text-sage">{t('pyramid.perMonth')}</Text>
            </View>
          </View>;
        })}
        {customMode ? <View className="mt-5 gap-4">
          <View className="flex-row items-center justify-between"><Text className="font-bold text-pine">{t('pyramid.customize')}</Text><Pressable disabled={busy} onPress={() => { setPercentages(Object.fromEntries(levels.map(level => [level.code, String(level.min_percentage)]))); setError(null); }} accessibilityRole="button" className="py-2"><Text className="text-sm text-sage underline">{t('pyramid.reset')}</Text></Pressable></View>
          {levels.map(level => <View key={level.code}>
            <View className="flex-row justify-between gap-2"><Text className="flex-1 font-semibold text-pine">{label(selected, level)}</Text><Text className="font-bold text-pine">{percentages[level.code]}%</Text></View>
            <Slider minimumValue={0} maximumValue={100} step={1} value={Number(percentages[level.code]) || 0} disabled={busy} onValueChange={value => { setPercentages(previous => ({ ...previous, [level.code]: String(Math.round(value)) })); setError(null); }} minimumTrackTintColor={level.color?.trim() || '#0B3D2E'} maximumTrackTintColor="#D3E8DC" thumbTintColor="#0B3D2E" accessibilityLabel={t('pyramid.percentLabel', { name: label(selected, level) })} accessibilityValue={{ min: 0, max: 100, now: Number(percentages[level.code]) || 0 }} style={{ width: '100%', height: 44 }} />
          </View>)}
        </View> : null}
        <View accessibilityLiveRegion="polite" className={`mt-5 rounded-xl p-4 ${summary.valid ? 'bg-mint' : 'bg-[#FFF1E6]'}`}>
          <Text className="font-bold text-pine">{t('pyramid.total', { total: (summary.total / 100).toLocaleString(i18n.language, { maximumFractionDigits: 2 }) })}</Text>
          <Text className="mt-1 text-sm leading-5 text-sage">{t(summary.valid ? 'pyramid.totalValid' : 'pyramid.totalError')}</Text>
        </View>
        <Text className="mt-4 text-xs leading-5 text-sage">{t('pyramid.estimateNote')}</Text>
      </View> : null}
    </> : null}
    {error ? <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text> : null}
    {loadFailed ? <Pressable onPress={() => void load()} accessibilityRole="button" className="p-3"><Text className="text-pine">{t('income.retry')}</Text></Pressable> : null}
    <Pressable disabled={busy || loadFailed || !summary.valid} onPress={() => void save()} accessibilityRole="button" accessibilityState={{ disabled: busy || loadFailed || !summary.valid }} className={`items-center rounded-2xl bg-pine py-4 ${busy || loadFailed || !summary.valid ? 'opacity-50' : ''}`}>
      {saving || finishing ? <ActivityIndicator color="white" /> : <Text className="text-base font-bold text-white">{t('pyramid.save')}</Text>}
    </Pressable>
    <Pressable disabled={busy} onPress={onBack} accessibilityRole="button" className="items-center p-3"><Text className="font-semibold text-sage">{t('back')}</Text></Pressable>
  </View>;
}
