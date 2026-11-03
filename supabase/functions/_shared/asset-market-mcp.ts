import { marketData, MarketError } from './asset-market.ts';

type Env = { url: string; serviceKey: string; apiKey: string };
type Dependencies = { fetcher?: typeof fetch; now?: () => number };
const limits = new Map<string, { count: number; reset: number }>();
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

// A trusted messaging backend may read market data, never create financial entries.
// End-user JWTs and anonymous keys are deliberately not accepted here.
function isServiceRoleToken(token: string, expectedKey?: string): boolean {
  if (!token) return false;
  if (expectedKey && token === expectedKey) return true;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload && payload.role === 'service_role') return true;
    }
  } catch {
    // Ignore parse error
  }
  return false;
}

export async function marketMcp(request: Request, env: Env, deps: Dependencies = {}) {
  if (request.method !== 'POST') return response({ success: false, error: 'method_not_allowed' }, 405);
  const authHeader = request.headers.get('authorization') || '';
  const apiKeyHeader = request.headers.get('apikey') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || apiKeyHeader.trim();

  if (!isServiceRoleToken(token, env.serviceKey)) {
    return response({ success: false, error: 'unauthorized' }, 401);
  }
  const effectiveServiceKey = token || env.serviceKey;
  const fetcher = deps.fetcher ?? fetch;
  try {
    const text = await request.text();
    if (text.length > 2000) throw new MarketError('invalid_request', 400);
    let input;
    try { input = JSON.parse(text); } catch { throw new MarketError('invalid_request', 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        !['whatsapp', 'telegram'].includes(input.p_channel_type) ||
        typeof input.p_channel_code !== 'string' || !/^\+?\d{1,30}$/.test(input.p_channel_code) ||
        !['search', 'quote', 'fx', 'estimate_purchase'].includes(input.operation) ||
        !input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
      throw new MarketError('invalid_request', 400);
    }
    const auth = await fetcher(`${env.url}/rest/v1/rpc/f_messaging_context_lab`, {
      method: 'POST', headers: { Authorization: `Bearer ${effectiveServiceKey}`, apikey: effectiveServiceKey,
        'Content-Type': 'application/json', 'Content-Profile': 'budget', 'Accept-Profile': 'budget' },
      body: JSON.stringify({ p_channel_type: input.p_channel_type, p_channel_code: input.p_channel_code }),
      signal: AbortSignal.timeout(10000),
    });
    if (!auth.ok) throw new MarketError('identity_unavailable', 503);
    const identity = await auth.json();
    if (identity.success !== true) throw new MarketError('identity_unavailable', 503);
    if (identity.registered !== true || typeof identity.user?.id !== 'string') throw new MarketError('unregistered', 403);
    const now = (deps.now ?? Date.now)();
    if (limits.size > 10000) limits.clear();
    const limit = limits.get(identity.user.id);
    if (limit && limit.reset > now && limit.count >= 20) throw new MarketError('market_rate_limit', 429);
    limits.set(identity.user.id, limit && limit.reset > now ? { ...limit, count: limit.count + 1 } : { count: 1, reset: now + 60000 });
    const data = await marketOperation(input.operation, input.payload, env.apiKey, fetcher);
    return response({ success: true, data });
  } catch (error) {
    if (error instanceof MarketError) return response({ success: false, error: error.code }, error.status);
    return response({ success: false, error: 'market_unavailable' }, 502);
  }
}

export async function marketOperation(operation: string, payload: Record<string, unknown>, apiKey: string, fetcher: typeof fetch = fetch) {
  // Whitelist fields: neither an action override nor a URL/identity in payload is trusted.
  if (['search', 'quote', 'fx'].includes(operation)) {
    if (['query', 'kind', 'symbol', 'exchange', 'currency'].some(key => payload[key] !== undefined && typeof payload[key] !== 'string')) {
      throw new MarketError('invalid_request', 400);
    }
    return marketData({ action: operation, query: payload.query as string, kind: payload.kind as string,
      symbol: payload.symbol as string, exchange: payload.exchange as string, currency: payload.currency as string }, apiKey, fetcher);
  }
  if (operation !== 'estimate_purchase') throw new MarketError('invalid_action', 400);
  const amount = payload.usd_amount;
  const currency = payload.household_currency;
  const suppliedRate = payload.household_per_usd;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount >= 1e15 ||
      typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency) ||
      typeof payload.symbol !== 'string' || (payload.exchange !== undefined && typeof payload.exchange !== 'string') ||
      (suppliedRate !== undefined && (typeof suppliedRate !== 'number' || !Number.isFinite(suppliedRate) || suppliedRate <= 0 || suppliedRate >= 1e15)) ||
      (currency === 'USD' && suppliedRate !== undefined && suppliedRate !== 1)) throw new MarketError('invalid_estimate', 400);
  const quote = (await marketData({ action: 'quote', symbol: payload.symbol, exchange: payload.exchange as string }, apiKey, fetcher)).quote!;
  let rate = suppliedRate as number | undefined;
  let rateAsOf: string | null = null;
  let rateSource = 'user';
  if (currency === 'USD') { rate = 1; rateSource = 'identity'; }
  else if (rate === undefined) {
    const fx = (await marketData({ action: 'fx', currency }, apiKey, fetcher)).fx!;
    rate = 1 / fx.rate;
    rateAsOf = fx.asOf;
    rateSource = fx.provider;
  }
  const quantity = amount / quote.price;
  const householdAmount = amount * rate!;
  if (![quantity, householdAmount, rate].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) throw new MarketError('invalid_estimate', 400);
  return { estimate: { symbol: quote.symbol, usd_amount: amount, quantity, household_currency: currency,
    household_amount: householdAmount, household_per_usd: rate, usd_per_household_unit: 1 / rate!,
    rate_source: rateSource, rate_as_of: rateAsOf, quote,
    indicative_only: true, executed: false } };
}
