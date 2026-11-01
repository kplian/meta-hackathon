import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refreshAsset} from '../supabase/functions/_shared/asset-refresh.ts';
const position='11111111-1111-4111-8111-111111111111';
const config={url:'http://local.test',anonKey:'anon-test',serviceKey:'service-test',apiKey:'refresh-test-key',authorization:'Bearer user-test',actorId:'actor-test'};
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('refresh uses stored instrument and trusted quote, saves timestamp without posting a journal',async()=>{
 const paths=[];
 const result=await refreshAsset(position,config,async(url,options)=>{
  const u=new URL(url);paths.push(u.pathname);
  if(u.pathname.endsWith('/tasset_position'))return response([{id:position,household_id:'home',asset_type_code:'stock',symbol:'REFRESH-TEST',exchange:'NASDAQ'}]);
  if(u.pathname.endsWith('/thousehold_member'))return response([{id:'member'}]);
  if(u.pathname==='/quote'){assert.equal(u.searchParams.get('symbol'),'REFRESH-TEST');return response({symbol:'REFRESH-TEST',currency:'USD',close:'123.45',timestamp:1700000000});}
  assert.equal(u.pathname,'/rest/v1/rpc/f_record_market_asset_valuation');
  assert.equal(options.headers.Authorization,'Bearer service-test');
  const body=JSON.parse(options.body);assert.equal(body.p_actor_id,'actor-test');assert.equal(body.p_unit_price_usd,123.45);assert.equal(body.p_valued_at,'2023-11-14T22:13:20.000Z');
  return response('valuation-id');
 });
 assert.equal(result.valuationId,'valuation-id');assert.equal(paths.length,4);
});
test('unauthorized refresh never calls provider or privileged RPC',async()=>{
 let calls=0;
 await assert.rejects(refreshAsset(position,config,async()=>{calls++;return response([])}),e=>e.code==='asset_unavailable');
 assert.equal(calls,1);
});
test('non-admin refresh is rejected before requesting quote',async()=>{
 let calls=0;
 await assert.rejects(refreshAsset(position,config,async()=>{calls++;return response(calls===1?[{id:position,household_id:'home',asset_type_code:'stock',symbol:'X'}]:[])}),e=>e.code==='asset_unavailable');
 assert.equal(calls,2);
});
test('provider response for another symbol is rejected',async()=>{
 const {marketData}=await import('../supabase/functions/_shared/asset-market.ts');
 await assert.rejects(marketData({action:'quote',symbol:'REQUESTED'},'mismatch-test',async()=>response({symbol:'OTHER',currency:'USD',close:'10',timestamp:1700000000})),e=>e.code==='invalid_quote');
});
