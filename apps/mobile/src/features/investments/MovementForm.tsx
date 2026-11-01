import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Endpoint, Overview } from './types';

const decimal = (value: string) => value.trim().replace(',', '.');
const positive = (value: string) => /^\d+(\.\d{1,12})?$/.test(decimal(value)) && Number.isFinite(Number(decimal(value))) && Number(decimal(value)) > 0;
const input = 'mt-2 min-h-[48px] rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-4 py-3 text-base text-pine';

export default function MovementForm({ householdId, overview, endpoints, initialSource, initialDestination, onCancel, onSaved }: {
  householdId: string; overview: Overview; endpoints: Endpoint[]; initialSource?: Endpoint; initialDestination?: Endpoint; onCancel: () => void; onSaved: () => void;
}) {
  const { t, i18n } = useTranslation('investments');
  const [source, setSource] = useState<Endpoint | undefined>(initialSource);
  const [destination, setDestination] = useState<Endpoint | undefined>(initialDestination);
  const [picker, setPicker] = useState<'source' | 'destination' | null>(null);
  const [sourceAmount, setSourceAmount] = useState('');
  const [destinationAmount, setDestinationAmount] = useState(initialDestination?.draft ? String(initialDestination.draft.p_quantity) : '');
  const [usd, setUsd] = useState(initialDestination?.draft ? (Number(initialDestination.draft.p_quantity) * Number(initialDestination.draft.p_unit_price_usd)).toFixed(8) : '');
  const [fx, setFx] = useState(overview.currency === 'USD' ? '1' : '');
  const [fxDate, setFxDate] = useState('');
  const [note, setNote] = useState('');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(randomUUID);
  const bothOperating = source?.kind === 'operating' && destination?.kind === 'operating';
  const hasOperating = source?.kind === 'operating' || destination?.kind === 'operating';
  const units = (value: string, endpoint?: Endpoint) => `${Number(decimal(value)).toLocaleString(i18n.language, { maximumFractionDigits: 12 })} ${endpoint?.unit === 'UNIT' ? t('unit') : endpoint?.unit ?? ''}`;
  const usdMoney = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD' }).format(value);
  function choose(endpoint: Endpoint) {
    if (picker === 'source') { setSource(endpoint); setSourceAmount(''); }
    else { setDestination(endpoint); setDestinationAmount(''); }
    setPicker(null); setError(null); setReview(false);
  }
  async function onlineFx() {
    setQuoteBusy(true); setError(null);
    try {
      const response = await supabase.functions.invoke('asset-market', { body: { action: 'fx', currency: overview.currency } });
      if (response.error || !response.data?.fx?.rate) throw new Error('fx');
      setFx(Number(response.data.fx.rate).toFixed(10)); setFxDate(response.data.fx.asOf);
    } catch { setError(t('unavailable')); }
    finally { setQuoteBusy(false); }
  }
  function suggest() {
    setError(null);
    if (!source || !destination) { setError(t('validation')); return; }
    if (bothOperating) {
      if (positive(sourceAmount)) setDestinationAmount(decimal(sourceAmount));
      else if (positive(destinationAmount)) setSourceAmount(decimal(destinationAmount));
      return;
    }
    let value = Number(decimal(usd));
    if (!(value > 0)) {
      if (positive(destinationAmount) && destination.price) value = Number(decimal(destinationAmount)) * destination.price;
      else if (positive(sourceAmount) && source.price) value = Number(decimal(sourceAmount)) * source.price;
    }
    if (!(value > 0)) { setError(t('validation')); return; }
    // Round the actual local cash quantity first; the server verifies its USD equivalent.
    if (hasOperating) {
      if (!positive(fx)) { setError(t('fxMismatch', { currency: overview.currency })); return; }
      const cash = (value / Number(Number(decimal(fx)).toFixed(10))).toFixed(8);
      value = Number(cash) * Number(Number(decimal(fx)).toFixed(10));
      if (source.kind === 'operating') setSourceAmount(cash); else setDestinationAmount(cash);
    }
    setUsd(value.toFixed(8));
    if (source.kind !== 'operating' && source.price && !positive(sourceAmount)) setSourceAmount((value / source.price).toFixed(12));
    if (destination.kind !== 'operating' && destination.price && !positive(destinationAmount)) setDestinationAmount((value / destination.price).toFixed(12));
  }
  function validate() {
    if (!source || !destination || source.key === destination.key || !positive(sourceAmount) || !positive(destinationAmount) ||
      (!bothOperating && !positive(usd)) || (hasOperating && !bothOperating && !positive(fx))) return t('validation');
    if (source.balance !== undefined && Number(decimal(sourceAmount)) > source.balance) return t('insufficient');
    if (overview.wealth.assets.find(asset => asset.id === source.id)?.has_untracked_movements) return t('legacy');
    if (bothOperating && Number(decimal(sourceAmount)) !== Number(decimal(destinationAmount))) return t('sameCurrency');
    if (hasOperating && !bothOperating && Math.abs(Number(decimal(usd)) - Number(decimal(source.kind === 'operating' ? sourceAmount : destinationAmount)) * Number(Number(decimal(fx)).toFixed(10))) > 0.000000015) return t('fxMismatch', { currency: overview.currency });
    return null;
  }
  async function save() {
    const validation = validate(); if (validation) { setError(validation); setReview(false); return; }
    setBusy(true); setError(null);
    try {
      const draft = destination?.draft;
      const dest = draft ? { kind: 'new', asset: { type: draft.p_asset_type_code, name: draft.p_name, alias: draft.p_alias,
        symbol: draft.p_symbol, exchange: draft.p_exchange, unit_code: draft.p_unit_code, institution: draft.p_institution,
        maturity_date: draft.p_maturity_date, yield_settings: draft.p_yield_settings } } : { kind: destination!.kind, id: destination!.id };
      const response = await supabase.rpc('f_move_investment', { p_household_id: draft?.p_household_id ?? householdId,
        p_request_id: requestId, p_source: { kind: source!.kind, id: source!.id }, p_destination: dest,
        p_source_quantity: decimal(sourceAmount), p_destination_quantity: decimal(destinationAmount),
        p_settlement_usd: bothOperating ? undefined : decimal(usd), p_usd_per_household_unit: hasOperating && !bothOperating ? Number(decimal(fx)).toFixed(10) : undefined,
        p_note: note.trim() || undefined,
      });
      if (response.error) {
        const message = response.error.message;
        const key = /Insufficient/.test(message) ? 'error_insufficient' : /Legacy|reconciliation/.test(message) ? 'error_legacy' : /administrator/.test(message) ? 'error_admin' : /Request ID/.test(message) ? 'error_request' : /custody|preserve units/.test(message) ? 'error_custody' : /USD positions|one dollar/.test(message) ? 'error_usd' : 'saveError';
        throw new Error(t(key));
      }
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : t('saveError')); }
    finally { setBusy(false); }
  }
  return <View className="rounded-3xl border border-[#D3E8DC] bg-white p-5" testID="investment-movement-form">
    <Text accessibilityRole="header" className="text-xl font-bold text-pine">{t(review ? 'summary' : 'transfer')}</Text>
    {review ? <View className="mt-4 gap-3">
      <Text className="text-base font-semibold text-pine">{source?.label} → {destination?.label}</Text>
      <Text className="text-base leading-6 text-pine">{t('preview', { out: units(sourceAmount, source), in: units(destinationAmount, destination) })}</Text>
      {!bothOperating ? <Text className="text-lg font-bold text-pine">{usdMoney(Number(decimal(usd)))}</Text> : null}
      {hasOperating && !bothOperating ? <Text className="text-sm text-sage">1 {overview.currency} = {decimal(fx)} USD</Text> : null}
      {note.trim() ? <Text className="text-sm text-sage">{note}</Text> : null}
      <Text className="text-sm leading-5 text-sage">{t('actual')}</Text>
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => void save()} className={`min-h-[48px] items-center rounded-xl bg-pine p-4 ${busy ? 'opacity-50' : ''}`}><Text className="font-bold text-white">{t('confirm')}</Text></Pressable>
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => { setReview(false); setError(null); }} className="min-h-[48px] items-center p-3"><Text className="font-bold text-sage">{t('back')}</Text></Pressable>
    </View> : <>
      <View className="mt-4 flex-row flex-wrap gap-4">
        {(['source', 'destination'] as const).map(side => { const endpoint = side === 'source' ? source : destination; return <View key={side} className="min-w-[200px] flex-1">
          <Text className="font-semibold text-pine">{t(side === 'source' ? 'from' : 'to')}</Text>
          <Pressable disabled={busy || (side === 'destination' && destination?.kind === 'new')} accessibilityRole="button" accessibilityLabel={`${t(side === 'source' ? 'from' : 'to')}: ${endpoint?.label ?? t('choose')}`} onPress={() => setPicker(side)} className={`${input} flex-row items-center justify-between`}><Text className="mr-2 flex-1 text-pine">{endpoint?.label ?? t('choose')}</Text><Ionicons name="chevron-down" size={18} color="#0B3D2E" /></Pressable>
        </View>; })}
      </View>
      <View className="mt-5 flex-row flex-wrap gap-4">
        <View className="min-w-[200px] flex-1"><Text className="font-semibold text-pine">{t('amountOut')} · {source?.unit === 'UNIT' ? t('unit') : source?.unit}</Text><TextInput value={sourceAmount} onChangeText={setSourceAmount} accessibilityLabel={t('amountOut')} keyboardType="decimal-pad" maxLength={32} editable={!busy} className={input} /></View>
        <View className="min-w-[200px] flex-1"><Text className="font-semibold text-pine">{t('amountIn')} · {destination?.unit === 'UNIT' ? t('unit') : destination?.unit}</Text><TextInput value={destinationAmount} onChangeText={setDestinationAmount} accessibilityLabel={t('amountIn')} keyboardType="decimal-pad" maxLength={32} editable={!busy && destination?.kind !== 'new'} className={input} /></View>
      </View>
      {!bothOperating ? <View className="mt-5"><Text className="font-semibold text-pine">{t('settlement')}</Text><TextInput value={usd} onChangeText={setUsd} accessibilityLabel={t('settlement')} keyboardType="decimal-pad" maxLength={32} editable={!busy} className={input} /></View> : <Text className="mt-4 text-sm text-sage">{t('sameCurrency')}</Text>}
      {hasOperating && !bothOperating && overview.currency !== 'USD' ? <View className="mt-5">
        <Text className="font-semibold text-pine">{t('fx', { currency: overview.currency })}</Text>
        <TextInput value={fx} onChangeText={value => { setFx(value); setFxDate(''); }} accessibilityLabel={t('fx', { currency: overview.currency })} keyboardType="decimal-pad" maxLength={25} editable={!busy} className={input} />
        <Text className="mt-2 text-xs leading-5 text-sage">{t('fxHelp')}</Text>
        <Pressable disabled={busy || quoteBusy} accessibilityRole="button" onPress={() => void onlineFx()} className="mt-3 min-h-[48px] items-center rounded-xl bg-mint p-3"><Text className="font-semibold text-pine">{t('online')}</Text></Pressable>
        {fxDate ? <Text className="mt-2 text-xs leading-5 text-sage">{t('onlineNote', { date: new Date(fxDate).toLocaleString(i18n.language) })}</Text> : null}
      </View> : null}
      <Pressable disabled={busy || quoteBusy} accessibilityRole="button" onPress={suggest} className="mt-4 min-h-[48px] items-center rounded-xl bg-mint p-3"><Text className="text-center font-semibold text-pine">{t('suggest')}</Text></Pressable>
      <Text className="mt-2 text-xs leading-5 text-sage">{t('suggestNote')}</Text>
      <Text className="mt-5 font-semibold text-pine">{t('note')}</Text><TextInput value={note} onChangeText={setNote} maxLength={200} editable={!busy} accessibilityLabel={t('note')} className={input} />
      <Pressable disabled={busy || quoteBusy} accessibilityRole="button" onPress={() => { const issue = validate(); setError(issue); if (!issue) setReview(true); }} className="mt-5 min-h-[48px] items-center rounded-xl bg-pine p-4"><Text className="font-bold text-white">{t('review')}</Text></Pressable>
    </>}
    {error ? <Text accessibilityRole="alert" className="mt-4 text-sm leading-5 text-red-700">{error}</Text> : null}
    {busy || quoteBusy ? <ActivityIndicator className="mt-3" color="#0B3D2E" /> : null}
    <Pressable disabled={busy} accessibilityRole="button" onPress={onCancel} className="mt-2 min-h-[48px] items-center p-3"><Text className="text-sage">{t('cancel')}</Text></Pressable>
    <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
      <View className="flex-1 items-center justify-center bg-black/40 p-4"><View className="max-h-[80%] w-full max-w-xl rounded-3xl bg-white p-5">
        <Text accessibilityRole="header" className="text-lg font-bold text-pine">{t('choose')}</Text>
        <ScrollView className="mt-3" keyboardShouldPersistTaps="handled">{endpoints.filter(endpoint => endpoint.key !== (picker === 'source' ? destination?.key : source?.key)).map(endpoint => <Pressable key={endpoint.key} accessibilityRole="button" onPress={() => choose(endpoint)} className="min-h-[56px] border-b border-[#E2EFE8] py-4"><Text className="font-semibold text-pine">{endpoint.label}</Text><Text className="mt-1 text-sm text-sage">{endpoint.balance?.toLocaleString(i18n.language, { maximumFractionDigits: 12 })} {endpoint.unit === 'UNIT' ? t('unit') : endpoint.unit}</Text></Pressable>)}</ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setPicker(null)} className="min-h-[48px] items-center p-3"><Text className="font-semibold text-pine">{t('cancel')}</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}
