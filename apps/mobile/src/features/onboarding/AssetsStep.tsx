import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { supabase, type Database } from '../../lib/supabase';

type AssetType = Database['budget']['Tables']['tasset_type']['Row'];
type Position = Database['budget']['Tables']['tasset_position']['Row'];
type Instrument = { symbol: string; name: string; exchange: string; currency: string; type: string };
type Quote = { price: number; currency: string; asOf: string; symbol: string; exchange: string };
type FxQuote = { currency: string; rate: number; asOf: string; provider: string };
export type AssetRegistration = Database['public']['Functions']['f_register_household_asset']['Args'];
interface Props { householdId: string; currency: string; finishing: boolean; onFinish: () => Promise<void>; onBack: () => void; management?: boolean; onRegister?: (draft: AssetRegistration) => Promise<void> | void; onSaved?: () => void; submitLabel?: string }

export default function AssetsStep({ householdId, currency, finishing, onFinish, onBack, management = false, onRegister, onSaved, submitLabel }: Props) {
  const { t, i18n } = useTranslation('onboarding');
  const [types, setTypes] = useState<AssetType[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marketBusy, setMarketBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(management);
  const [type, setType] = useState<AssetType | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Instrument[]>([]);
  const [searched, setSearched] = useState(false);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [unitCode, setUnitCode] = useState(currency);
  const [institution, setInstitution] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [hasYield, setHasYield] = useState(false);
  const [yieldKind, setYieldKind] = useState('interest');
  const [remind, setRemind] = useState(false);
  const [reminderDay, setReminderDay] = useState('1');
  const [rateAsOf, setRateAsOf] = useState(() => new Date().toISOString());
  const [fxQuote, setFxQuote] = useState<FxQuote | null>(null);
  const [requestId, setRequestId] = useState(() => randomUUID());
  const busy = loading || saving || marketBusy || finishing;
  const amount = (value: string) => Number(value.trim().replace(',', '.'));
  const valid = (value: string) => /^\d+(\.\d{1,12})?$/.test(value.trim().replace(',', '.')) && Number.isFinite(amount(value)) && amount(value) > 0;
  const usd = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  const inputClass = 'mt-2 rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-4 py-3 text-base text-pine';

  async function load() {
    setLoading(true); setLoadFailed(false); setError(null);
    try {
      const [catalog, assets] = await Promise.all([
        supabase.schema('budget').from('tasset_type').select('*').order('sort_order'),
        supabase.schema('budget').from('tasset_position').select('*').eq('household_id', householdId)
          .eq('status', 'active').is('deleted_at', null).order('created_at'),
      ]);
      if (catalog.error || assets.error) throw catalog.error ?? assets.error;
      setTypes(catalog.data ?? []); setPositions(assets.data ?? []);
    } catch { setLoadFailed(true); setError(t('assets.loadError')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [householdId]);
  function reset() {
    setFormOpen(false); setType(null); setQuery(''); setResults([]); setSearched(false);
    setInstrument(null); setName(''); setAlias(''); setQuantity('1'); setPrice(''); setQuote(null);
    setRequestId(randomUUID()); setError(null);
    setUnitCode(currency); setInstitution(''); setMaturityDate(''); setHasYield(false);
    setYieldKind('interest'); setRemind(false); setReminderDay('1'); setRateAsOf(new Date().toISOString());
    setFxQuote(null);
  }
  async function market(body: Record<string, string>) {
    const response = await supabase.functions.invoke('asset-market', { body });
    if (response.error) {
      let code = 'market_unavailable';
      try { code = (await response.error.context.json()).error ?? code; } catch { /* No response body. */ }
      throw new Error(t(`assets.errors.${code}`, { defaultValue: t('assets.errors.market_unavailable') }));
    }
    return response.data;
  }
  async function search() {
    if (!type || query.trim().length < 2) { setError(t('assets.queryRequired')); return; }
    setMarketBusy(true); setError(null); setSearched(false); setResults([]);
    try { const data = await market({ action: 'search', query: query.trim(), kind: type.code }); setResults(data.instruments); setSearched(true); }
    catch (err) { setError(err instanceof Error ? err.message : t('assets.errors.market_unavailable')); }
    finally { setMarketBusy(false); }
  }
  function select(value: Instrument) {
    setInstrument(value); setName(value.name); setResults([]); setPrice(''); setQuote(null); setError(null);
  }
  async function currentPrice() {
    if (!instrument) return;
    setMarketBusy(true); setError(null);
    try {
      const data = await market({ action: 'quote', symbol: instrument.symbol, exchange: instrument.exchange });
      setQuote(data.quote); setPrice(String(data.quote.price));
    } catch (err) { setError(err instanceof Error ? err.message : t('assets.errors.market_unavailable')); }
    finally { setMarketBusy(false); }
  }
  async function currentExchangeRate() {
    if (!/^[A-Z]{3}$/.test(unitCode) || unitCode === 'USD') return;
    setMarketBusy(true); setError(null);
    try {
      const data = await market({ action: 'fx', currency: unitCode });
      setFxQuote(data.fx); setPrice(String(data.fx.rate));
    } catch (err) { setError(err instanceof Error ? err.message : t('assets.errors.fx_unavailable')); }
    finally { setMarketBusy(false); }
  }
  async function save() {
    if (!type || !name.trim() || !valid(quantity) || !valid(price) || (type.market_priced && !instrument)) {
      setError(t('assets.validation')); return;
    }
    if ((type.unit_kind === 'fiat' && !/^[A-Z]{3}$/.test(unitCode)) ||
      (remind && (!/^\d{1,2}$/.test(reminderDay) || Number(reminderDay) < 1 || Number(reminderDay) > 31)) ||
      (maturityDate && !/^\d{4}-\d{2}-\d{2}$/.test(maturityDate))) {
      setError(t('assets.preferencesInvalid')); return;
    }
    setSaving(true); setError(null);
    try {
      // Historical purchase costs remain private. Refresh the public reference
      // when available, but a manually recorded purchase can survive provider failure.
      try {
        if (type.market_priced) {
          await market({ action: 'sync_quote', kind: type.code, symbol: instrument!.symbol, exchange: instrument!.exchange });
        } else if (type.unit_kind === 'fiat') {
          await market({ action: 'sync_quote', kind: 'fiat', currency: unitCode });
        }
      } catch (err) { if (!onRegister) throw err; }
      const draft: AssetRegistration = {
        p_household_id: householdId, p_asset_type_code: type.code, p_name: name.trim(),
        p_quantity: quantity.trim().replace(',', '.'), p_unit_price_usd: price.trim().replace(',', '.'), p_request_id: requestId,
        p_price_basis: quote ? 'market_estimate' : type.market_priced ? 'purchase_price' : 'estimated_value',
        p_alias: alias.trim() || undefined, p_symbol: instrument?.symbol ?? undefined,
        p_exchange: instrument?.exchange ?? undefined, p_price_as_of: quote?.asOf ?? undefined,
        p_unit_code: type.unit_kind === 'fiat' ? unitCode : undefined,
        p_rate_source: type.unit_kind === 'fiat' ? (fxQuote?.provider ?? (unitCode === 'USD' ? 'identity' : 'manual')) : undefined,
        p_rate_as_of: type.unit_kind === 'fiat' ? (fxQuote?.asOf ?? rateAsOf) : undefined,
        p_institution: institution.trim() || undefined, p_maturity_date: maturityDate || undefined,
        p_yield_settings: { enabled: hasYield, yield_kind: hasYield ? yieldKind : null,
          reminder_enabled: hasYield && remind, reminder_day: hasYield && remind ? Number(reminderDay) : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
      };
      if (onRegister) { await onRegister(draft); return; }
      const response = await supabase.rpc('f_register_household_asset', draft);
      if (response.error) throw response.error;
      reset(); await load(); onSaved?.();
    } catch (err) { setError(err instanceof Error ? err.message : t('saveError')); }
    finally { setSaving(false); }
  }
  async function remove(position: Position) {
    setSaving(true); setError(null);
    try {
      const response = await supabase.rpc('f_remove_household_asset', { p_position_id: position.id });
      if (response.error) throw response.error;
      setPositions((rows) => rows.filter((row) => row.id !== position.id));
    } catch { setError(t('saveError')); }
    finally { setSaving(false); }
  }
  async function finish() {
    if (formOpen && (name.trim() || alias.trim() || price.trim() || instrument)) { setError(t('assets.unsaved')); return; }
    await onFinish();
  }
  return (
    <View className="mt-6 gap-4" testID="onboarding-assets">
      {!management ? <View className="flex-row items-start gap-3 rounded-2xl bg-white p-4">
        <Ionicons name="information-circle-outline" size={22} color="#0B3D2E" />
        <Text className="flex-1 text-sm leading-5 text-sage">{t('assets.note')}</Text>
      </View> : null}
      {loading ? <ActivityIndicator color="#0B3D2E" /> : null}
      {!management && positions.length ? <View className="rounded-2xl bg-pine p-5"><Text className="text-sm text-white">{t('assets.total')}</Text><Text className="mt-1 text-2xl font-bold text-white">{usd(positions.reduce((sum, row) => sum + Number(row.opening_value_usd), 0))}</Text></View> : null}
      {(!management ? positions : []).map((position) => (
        <View key={position.id} className="rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-pine">{position.alias || position.name}</Text>
          {position.alias ? <Text className="mt-1 text-sm text-sage">{position.name}</Text> : null}
          <Text className="mt-1 text-sm text-sage">{position.symbol ? `${position.symbol} · ` : ''}{position.quantity}{position.unit_kind === 'fiat' ? ` ${position.unit_code}` : ''} × {usd(position.reference_unit_price_usd)}</Text>
          <Text className="mt-2 text-lg font-bold text-pine">{usd(position.opening_value_usd)}</Text>
          <Text className="mt-1 text-xs text-sage">{t(`assets.basis.${position.price_basis}`)}</Text>
          <Pressable disabled={busy} onPress={() => void remove(position)} accessibilityRole="button" className="mt-2 py-2"><Text className="text-red-700">{t('assets.remove')}</Text></Pressable>
        </View>
      ))}
      {!management && !formOpen && !loadFailed && !loading ? <Pressable disabled={busy} onPress={() => setFormOpen(true)} accessibilityRole="button" className="items-center rounded-2xl border border-[#D3E8DC] bg-white p-5">
        <Ionicons name="add-circle-outline" size={28} color="#0B3D2E" /><Text className="mt-2 font-bold text-pine">{t(positions.length ? 'assets.addAnother' : 'assets.configure')}</Text>
      </Pressable> : null}
      {formOpen ? <View className="rounded-3xl bg-white p-5">
        <Text className="text-lg font-bold text-pine">{t('assets.chooseType')}</Text>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {types.map((item) => <Pressable key={item.code} disabled={busy} onPress={() => { reset(); setFormOpen(true); setType(item); if (item.unit_kind === 'fiat' && currency === 'USD') setPrice('1'); }}
            accessibilityRole="button" accessibilityState={{ selected: type?.code === item.code, disabled: busy }}
            className={`min-w-[90px] flex-grow items-center rounded-2xl border p-3 ${type?.code === item.code ? 'bg-mint border-pine' : 'border-[#D3E8DC]'}`}>
            <Ionicons name={item.icon as ComponentProps<typeof Ionicons>['name']} size={25} color="#0B3D2E" />
            <Text className="mt-2 text-center text-sm font-semibold text-pine">{t(`assets.types.${item.code}`)}</Text>
          </Pressable>)}
        </View>
        {type ? <View className="mt-6">
          {type.market_priced ? <View>
            <Text className="font-semibold text-pine">{t('assets.searchLabel')}</Text>
            <TextInput value={query} onChangeText={(value) => { setQuery(value); setSearched(false); }} maxLength={80} editable={!busy} accessibilityLabel={t('assets.searchLabel')} placeholder={t('assets.searchPlaceholder')} className={inputClass} />
            <Pressable disabled={busy} onPress={() => void search()} accessibilityRole="button" className="mt-3 items-center rounded-xl bg-mint p-3"><Text className="font-bold text-pine">{t('assets.search')}</Text></Pressable>
            {searched && !results.length && !instrument ? <Text className="mt-3 text-sm text-sage">{t('assets.noResults')}</Text> : null}
            {results.map((result) => <Pressable key={`${result.symbol}:${result.exchange}`} disabled={busy} onPress={() => select(result)} accessibilityRole="button" className="mt-2 rounded-xl border border-[#D3E8DC] p-3">
              <Text className="font-bold text-pine">{result.name}</Text><Text className="text-sm text-sage">{result.symbol} · {result.exchange || 'Crypto'} · USD</Text>
            </Pressable>)}
            {instrument ? <View className="mt-3 rounded-xl bg-mint p-3"><Text className="font-bold text-pine">{instrument.name}</Text><Text className="text-sm text-sage">{instrument.symbol} · {instrument.exchange} · USD</Text></View> : null}
          </View> : <View>
            <Text className="font-semibold text-pine">{t('assets.name')}</Text>
            <TextInput value={name} onChangeText={setName} maxLength={150} editable={!busy} accessibilityLabel={t('assets.name')} placeholder={t(`assets.types.${type.code}`)} className={inputClass} />
          </View>}
          <Text className="mt-5 font-semibold text-pine">{t('assets.alias')}</Text>
          <TextInput value={alias} onChangeText={setAlias} maxLength={100} editable={!busy} accessibilityLabel={t('assets.alias')} placeholder={t('assets.aliasPlaceholder')} className={inputClass} />
          {type.unit_kind === 'fiat' ? <View>
            <Text className="mt-5 font-semibold text-pine">{t('assets.originalCurrency')}</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={t('assets.originalCurrency')} className="mt-2 flex-row flex-wrap gap-3">
              {[...new Set([currency, 'USD'])].map(code => <Pressable key={code} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: unitCode === code, disabled: busy }} onPress={() => { if (unitCode === code) return; setUnitCode(code); setPrice(code === 'USD' ? '1' : ''); setFxQuote(null); setRateAsOf(new Date().toISOString()); }} className={`min-w-[100px] flex-1 items-center rounded-xl border px-5 py-3 ${unitCode === code ? 'border-pine bg-mint' : 'border-[#D3E8DC] bg-white'}`}>
                <Text className="font-bold text-pine">{code}</Text>
              </Pressable>)}
            </View>
            <Text className="mt-5 font-semibold text-pine">{t('assets.institution')}</Text>
            <TextInput value={institution} onChangeText={setInstitution} maxLength={150} editable={!busy} accessibilityLabel={t('assets.institution')} className={inputClass} />
            {type.code === 'term_deposit' ? <View><Text className="mt-5 font-semibold text-pine">{t('assets.maturityDate')}</Text><TextInput value={maturityDate} onChangeText={setMaturityDate} maxLength={10} placeholder="YYYY-MM-DD" editable={!busy} accessibilityLabel={t('assets.maturityDate')} className={inputClass} /></View> : null}
          </View> : null}
          <Text className="mt-5 font-semibold text-pine">{t(type.unit_kind === 'fiat' ? 'assets.originalBalance' : 'assets.quantity')}</Text>
          <TextInput value={quantity} onChangeText={setQuantity} maxLength={25} keyboardType="decimal-pad" editable={!busy} accessibilityLabel={t(type.unit_kind === 'fiat' ? 'assets.originalBalance' : 'assets.quantity')} className={inputClass} />
          <Text className="mt-5 font-semibold text-pine">{t(type.unit_kind === 'fiat' ? 'assets.usdPerUnit' : type.market_priced ? 'assets.purchasePrice' : 'assets.estimatedValue', { currency: unitCode })}</Text>
          <TextInput value={price} onChangeText={(value) => { setPrice(value); setQuote(null); setFxQuote(null); setRateAsOf(new Date().toISOString()); }} maxLength={25} keyboardType="decimal-pad" editable={!busy && !(type.unit_kind === 'fiat' && unitCode === 'USD')} accessibilityLabel={t(type.unit_kind === 'fiat' ? 'assets.usdPerUnit' : type.market_priced ? 'assets.purchasePrice' : 'assets.estimatedValue', { currency: unitCode })} placeholder="USD 0.00" className={inputClass} />
          {type.unit_kind === 'fiat' ? <Text className="mt-2 text-xs leading-5 text-sage">{t('assets.fxHelp')}</Text> : null}
          {type.unit_kind === 'fiat' && unitCode !== 'USD' ? <Pressable disabled={busy || !/^[A-Z]{3}$/.test(unitCode)} onPress={() => void currentExchangeRate()} accessibilityRole="button" className={`mt-3 rounded-xl bg-mint p-3 ${!/^[A-Z]{3}$/.test(unitCode) ? 'opacity-50' : ''}`}><Text className="text-center font-semibold text-pine">{t('assets.useFxQuote')}</Text></Pressable> : null}
          {fxQuote ? <Text className="mt-3 text-xs leading-5 text-sage">{t('assets.fxQuoteNote', { currency: fxQuote.currency, rate: fxQuote.rate, date: new Date(fxQuote.asOf).toLocaleString(i18n.language) })}</Text> : null}
          {type.market_priced ? <Pressable disabled={busy || !instrument} onPress={() => void currentPrice()} accessibilityRole="button" className={`mt-3 rounded-xl bg-mint p-3 ${!instrument ? 'opacity-50' : ''}`}><Text className="text-center font-semibold text-pine">{t('assets.useQuote')}</Text></Pressable> : null}
          {quote ? <Text className="mt-3 text-xs leading-5 text-sage">{t('assets.quoteNote', { date: new Date(quote.asOf).toLocaleString(i18n.language) })}</Text> : null}
          {valid(price) && valid(quantity) ? <Text className="mt-4 text-lg font-bold text-pine">{t('assets.value')}: {usd(amount(price) * amount(quantity))}</Text> : null}
          <Pressable disabled={busy} onPress={() => { setHasYield(!hasYield); setRemind(false); }} accessibilityRole="checkbox" accessibilityState={{ checked: hasYield }} className="mt-5 rounded-xl border border-[#D3E8DC] p-4"><Text className="font-semibold text-pine">{hasYield ? '✓ ' : '○ '}{t('assets.hasYield')}</Text></Pressable>
          {hasYield ? <View>
            <View className="mt-3 flex-row flex-wrap gap-2">{['interest', 'rewards', 'both'].map((kind) => <Pressable key={kind} disabled={busy} onPress={() => setYieldKind(kind)} accessibilityRole="button" accessibilityState={{ selected: yieldKind === kind }} className={`rounded-xl border p-3 ${yieldKind === kind ? 'bg-mint border-pine' : 'border-[#D3E8DC]'}`}><Text className="text-pine">{t(`assets.yield.${kind}`)}</Text></Pressable>)}</View>
            <Pressable disabled={busy} onPress={() => setRemind(!remind)} accessibilityRole="checkbox" accessibilityState={{ checked: remind }} className="mt-3 rounded-xl border border-[#D3E8DC] p-4"><Text className="text-pine">{remind ? '✓ ' : '○ '}{t('assets.remindMonthly')}</Text></Pressable>
            {remind ? <View><Text className="mt-4 font-semibold text-pine">{t('assets.reminderDay')}</Text><TextInput value={reminderDay} onChangeText={setReminderDay} maxLength={2} keyboardType="number-pad" editable={!busy} accessibilityLabel={t('assets.reminderDay')} className={inputClass} /></View> : null}
            <Text className="mt-3 text-xs leading-5 text-sage">{t('assets.yieldHelp')}</Text>
          </View> : null}
          <Pressable disabled={busy} onPress={() => void save()} accessibilityRole="button" className="mt-5 items-center rounded-xl bg-mint py-3"><Text className="font-bold text-pine">{submitLabel ?? t('assets.save')}</Text></Pressable>
        </View> : null}
        <Pressable disabled={busy} onPress={management ? onBack : reset} accessibilityRole="button" className="mt-3 items-center p-3"><Text className="text-sage">{t('income.cancel')}</Text></Pressable>
      </View> : null}
      {saving || marketBusy ? <ActivityIndicator color="#0B3D2E" /> : null}
      {error ? <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text> : null}
      {loadFailed ? <Pressable onPress={() => void load()} accessibilityRole="button" className="p-3"><Text className="text-pine">{t('income.retry')}</Text></Pressable> : null}
      {!management ? <><Pressable disabled={busy || loadFailed} onPress={() => void finish()} accessibilityRole="button" className={`mt-4 items-center rounded-2xl bg-pine py-4 ${busy || loadFailed ? 'opacity-50' : ''}`}>
        {finishing ? <ActivityIndicator color="white" /> : <Text className="text-base font-bold text-white">{t(positions.length ? 'assets.continue' : 'assets.skip')}</Text>}
      </Pressable>
      <Pressable disabled={busy} onPress={onBack} accessibilityRole="button" className="items-center p-3"><Text className="font-semibold text-sage">{t('back')}</Text></Pressable></> : null}
    </View>
  );
}
