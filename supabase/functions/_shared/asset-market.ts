export type Instrument = { symbol: string; name: string; exchange: string; currency: string; type: string };
type Fetcher = typeof fetch;
const cache = new Map<string, { until: number; value: unknown }>();
export class MarketError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 502) { super(code); this.code = code; this.status = status; }
}
export async function marketData(input: { action: string; query?: string; kind?: string; symbol?: string; exchange?: string; currency?: string }, apiKey: string, fetcher: Fetcher = fetch) {
  if (input.action === 'fx' && input.currency === 'USD') {
    return { fx: { currency: 'USD', quoteCurrency: 'USD', symbol: 'USD/USD', rate: 1, asOf: new Date().toISOString(), provider: 'identity' } };
  }
  if (!apiKey) throw new MarketError('market_not_configured', 503);
  const api = async (endpoint: string, params: Record<string, string>, ttl: number): Promise<any> => {
    const key = endpoint + JSON.stringify(params);
    const cached = cache.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    const url = new URL(`https://api.twelvedata.com/${endpoint}`);
    for (const [k, v] of Object.entries({ ...params, apikey: apiKey })) if (v) url.searchParams.set(k, v);
    let response: Response;
    try { response = await fetcher(url, { signal: AbortSignal.timeout(12000) }); }
    catch { throw new MarketError('market_unavailable'); }
    if (response.status === 429) throw new MarketError('market_rate_limit', 429);
    let data: any;
    try { data = await response.json(); } catch { throw new MarketError('market_unavailable'); }
    if (!response.ok || data.status === 'error') {
      if (Number(data.code) === 429) throw new MarketError('market_rate_limit', 429);
      if ([401, 403].includes(Number(data.code))) throw new MarketError('market_plan_unavailable', 503);
      throw new MarketError('market_unavailable');
    }
    if (cache.size > 300) cache.clear();
    cache.set(key, { until: Date.now() + ttl, value: data });
    return data;
  };
  if (input.action === 'fx') {
    if (!input.currency || !/^[A-Z]{3}$/.test(input.currency)) throw new MarketError('invalid_currency', 400);
    const symbol = `${input.currency}/USD`;
    let data;
    try { data = await api('exchange_rate', { symbol, dp: '10' }, 60000); }
    catch (error) {
      if (error instanceof MarketError && error.code === 'market_unavailable') throw new MarketError('fx_unavailable');
      throw error;
    }
    const rate = Number(data.rate);
    const timestamp = Number(data.timestamp);
    if (data.symbol !== symbol || !Number.isFinite(rate) || rate <= 0 || rate >= 1e18 ||
      !Number.isFinite(timestamp) || timestamp <= 0 || timestamp * 1000 > Date.now() + 300000) throw new MarketError('invalid_fx_quote');
    const date = new Date(timestamp * 1000);
    if (!Number.isFinite(date.getTime())) throw new MarketError('invalid_fx_quote');
    return { fx: { currency: input.currency, quoteCurrency: 'USD', symbol, rate, asOf: date.toISOString(), provider: 'twelve_data' } };
  }
  if (input.action === 'search') {
    const query = input.query?.trim() ?? '';
    if (query.length < 2 || query.length > 80 || !['stock', 'etf', 'crypto'].includes(input.kind ?? '')) throw new MarketError('invalid_search', 400);
    const aliases: Record<string, string> = { google: 'GOOGL', alphabet: 'GOOGL', facebook: 'META' };
    const search = input.kind === 'stock' ? aliases[query.toLowerCase()] ?? query : query;
    const data = await api('symbol_search', { symbol: search, outputsize: '60' }, 300000);
    let results: Instrument[] = (data.data ?? []).filter((row: any) => row.currency === 'USD' && (
      input.kind === 'crypto' ? row.instrument_type === 'Digital Currency' || String(row.symbol).endsWith('/USD') :
      input.kind === 'etf' ? row.instrument_type === 'ETF' : ['Common Stock', 'American Depositary Receipt', 'Preferred Stock'].includes(row.instrument_type)
    )).map((row: any) => ({ symbol: row.symbol, name: row.instrument_name, exchange: row.exchange ?? '', currency: 'USD', type: row.instrument_type }));
    // Crypto discovery can match a full name (Bitcoin) or base ticker (BTC).
    if (input.kind === 'crypto' && !results.length) {
      const crypto = await api('cryptocurrencies', { currency_quote: 'USD' }, 3600000);
      const q = query.toLowerCase();
      results = (crypto.data ?? []).filter((row: any) => row.currency_quote === 'US Dollar' || String(row.symbol).endsWith('/USD'))
        .filter((row: any) => `${row.symbol} ${row.currency_base}`.toLowerCase().includes(q))
        .map((row: any) => ({ symbol: row.symbol, name: row.currency_base, exchange: '', currency: 'USD', type: 'Digital Currency' }));
    }
    const unique = new Map<string, Instrument>();
    for (const row of results) unique.set(`${row.symbol}:${row.exchange}`, row);
    const q = query.toLowerCase();
    const score = (row: Instrument) => (row.name.toLowerCase() === q || row.symbol.split('/')[0].toLowerCase() === q ? 100 : 0) + (['NASDAQ', 'NYSE'].includes(row.exchange) ? 1 : 0);
    return { instruments: [...unique.values()].sort((a, b) => score(b) - score(a)).slice(0, 15) };
  }
  if (input.action === 'quote') {
    if (!input.symbol || input.symbol.length > 50 || (input.exchange?.length ?? 0) > 100) throw new MarketError('invalid_symbol', 400);
    const data = await api('quote', { symbol: input.symbol, exchange: input.exchange ?? '' }, 30000);
    // Twelve Data omits currency on crypto quotes; the returned pair identifies
    // the quote currency. Never infer it from the client's requested symbol.
    const pairCurrency = typeof data.symbol === 'string' && /^[^/\s]+\/USD$/.test(data.symbol) ? 'USD' : undefined;
    const currency = data.currency || data.currency_quote || pairCurrency;
    if (currency !== 'USD') throw new MarketError('usd_only', 400);
    if (data.symbol !== input.symbol) throw new MarketError('invalid_quote');
    const price = Number(data.close);
    if (!Number.isFinite(price) || price <= 0) throw new MarketError('invalid_quote');
    // Keep the actual provider timestamp; never label a delayed quote as a live price.
    const timestamp = Number(data.timestamp ?? data.last_quote_at);
    const asOf = timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null;
    if (!asOf) throw new MarketError('invalid_quote');
    return { quote: { symbol: data.symbol, exchange: data.exchange ?? input.exchange ?? '', currency: 'USD', price, asOf, provider: 'twelve_data' } };
  }
  throw new MarketError('invalid_action', 400);
}
