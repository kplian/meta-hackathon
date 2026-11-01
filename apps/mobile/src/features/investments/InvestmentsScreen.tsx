import './i18n';
import MonthlySavingsCard from '../savings/MonthlySavingsCard';
import '../onboarding/i18n';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import AssetsStep, { type AssetRegistration } from '../onboarding/AssetsStep';
import MovementForm from './MovementForm';
import VaultsPanel from './VaultsPanel';
import type { Asset, Endpoint, Overview } from './types';

type Mode = 'list' | 'choose' | 'opening' | 'new' | 'movement';
export default function InvestmentsScreen({ householdId }: { householdId: string }) {
  const { t, i18n } = useTranslation('investments');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<Mode>('list');
  const [source, setSource] = useState<Endpoint>();
  const [destination, setDestination] = useState<Endpoint>();
  const [refresh, setRefresh] = useState(0);
  const [success, setSuccess] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError(false);
    supabase.rpc('f_investment_overview', { p_household_id: householdId }).then(response => {
      if (cancelled) return;
      if (response.error) { setLoadError(true); setOverview(null); }
      else setOverview(response.data as unknown as Overview);
      setLoading(false);
    }, () => { if (!cancelled) { setLoading(false); setLoadError(true); setOverview(null); } });
    return () => { cancelled = true; };
  }, [householdId, refresh]);
  const money = (value: number, currency: string) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(value);
  const quantity = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 12 });
  const endpoints: Endpoint[] = overview ? [
    ...overview.accounts.map(account => ({ key: `account:${account.id}`, kind: 'operating' as const, id: account.id,
      label: account.code === '110' ? `${t('available')} · ${account.currency}` : account.name, unit: account.currency, balance: account.balance })),
    ...overview.wealth.assets.map(asset => ({ key: `position:${asset.id}`, kind: 'position' as const, id: asset.id, label: asset.alias || asset.name,
      unit: asset.unit_code, balance: asset.current_quantity, price: asset.current_unit_price_usd })),
  ] : [];
  const firstCash = endpoints.find(endpoint => endpoint.kind === 'operating');
  function move(asset?: Asset, withdraw = false) {
    const selected = endpoints.find(endpoint => endpoint.id === asset?.id);
    setSource(withdraw ? selected : firstCash); setDestination(withdraw ? firstCash : selected);
    setSuccess(''); setMode('movement');
  }
  const purchase = useCallback((draft: AssetRegistration) => {
    setSource(overview?.accounts[0] ? { key: `account:${overview.accounts[0].id}`, kind: 'operating', id: overview.accounts[0].id,
      label: t('available'), unit: overview.currency, balance: overview.accounts[0].balance } : undefined);
    setDestination({ key: 'new', kind: 'new', label: draft.p_alias || draft.p_name,
      unit: draft.p_unit_code ?? (draft.p_asset_type_code === 'crypto' ? draft.p_symbol?.split('/')[0] : draft.p_symbol) ?? 'UNIT',
      price: Number(draft.p_unit_price_usd), draft });
    setMode('movement');
  }, [overview, t]);
  function saved(opening = false) { setMode('list'); setSuccess(opening ? 'openingSuccess' : 'success'); setRefresh(value => value + 1); }
  const cancel = () => setMode('list');
  const actionClass = 'min-h-[48px] items-center justify-center rounded-xl border border-[#D3E8DC] bg-white px-4 py-3';
  return <ScrollView className="flex-1 rounded-t-3xl bg-[#F4FAF6]" contentContainerClassName="p-4 pb-10 md:p-6" keyboardShouldPersistTaps="handled" testID="investments-screen">
    <View className="w-full max-w-6xl self-center gap-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1"><Text accessibilityRole="header" className="text-2xl font-extrabold text-pine">{t('title')}</Text><Text className="mt-2 text-sm leading-5 text-sage">{t('subtitle')}</Text></View>
        {mode === 'list' ? <Pressable accessibilityRole="button" accessibilityLabel={t('refresh')} disabled={loading} onPress={() => setRefresh(value => value + 1)} className="min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-white"><Ionicons name="refresh-outline" size={23} color="#0B3D2E" /></Pressable> : null}
      </View>
      {success ? <Text accessibilityLiveRegion="polite" className="rounded-xl bg-mint p-4 font-semibold text-pine">{t(success)}</Text> : null}
      {loading ? <View className="items-center p-8"><ActivityIndicator color="#0B3D2E" /><Text className="mt-3 text-sage">{t('loading')}</Text></View> : loadError ? <View className="rounded-2xl bg-white p-5"><Text accessibilityRole="alert" className="text-red-700">{t('loadError')}</Text><Pressable accessibilityRole="button" onPress={() => setRefresh(value => value + 1)} className={`${actionClass} mt-4`}><Text className="font-bold text-pine">{t('retry')}</Text></Pressable></View> : overview ? <>
        <View className="flex-row flex-wrap gap-4">
          <View className="min-w-[240px] flex-1 rounded-3xl bg-pine p-6"><Ionicons name="wallet-outline" size={25} color="white" /><Text className="mt-3 text-sm font-semibold text-white">{t('available')}</Text><Text className="mt-2 text-3xl font-extrabold text-white">{money(overview.available, overview.currency)}</Text><Text className="mt-3 text-xs leading-5 text-white">{t('availableNote')}</Text></View>
          <View className="min-w-[240px] flex-1 rounded-3xl border border-[#D3E8DC] bg-white p-6"><Ionicons name="trending-up-outline" size={25} color="#0B3D2E" /><Text className="mt-3 text-sm font-semibold text-sage">{t('portfolio')}</Text><Text className="mt-2 text-3xl font-extrabold text-pine">{money(overview.wealth.total, 'USD')}</Text><Text className="mt-3 text-xs leading-5 text-sage">{t('portfolioNote')}</Text></View>
        </View>
        {!overview.can_manage ? <Text className="text-sm leading-5 text-sage">{t('manageOnly')}</Text> : null}
        {mode === 'list' ? <>
          <MonthlySavingsCard householdId={householdId} refresh={refresh} />
          {overview.can_manage ? <View className="flex-row flex-wrap gap-3">
            <Pressable accessibilityRole="button" onPress={() => { setSuccess(''); setMode('choose'); }} className="min-h-[48px] flex-grow flex-row items-center justify-center gap-2 rounded-xl bg-pine px-5 py-3"><Ionicons name="add-outline" size={22} color="white" /><Text className="font-bold text-white">{t('add')}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => move()} className={`${actionClass} flex-grow`}><Text className="font-bold text-pine">{t('transfer')}</Text></Pressable>
          </View> : null}
          <View className="rounded-3xl bg-white p-5"><Text className="text-lg font-bold text-pine">{t('accounts')}</Text>
            {overview.accounts.map(account => <View key={account.id} className="mt-3 flex-row flex-wrap justify-between gap-2 border-t border-[#E2EFE8] pt-3"><Text className="text-sm text-sage">{account.code === '110' ? t('available') : account.name}</Text><Text className="font-bold text-pine">{money(account.balance, account.currency)}</Text></View>)}
          </View>
          <VaultsPanel householdId={householdId} currency={overview.currency} accounts={overview.accounts} canManage={overview.can_manage} onChanged={(created) => { setSuccess(created ? 'vaultCreated' : 'success'); setRefresh(value => value + 1); }} />
          <Text accessibilityRole="header" className="text-xl font-bold text-pine">{t('investments')}</Text>
          {!overview.wealth.assets.length ? <Text className="rounded-2xl bg-white p-5 text-sm leading-6 text-sage">{t('empty')}</Text> : <View className="flex-row flex-wrap gap-4">{overview.wealth.assets.map(asset => <View key={asset.id} className="min-w-[250px] flex-1 rounded-3xl border border-[#E2EFE8] bg-white p-5">
            <Text className="text-lg font-bold text-pine">{asset.alias || asset.name}</Text>{asset.alias ? <Text className="mt-1 text-sm text-sage">{asset.name}</Text> : null}
            <Text className="mt-3 text-2xl font-extrabold text-pine">{money(asset.value_usd, 'USD')}</Text>
            <Text className="mt-2 text-sm font-semibold text-pine">{quantity(asset.current_quantity)} {asset.unit_code === 'UNIT' ? t('unit') : asset.unit_code}</Text>
            <Text className="mt-2 text-xs leading-5 text-sage">{t('reference', { price: money(asset.current_unit_price_usd, 'USD'), date: new Date(asset.valuation_as_of).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) })}</Text>
            {asset.valuation_basis === 'initial_reference' || asset.quote_missing ? <Text className="mt-2 text-xs leading-5 text-[#986329]">{t('referenceInitial')}</Text> : null}
            {asset.has_untracked_movements ? <Text className="mt-2 text-xs leading-5 text-[#986329]">{t('legacy')}</Text> : null}
            {overview.can_manage ? <View className="mt-4 flex-row flex-wrap gap-2"><Pressable accessibilityRole="button" onPress={() => move(asset)} className={`${actionClass} flex-grow bg-mint`}><Text className="text-center text-sm font-bold text-pine">{t('buy')}</Text></Pressable><Pressable disabled={asset.current_quantity <= 0 || asset.has_untracked_movements} accessibilityRole="button" onPress={() => move(asset, true)} className={`${actionClass} flex-grow ${asset.current_quantity <= 0 || asset.has_untracked_movements ? 'opacity-40' : ''}`}><Text className="text-center text-sm font-semibold text-pine">{t('withdraw')}</Text></Pressable></View> : null}
          </View>)}</View>}
          <View className="rounded-3xl bg-white p-5"><Text accessibilityRole="header" className="text-lg font-bold text-pine">{t('history')}</Text>{!overview.history.length ? <Text className="mt-3 text-sm text-sage">{t('noHistory')}</Text> : overview.history.map(movement => <View key={movement.id} className="mt-4 border-t border-[#E2EFE8] pt-4">
            <Text className="font-semibold text-pine">{movement.source_name} → {movement.destination_name}</Text><Text className="mt-1 text-sm text-sage">{quantity(movement.source_quantity)} {movement.source_unit === 'UNIT' ? t('unit') : movement.source_unit} → {quantity(movement.destination_quantity)} {movement.destination_unit === 'UNIT' ? t('unit') : movement.destination_unit}</Text>
            <Text className="mt-1 text-xs text-sage">{new Date(movement.created_at).toLocaleString(i18n.language)}{movement.settlement_usd !== null ? ` · ${money(movement.settlement_usd, 'USD')}` : ''}</Text>
            {movement.realized_result_usd !== 0 ? <Text className="mt-1 text-xs text-sage">{t('result', { amount: money(movement.realized_result_usd, 'USD') })}</Text> : null}
          </View>)}</View>
        </> : mode === 'choose' ? <View className="rounded-3xl bg-white p-5"><Text className="text-xl font-bold text-pine">{t('selectMode')}</Text><View className="mt-4 flex-row flex-wrap gap-3">{(['opening', 'new'] as const).map(choice => <Pressable key={choice} accessibilityRole="button" onPress={() => setMode(choice)} className={`${actionClass} min-w-[200px] flex-1`}><Text className="font-bold text-pine">{t(choice === 'opening' ? 'owned' : 'newPurchase')}</Text><Text className="mt-2 text-center text-sm leading-5 text-sage">{t(choice === 'opening' ? 'ownedNote' : 'newNote')}</Text></Pressable>)}</View><Pressable accessibilityRole="button" onPress={cancel} className="min-h-[48px] items-center p-3"><Text className="text-sage">{t('cancel')}</Text></Pressable></View>
        : mode === 'opening' || mode === 'new' ? <View><Text className="rounded-xl bg-mint p-4 text-sm leading-5 text-pine">{t(mode === 'opening' ? 'ownedNote' : 'newNote')}</Text><AssetsStep key={mode} householdId={householdId} currency={overview.currency} finishing={false} onFinish={async () => {}} onBack={cancel} management submitLabel={mode === 'new' ? t('continuePurchase') : undefined} onRegister={mode === 'new' ? purchase : undefined} onSaved={() => saved(true)} /></View>
        : <MovementForm householdId={householdId} overview={overview} endpoints={endpoints} initialSource={source} initialDestination={destination} onCancel={cancel} onSaved={() => saved()} />}
      </> : null}
    </View>
  </ScrollView>;
}
