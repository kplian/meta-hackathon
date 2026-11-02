import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncAssetQuote} from '../supabase/functions/_shared/asset-quotes.ts';
const config={url:'http://local.test',serviceKey:'service-test',apiKey:'shared-quote-test'};
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('registration sync saves provider price, not client acquisition cost, with trusted credentials',async()=>{
 let saved;
 const result=await syncAssetQuote({kind:'stock',symbol:'QUOTE-SYNC',exchange:'NASDAQ',price:1},config,async(url,options)=>{
  const path=new URL(url).pathname;
  if(path==='/quote')return response({symbol:'QUOTE-SYNC',exchange:'NASDAQ',currency:'USD',close:'102',timestamp:1700000000});
  assert.equal(path,'/rest/v1/rpc/f_upsert_asset_quote');assert.equal(options.headers.Authorization,'Bearer service-test');
  saved=JSON.parse(options.body);return response('shared-id');
 });
 assert.equal(saved.p_price,102);assert.equal(saved.p_quoted_at,'2023-11-14T22:13:20.000Z');assert.equal(saved.p_kind,'stock');assert.equal(result.quoteId,'shared-id');
});
test('USD uses identity without calling a market provider',async()=>{
 let calls=0;
 await syncAssetQuote({kind:'fiat',currency:'USD'},{...config,apiKey:''},async(url,options)=>{
  calls++;assert.equal(new URL(url).pathname,'/rest/v1/rpc/f_upsert_asset_quote');
  const body=JSON.parse(options.body);assert.equal(body.p_price,1);assert.equal(body.p_source,'identity');return response('usd');
 });assert.equal(calls,1);
});
test('manual property values are not published as shared quotes',async()=>{
 let calls=0;await assert.rejects(syncAssetQuote({kind:'house',symbol:'HOUSE'},config,async()=>{calls++;return response({})}),e=>e.code==='invalid_request');assert.equal(calls,0);
});
test('unavailable provider does not publish an invented quote',async()=>{
 let writes=0;await assert.rejects(syncAssetQuote({kind:'crypto',symbol:'FAIL-USD/USD'},config,async(url)=>{
  if(new URL(url).pathname.startsWith('/rest'))writes++;
  return new Response('{}',{status:503});
 }),e=>e.code==='market_unavailable');assert.equal(writes,0);
});
