import { marketMcp } from '../_shared/asset-market-mcp.ts';
Deno.serve(request => marketMcp(request, {
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  apiKey: Deno.env.get('TWELVE_DATA_KEY') ?? '',
}));
