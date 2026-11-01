import './vaults.i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Account } from './types';

type Vault = { id: string; name: string; account_id: string; currency: string; goal: number | null; balance: number };
type Endpoint = { id: string; kind: 'operating' | 'vault'; name: string; currency: string; balance: number };
type VaultMovement = { id: string; created_at: string; movement: { source_name: string; destination_name: string; source_amount: number; destination_amount: number; source_currency: string; destination_currency: string; household_per_usd: number | null } };
type Report = { vaults: Vault[]; totals: { currency: string; balance: number }[]; history: VaultMovement[] };
const input = 'mt-2 min-h-[48px] rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-4 py-3 text-base text-pine';
const button = 'min-h-[48px] items-center justify-center rounded-xl border border-[#D3E8DC] px-4 py-3';
const decimal = (value: string) => value.trim().replace(',', '.');
const valid = (value: string) => /^\d+(\.\d{1,8})?$/.test(decimal(value)) && Number.isFinite(Number(decimal(value))) && Number(decimal(value)) > 0;

export default function VaultsPanel({ householdId, currency, accounts, canManage, onChanged }: { householdId: string; currency: string; accounts: Account[]; canManage: boolean; onChanged: (created?: boolean) => void }) {
  const { t, i18n } = useTranslation('vaults');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<'list' | 'create' | 'move'>('list');
  const [source, setSource] = useState<Endpoint>();
  const [destination, setDestination] = useState<Endpoint>();
  const [name, setName] = useState('');
  const [vaultCurrency, setVaultCurrency] = useState(currency);
  const [goal, setGoal] = useState('');
  const [requestId, setRequestId] = useState(randomUUID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setFailed(false);
    supabase.rpc('f_saving_vaults', { p_household_id: householdId }).then(response => {
      if (cancelled) return;
      if (response.error) setFailed(true); else setReport(response.data as unknown as Report);
      setLoading(false);
    }, () => { if (!cancelled) { setLoading(false); setFailed(true); } });
    return () => { cancelled = true; };
  }, [householdId, retry]);
  const money = (value: number, code: string) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: code, maximumFractionDigits: 8 }).format(value);
  const endpoints: Endpoint[] = [...accounts.map(account => ({ id: account.id, kind: 'operating' as const, name: account.code === '110' ? t('available') : account.name, currency: account.currency, balance: account.balance })), ...(report?.vaults ?? []).map(vault => ({ id: vault.id, kind: 'vault' as const, name: vault.name, currency: vault.currency, balance: vault.balance }))];
  function open(vault: Vault, release: boolean) {
    const endpoint = endpoints.find(item => item.id === vault.id);
    const cash = endpoints.find(item => item.kind === 'operating');
    setSource(release ? endpoint : cash); setDestination(release ? cash : endpoint); setMode('move'); setError(null);
  }
  async function create() {
    if (!name.trim() || (goal.trim() && !valid(goal))) { setError(t('validation')); return; }
    setBusy(true); setError(null);
    try {
      const response = await supabase.rpc('f_create_saving_vault', { p_household_id: householdId, p_request_id: requestId, p_name: name.trim(), p_currency: vaultCurrency, p_goal: goal.trim() ? decimal(goal) : undefined });
      if (response.error) throw response.error;
      onChanged(true);
    } catch (err) { setError(t(typeof err === 'object' && err && 'message' in err && /Request ID/.test(String(err.message)) ? 'requestError' : 'saveError')); }
    finally { setBusy(false); }
  }
  return <View className="gap-4" testID="saving-vaults">
    <View className="flex-row flex-wrap items-center justify-between gap-3"><Text accessibilityRole="header" className="text-xl font-bold text-pine">{t('title')}</Text>{canManage && mode === 'list' && !loading && !failed ? <Pressable accessibilityRole="button" onPress={() => { setName(''); setGoal(''); setVaultCurrency(currency); setRequestId(randomUUID()); setError(null); setMode('create'); }} className={`${button} flex-row gap-2 bg-mint`}><Ionicons name="lock-closed-outline" size={19} color="#0B3D2E" /><Text className="font-semibold text-pine">{t('create')}</Text></Pressable> : null}</View>
    <Text className="text-sm leading-5 text-sage">{t('note')}</Text>
    {loading ? <ActivityIndicator accessibilityLabel={t('loading')} color="#0B3D2E" /> : failed ? <View className="rounded-2xl bg-white p-4"><Text accessibilityRole="alert" className="text-red-700">{t('error')}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} className={`${button} mt-3`}><Text className="text-pine">{t('retry')}</Text></Pressable></View> : report ? <>
      {report.totals.length ? <View className="flex-row flex-wrap gap-3">{report.totals.map(total => <View key={total.currency} className="min-w-[200px] flex-1 rounded-2xl bg-[#E4F2EA] p-4"><Text className="text-sm text-sage">{t('reserved', { currency: total.currency })}</Text><Text className="mt-1 text-xl font-bold text-pine">{money(total.balance, total.currency)}</Text></View>)}</View> : null}
      {mode === 'create' ? <View className="rounded-3xl bg-white p-5">
        <Text className="text-lg font-bold text-pine">{t('create')}</Text><Text className="mt-4 font-semibold text-pine">{t('name')}</Text><TextInput value={name} onChangeText={setName} maxLength={100} editable={!busy} accessibilityLabel={t('name')} placeholder={t('placeholder')} className={input} />
        <Text className="mt-5 font-semibold text-pine">{t('currency')}</Text><View accessibilityRole="radiogroup" accessibilityLabel={t('currency')} className="mt-2 flex-row flex-wrap gap-3">{[...new Set([currency, 'USD'])].map(code => <Pressable key={code} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: vaultCurrency === code }} onPress={() => setVaultCurrency(code)} className={`${button} flex-1 ${vaultCurrency === code ? 'border-pine bg-mint' : 'bg-white'}`}><Text className="font-bold text-pine">{code}</Text></Pressable>)}</View><Text className="mt-2 text-xs leading-5 text-sage">{t('fixed')}</Text>
        <Text className="mt-5 font-semibold text-pine">{t('goal')} · {vaultCurrency}</Text><TextInput value={goal} onChangeText={setGoal} editable={!busy} maxLength={25} keyboardType="decimal-pad" accessibilityLabel={t('goal')} className={input} />
        {error ? <Text accessibilityRole="alert" className="mt-3 text-red-700">{error}</Text> : null}
        <Pressable disabled={busy} accessibilityRole="button" onPress={() => void create()} className={`${button} mt-5 bg-pine ${busy ? 'opacity-50' : ''}`}><Text className="font-bold text-white">{t('save')}</Text></Pressable>{busy ? <ActivityIndicator className="mt-3" color="#0B3D2E" /> : null}<Pressable disabled={busy} accessibilityRole="button" onPress={() => setMode('list')} className={`${button} mt-2 border-transparent`}><Text className="text-sage">{t('cancel')}</Text></Pressable>
      </View> : mode === 'move' ? <VaultTransfer householdId={householdId} currency={currency} endpoints={endpoints} initialSource={source} initialDestination={destination} onCancel={() => setMode('list')} onSaved={onChanged} /> : <>
        {!report.vaults.length ? <Text className="rounded-2xl bg-white p-5 text-sm leading-6 text-sage">{t('empty')}</Text> : <View className="flex-row flex-wrap gap-4">{report.vaults.map(vault => <View key={vault.id} className="min-w-[250px] flex-1 rounded-3xl border border-[#D3E8DC] bg-white p-5">
          <View className="flex-row items-center gap-2"><Ionicons name="lock-closed-outline" size={22} color="#0B3D2E" /><Text className="flex-1 text-lg font-bold text-pine">{vault.name}</Text><Text className="rounded-lg bg-mint px-2 py-1 text-xs font-bold text-pine">{vault.currency}</Text></View>
          <Text className="mt-4 text-xs text-sage">{t('balance')}</Text><Text className="mt-1 text-2xl font-extrabold text-pine">{money(vault.balance, vault.currency)}</Text>
          {vault.goal ? <View className="mt-3"><Text className="text-xs text-sage">{t('target', { amount: money(vault.goal, vault.currency) })}</Text><View className="mt-2 h-2 overflow-hidden rounded-full bg-[#E4F2EA]"><View className="h-2 rounded-full bg-pine" style={{ width: `${Math.max(0, Math.min(100, vault.balance / vault.goal * 100))}%` }} /></View></View> : null}
          {canManage ? <View className="mt-4 flex-row flex-wrap gap-2"><Pressable accessibilityRole="button" accessibilityLabel={`${t('fund')}: ${vault.name}`} onPress={() => open(vault, false)} className={`${button} flex-grow bg-mint`}><Text className="text-sm font-semibold text-pine">{t('fund')}</Text></Pressable><Pressable disabled={vault.balance <= 0} accessibilityRole="button" accessibilityLabel={`${t('release')}: ${vault.name}`} onPress={() => open(vault, true)} className={`${button} flex-grow ${vault.balance <= 0 ? 'opacity-40' : ''}`}><Text className="text-sm font-semibold text-pine">{t('release')}</Text></Pressable></View> : null}
        </View>)}</View>}
      </>}
      {report.history.length && mode === 'list' ? <View className="rounded-3xl bg-white p-5"><Text className="text-lg font-bold text-pine">{t('history')}</Text>{report.history.map(row => <View key={row.id} className="mt-4 border-t border-[#E2EFE8] pt-3"><Text className="font-semibold text-pine">{row.movement.source_name} → {row.movement.destination_name}</Text><Text className="mt-1 text-sm text-sage">{money(row.movement.source_amount, row.movement.source_currency)} → {money(row.movement.destination_amount, row.movement.destination_currency)}</Text><Text className="mt-1 text-xs text-sage">{new Date(row.created_at).toLocaleString(i18n.language)}</Text></View>)}</View> : null}
    </> : null}
  </View>;
}

function VaultTransfer({ householdId, currency, endpoints, initialSource, initialDestination, onCancel, onSaved }: {
  householdId: string; currency: string; endpoints: Endpoint[]; initialSource?: Endpoint; initialDestination?: Endpoint; onCancel: () => void; onSaved: () => void;
}) {
  const { t, i18n } = useTranslation('vaults');
  const [source, setSource] = useState(initialSource);
  const [destination, setDestination] = useState(initialDestination);
  const [picker, setPicker] = useState<'source' | 'destination' | null>(null);
  const [amount, setAmount] = useState('');
  const [fx, setFx] = useState('');
  const [quoteDate, setQuoteDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(randomUUID);
  const cross = !!source && !!destination && source.currency !== destination.currency;
  const rate = Number(decimal(fx));
  const rateValid = /^\d+(\.\d{1,10})?$/.test(decimal(fx)) && Number.isFinite(rate) && rate > 0;
  const received = valid(amount) && (!cross || rateValid) ? (cross ? source?.currency === 'USD' ? Number(decimal(amount)) * rate : Number(decimal(amount)) / rate : Number(decimal(amount))).toFixed(8) : '';
  const money = (value: string, code?: string) => code ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency: code, maximumFractionDigits: 8 }).format(Number(decimal(value))) : '';
  function validate() {
    if (!source || !destination || source.id === destination.id || !valid(amount) || !valid(received) || (cross && !rateValid)) return t('transferValidation');
    if (Number(decimal(amount)) > source.balance) return t('insufficient');
    return null;
  }
  async function lookup() {
    setQuoteBusy(true); setError(null);
    try {
      const response = await supabase.functions.invoke('asset-market', { body: { action: 'fx', currency } });
      if (response.error || !response.data?.fx?.rate) throw new Error('fx');
      setFx((1 / Number(response.data.fx.rate)).toFixed(10)); setQuoteDate(response.data.fx.asOf);
    } catch { setError(t('onlineError')); }
    finally { setQuoteBusy(false); }
  }
  async function save() {
    const issue = validate(); if (issue) { setError(issue); setReview(false); return; }
    setBusy(true); setError(null);
    try {
      const response = await supabase.rpc('f_transfer_saving_vault', { p_household_id: householdId, p_request_id: requestId,
        p_source: { kind: source!.kind, id: source!.id }, p_destination: { kind: destination!.kind, id: destination!.id },
        p_source_amount: decimal(amount), p_destination_amount: received, p_household_per_usd: cross ? decimal(fx) : undefined,
        p_rate_as_of: cross && quoteDate ? quoteDate : undefined });
      if (response.error) throw response.error;
      onSaved();
    } catch (err) {
      const message = typeof err === 'object' && err && 'message' in err ? String(err.message) : '';
      setError(t(/Insufficient/.test(message) ? 'insufficient' : /Request ID/.test(message) ? 'requestError' : 'saveError'));
    } finally { setBusy(false); }
  }
  return <View className="rounded-3xl border border-[#D3E8DC] bg-white p-5" testID="vault-transfer">
    <Text accessibilityRole="header" className="text-lg font-bold text-pine">{t(review ? 'summary' : 'transfer')}</Text>
    {review ? <View className="mt-4 gap-4"><Text className="text-base leading-6 text-pine">{t('preview', { out: money(amount, source?.currency), source: source?.name, in: money(received, destination?.currency), destination: destination?.name })}</Text>{cross ? <Text className="text-sm text-sage">1 USD = {decimal(fx)} {currency}</Text> : null}<Text className="text-sm leading-5 text-sage">{t('recordNote')}</Text><Pressable disabled={busy} accessibilityRole="button" onPress={() => void save()} className={`${button} bg-pine ${busy ? 'opacity-50' : ''}`}><Text className="font-bold text-white">{t('confirm')}</Text></Pressable><Pressable disabled={busy} accessibilityRole="button" onPress={() => setReview(false)} className={button}><Text className="text-pine">{t('edit')}</Text></Pressable></View> : <>
      <View className="mt-4 flex-row flex-wrap gap-4">{(['source', 'destination'] as const).map(side => { const endpoint = side === 'source' ? source : destination; return <View key={side} className="min-w-[200px] flex-1"><Text className="font-semibold text-pine">{t(side === 'source' ? 'from' : 'to')}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${t(side === 'source' ? 'from' : 'to')}: ${endpoint?.name ?? t('choose')}`} onPress={() => setPicker(side)} className={`${input} flex-row items-center gap-2`}><Text className="flex-1 text-pine">{endpoint ? `${endpoint.name} · ${endpoint.currency}` : t('choose')}</Text><Ionicons name="chevron-down" size={18} color="#0B3D2E" /></Pressable></View>; })}</View>
      <Text className="mt-5 font-semibold text-pine">{t('amount')} · {source?.currency}</Text><TextInput value={amount} onChangeText={setAmount} maxLength={30} keyboardType="decimal-pad" editable={!busy && !quoteBusy} accessibilityLabel={t('amount')} className={input} />
      {cross ? <View className="mt-5"><Text className="font-semibold text-pine">{t('fx', { currency })}</Text><TextInput value={fx} onChangeText={value => { setFx(value); setQuoteDate(''); }} maxLength={30} keyboardType="decimal-pad" editable={!busy && !quoteBusy} accessibilityLabel={t('fx', { currency })} className={input} /><Text className="mt-2 text-xs leading-5 text-sage">{t('fxNote')}</Text><Pressable disabled={quoteBusy} accessibilityRole="button" onPress={() => void lookup()} className={`${button} mt-3 bg-mint`}><Text className="font-semibold text-pine">{t('online')}</Text></Pressable>{quoteDate ? <Text className="mt-2 text-xs leading-5 text-sage">{t('quote', { date: new Date(quoteDate).toLocaleString(i18n.language) })}</Text> : null}</View> : null}
      <View className="mt-5 rounded-xl bg-mint p-4"><Text className="text-sm text-sage">{t('received')}</Text><Text className="mt-1 text-xl font-bold text-pine">{received ? money(received, destination?.currency) : '—'}</Text></View>
      <Pressable disabled={quoteBusy} accessibilityRole="button" onPress={() => { const issue = validate(); setError(issue); if (!issue) setReview(true); }} className={`${button} mt-4 bg-pine`}><Text className="font-bold text-white">{t('review')}</Text></Pressable>
    </>}
    {error ? <Text accessibilityRole="alert" className="mt-3 text-sm text-red-700">{error}</Text> : null}{busy || quoteBusy ? <ActivityIndicator className="mt-3" color="#0B3D2E" /> : null}
    <Pressable disabled={busy} accessibilityRole="button" onPress={onCancel} className={`${button} mt-2 border-transparent`}><Text className="text-sage">{t('cancel')}</Text></Pressable>
    <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}><View className="flex-1 items-center justify-center bg-black/40 p-4"><View className="max-h-[80%] w-full max-w-xl rounded-3xl bg-white p-5"><Text className="text-lg font-bold text-pine">{t('choose')}</Text><ScrollView className="mt-3">{endpoints.filter(item => item.id !== (picker === 'source' ? destination?.id : source?.id) && !(item.kind === 'operating' && (picker === 'source' ? destination?.kind : source?.kind) === 'operating')).map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => { if (picker === 'source') setSource(item); else setDestination(item); setPicker(null); setError(null); }} className="min-h-[56px] border-b border-[#E2EFE8] py-3"><Text className="font-semibold text-pine">{item.name} · {item.currency}</Text><Text className="mt-1 text-sm text-sage">{money(String(item.balance), item.currency)}</Text></Pressable>)}</ScrollView><Pressable accessibilityRole="button" onPress={() => setPicker(null)} className={`${button} mt-2`}><Text className="text-pine">{t('cancel')}</Text></Pressable></View></View></Modal>
  </View>;
}
