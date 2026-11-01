import { marketData, MarketError } from './asset-market.ts';

type RefreshConfig = {
  url: string; anonKey: string; serviceKey: string; apiKey: string;
  authorization: string; actorId: string;
};

// Resolve identity and quote server-side: clients supply only the position ID.
export async function refreshAsset(positionId: string, config: RefreshConfig, fetcher: typeof fetch = fetch) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(positionId)) throw new MarketError('invalid_request', 400);
  if (!config.serviceKey) throw new MarketError('market_not_configured', 503);
  const rest = `${config.url}/rest/v1`;
  const headers = { Authorization: config.authorization, apikey: config.anonKey, 'Accept-Profile': 'budget' };
  const positionResponse = await fetcher(`${rest}/tasset_position?id=eq.${positionId}&status=eq.active&deleted_at=is.null&select=id,household_id,asset_type_code,symbol,exchange`, {
    headers, signal: AbortSignal.timeout(5000),
  });
  if (!positionResponse.ok) throw new MarketError('asset_unavailable', 403);
  const [position] = await positionResponse.json();
  if (!position) throw new MarketError('asset_unavailable', 404);
  const membership = await fetcher(`${rest}/thousehold_member?household_id=eq.${position.household_id}&user_id=eq.${config.actorId}&role=eq.admin&status=eq.active&deleted_at=is.null&select=id`, {
    headers, signal: AbortSignal.timeout(5000),
  });
  if (!membership.ok || !(await membership.json()).length) throw new MarketError('asset_unavailable', 403);
  if (!['stock', 'etf', 'crypto'].includes(position.asset_type_code) || !position.symbol) throw new MarketError('invalid_symbol', 400);
  const result = await marketData({ action: 'quote', symbol: position.symbol, exchange: position.exchange ?? '' }, config.apiKey, fetcher);
  if (!result.quote) throw new MarketError('invalid_quote');
  const quote = result.quote;
  const saved = await fetcher(`${rest}/rpc/f_record_market_asset_valuation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.serviceKey}`, apikey: config.serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_position_id: position.id, p_unit_price_usd: quote.price,
      p_valued_at: quote.asOf, p_request_id: crypto.randomUUID(), p_actor_id: config.actorId }),
    signal: AbortSignal.timeout(5000),
  });
  if (!saved.ok) throw new MarketError('valuation_save_failed');
  return { valuationId: await saved.json(), quote };
}
