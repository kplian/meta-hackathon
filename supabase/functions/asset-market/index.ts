import { marketData, MarketError } from '../_shared/asset-market.ts';
import { syncAssetQuote } from '../_shared/asset-quotes.ts';
import { refreshAsset } from '../_shared/asset-refresh.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const limits = new Map<string, { count: number; reset: number }>();
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const user = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
      signal: AbortSignal.timeout(5000),
    });
    if (!user.ok) return json({ error: 'unauthorized' }, 401);
    const identity = await user.json();
    if (!identity.id) return json({ error: 'unauthorized' }, 401);
    if (limits.size > 10000) limits.clear();
    const limit = limits.get(identity.id);
    if (limit && limit.reset > Date.now() && limit.count >= 20) return json({ error: 'market_rate_limit' }, 429);
    limits.set(identity.id, limit && limit.reset > Date.now() ? { ...limit, count: limit.count + 1 } : { count: 1, reset: Date.now() + 60000 });
    const text = await request.text();
    if (text.length > 2000) return json({ error: 'invalid_request' }, 400);
    let input;
    try { input = JSON.parse(text); } catch { return json({ error: 'invalid_request' }, 400); }
    if (!input || typeof input !== 'object' || ['action','query','kind','symbol','exchange','positionId','currency'].some((key) => input[key] !== undefined && typeof input[key] !== 'string')) return json({ error: 'invalid_request' }, 400);
    if (input.action === 'sync_quote') {
      return json(await syncAssetQuote(input, { url: Deno.env.get('SUPABASE_URL') ?? '',
        serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', apiKey: Deno.env.get('TWELVE_DATA_KEY') ?? '' }));
    }
    if (input.action === 'refresh') {
      return json(await refreshAsset(input.positionId ?? '', {
        url: Deno.env.get('SUPABASE_URL') ?? '', anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', apiKey: Deno.env.get('TWELVE_DATA_KEY') ?? '',
        authorization, actorId: identity.id,
      }));
    }
    return json(await marketData(input, Deno.env.get('TWELVE_DATA_KEY') ?? ''));
  } catch (error) {
    if (error instanceof MarketError) return json({ error: error.code }, error.status);
    return json({ error: 'market_unavailable' }, 502);
  }
});
