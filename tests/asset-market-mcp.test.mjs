import test from 'node:test';
import assert from 'node:assert/strict';
import {marketMcp,marketOperation} from '../supabase/functions/_shared/asset-market-mcp.ts';

const env={url:'https://test.supabase.co',serviceKey:'private-test-service-key',apiKey:'private-test-provider-key'};
let actor=0;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
const request=(body,token=env.serviceKey)=>new Request('https://test/market',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(body)});
const input={p_channel_type:'whatsapp',p_channel_code:'1234',operation:'quote',payload:{symbol:'TESTBTC/USD'}};
const quote={symbol:'TESTBTC/USD',close:'80000',timestamp:1793649600,exchange:'Binance'};
const makeFetch=(overrides={})=>async(url,options)=>{
 const u=new URL(url);
 if(u.hostname==='test.supabase.co') {
  assert.equal(u.pathname,'/rest/v1/rpc/f_messaging_context_lab');
  assert.deepEqual(JSON.parse(options.body),{p_channel_type:'whatsapp',p_channel_code:'1234'});
  return overrides.identity??json({success:true,registered:true,user:{id:`fixture-${++actor}`}});
 }
 assert.equal(u.hostname,'api.twelvedata.com');
 if(u.pathname==='/quote') return overrides.quote??json(quote);
 if(u.pathname==='/exchange_rate') return overrides.fx??json({symbol:'BOB/USD',rate:0.125,timestamp:1793649600});
 throw new Error('Unexpected provider route');
};
test('backend rejects anonymous and end-user credentials before looking up identity',async()=>{
 for(const token of ['', 'user-jwt']) {
  let calls=0;
  const r=await marketMcp(request(input,token),env,{fetcher:async()=>{calls++;throw Error();}});
  assert.equal(r.status,401);assert.equal(calls,0);
 }
});
test('unknown messaging identity cannot reach provider',async()=>{
 const r=await marketMcp(request(input),env,{fetcher:makeFetch({identity:json({success:true,registered:false})})});
 assert.equal(r.status,403);assert.equal((await r.json()).error,'unregistered');
});
test('identity outage is not mistaken for unregistered user',async()=>{
 const r=await marketMcp(request(input),env,{fetcher:makeFetch({identity:json({},503)})});
 assert.equal(r.status,503);assert.equal((await r.json()).error,'identity_unavailable');
});
test('opening, syncing and refresh/write operations are not exposed by market',async()=>{
 for(const operation of ['register_initial','sync_quote','refresh','move']) {
  const r=await marketMcp(request({...input,operation}),env,{fetcher:async()=>{throw Error('must not call');}});
  assert.equal(r.status,400);
 }
});
test('registered sender can read USD quote even when crypto omits currency',async()=>{
 const r=await marketMcp(request(input),env,{fetcher:makeFetch()});
 const data=await r.json();assert.equal(data.success,true);assert.equal(data.data.quote.currency,'USD');assert.equal(data.data.quote.price,80000);
 assert.equal(data.data.quote.asOf,'2026-11-02T20:00:00.000Z');
 assert.ok(!JSON.stringify(data).includes(env.apiKey));assert.ok(!JSON.stringify(data).includes(env.serviceKey));
});
test('100 USD at explicit 12 BOB/USD calculates 1200 BOB and BTC, without fetching FX',async()=>{
 const calls=[];
 const f=async(url,options)=>{calls.push(new URL(url).pathname);return makeFetch()(url,options);};
 const {estimate:e}=await marketOperation('estimate_purchase',{symbol:'TESTBTC/USD',usd_amount:100,household_currency:'BOB',household_per_usd:12},env.apiKey,f);
 assert.equal(e.household_amount,1200);assert.equal(e.quantity,0.00125);assert.equal(e.usd_per_household_unit,1/12);
 assert.equal(e.rate_source,'user');assert.equal(e.executed,false);assert.equal(e.indicative_only,true);
 assert.ok(!calls.includes('/exchange_rate'));
});
test('provider USD-per-BOB rate is inverted once for household cost',async()=>{
 const {estimate:e}=await marketOperation('estimate_purchase',{symbol:'TESTBTC/USD',usd_amount:100,household_currency:'BOB'},env.apiKey,makeFetch());
 assert.equal(e.household_per_usd,8);assert.equal(e.household_amount,800);assert.equal(e.usd_per_household_unit,0.125);assert.equal(e.rate_source,'twelve_data');
});
test('USD household uses identity FX and no conversion',async()=>{
 const {estimate:e}=await marketOperation('estimate_purchase',{symbol:'TESTBTC/USD',usd_amount:100,household_currency:'USD'},env.apiKey,makeFetch());
 assert.equal(e.household_amount,100);assert.equal(e.household_per_usd,1);
});
test('estimates reject nonpositive amounts/rates and contradictory USD rate before provider',async()=>{
 for(const change of [{usd_amount:0},{household_per_usd:0},{household_per_usd:'12'},{household_currency:'USD',household_per_usd:12}]){
  await assert.rejects(()=>marketOperation('estimate_purchase',{symbol:'TESTBTC/USD',usd_amount:100,household_currency:'BOB',...change},env.apiKey,async()=>{throw Error('must not call');}),e=>e.code==='invalid_estimate');
 }
});
test('action payload cannot escalate a read to a write',async()=>{
 const data=await marketOperation('quote',{symbol:'TESTBTC/USD',action:'sync_quote',positionId:'attacker'},env.apiKey,makeFetch());
 assert.equal(data.quote.price,80000);
});
test('missing provider configuration reports failure instead of fake price',async()=>{
 const r=await marketMcp(request(input),{...env,apiKey:''},{fetcher:makeFetch()});
 const data=await r.json();assert.equal(r.status,503);assert.equal(data.success,false);assert.equal(data.error,'market_not_configured');
});
