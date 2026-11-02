import { marketData, MarketError } from './asset-market.ts';

type Input = { kind?: string; symbol?: string; exchange?: string; currency?: string };
type Config = { url: string; serviceKey: string; apiKey: string };
// Only verified provider data reaches the privileged RPC, never client-supplied prices.
export async function syncAssetQuote(input: Input, config: Config, fetcher: typeof fetch = fetch) {
  if (!config.serviceKey) throw new MarketError('market_not_configured', 503);
  if (!['stock', 'etf', 'crypto', 'fiat'].includes(input.kind ?? '')) throw new MarketError('invalid_request', 400);
  let price: number; let asOf: string; let symbol: string; let exchange = ''; let source: string;
  if (input.kind === 'fiat') {
    const result = await marketData({ action: 'fx', currency: input.currency }, config.apiKey, fetcher);
    if (!result.fx) throw new MarketError('invalid_fx_quote');
    price = result.fx.rate; asOf = result.fx.asOf; symbol = result.fx.symbol; source = result.fx.provider;
  } else {
    const result = await marketData({ action: 'quote', symbol: input.symbol, exchange: input.exchange }, config.apiKey, fetcher);
    if (!result.quote) throw new MarketError('invalid_quote');
    const quote = result.quote;
    if (input.exchange && quote.exchange && input.exchange.trim().toUpperCase() !== quote.exchange.trim().toUpperCase()) throw new MarketError('invalid_quote');
    price = quote.price; asOf = quote.asOf; symbol = quote.symbol; source = quote.provider;
    // The registry uses the selected listing identity, not a household or custody platform.
    exchange = input.kind === 'crypto' ? '' : input.exchange ?? quote.exchange;
  }
  const saved = await fetcher(`${config.url}/rest/v1/rpc/f_upsert_asset_quote`, {
    method: 'POST', headers: { Authorization: `Bearer ${config.serviceKey}`, apikey: config.serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_kind: input.kind, p_symbol: symbol, p_exchange: exchange, p_price: price, p_quoted_at: asOf, p_source: source }),
    signal: AbortSignal.timeout(5000),
  });
  if (!saved.ok) throw new MarketError('quote_save_failed');
  return { quoteId: await saved.json(), price, asOf, source };
}
