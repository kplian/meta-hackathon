import {test} from 'node:test';
import assert from 'node:assert/strict';
import {marketData, MarketError} from '../supabase/functions/_shared/asset-market.ts';
const response = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json'}});

test('Google search resolves to verified USD stock instruments and excludes foreign listings', async()=>{
 let calls=0;
 const result=await marketData({action:'search',query:'Google',kind:'stock'},'test-key',async(url)=>{
  calls++;assert.equal(url.searchParams.get('symbol'),'GOOGL');
  return response({data:[
   {symbol:'GOOGL',instrument_name:'Alphabet',currency:'USD',exchange:'NASDAQ',instrument_type:'Common Stock'},
   {symbol:'GOOGL',instrument_name:'Alphabet',currency:'EUR',exchange:'XETRA',instrument_type:'Common Stock'},
   {symbol:'ABC',instrument_name:'Fund',currency:'USD',exchange:'NYSE',instrument_type:'ETF'},
  ]});
 });
 assert.equal(calls,1);assert.equal(result.instruments.length,1);assert.equal(result.instruments[0].exchange,'NASDAQ');
});
test('Bitcoin discovery prioritizes exact base name over similarly named coins',async()=>{
 const result=await marketData({action:'search',query:'Bitcoin',kind:'crypto'},'test-key',async(url)=>{
  if(url.pathname==='/symbol_search')return response({data:[]});
  return response({data:[{symbol:'BCH/USD',currency_base:'Bitcoin Cash'},{symbol:'BTC/USD',currency_base:'Bitcoin'}]});
 });
 assert.equal(result.instruments[0].symbol,'BTC/USD');
});
test('Quote must be USD even when client requested a stock symbol',async()=>{
 await assert.rejects(marketData({action:'quote',symbol:'EUR-TEST'},'key',async()=>response({currency:'EUR',close:'5',timestamp:1234567890})),e=>e instanceof MarketError&&e.code==='usd_only');
});
test('Quote preserves provider timestamp and numeric price',async()=>{
 const result=await marketData({action:'quote',symbol:'USD-TEST'},'key',async()=>response({symbol:'USD-TEST',currency:'USD',close:'123.45',timestamp:1700000000}));
 assert.equal(result.quote.price,123.45);assert.equal(result.quote.asOf,'2023-11-14T22:13:20.000Z');
});
test('Crypto quote accepts USD from the returned pair when currency is omitted',async()=>{
 const result=await marketData({action:'quote',symbol:'ADA/USD',exchange:''},'key',async()=>response({symbol:'ADA/USD',close:'0.1919',timestamp:1700000000}));
 assert.equal(result.quote.currency,'USD');assert.equal(result.quote.price,0.1919);
});
test('Crypto quote rejects non-USD or mismatched provider symbols and explicit foreign currency',async()=>{
 for(const [symbol,data,code] of [
  ['ADA/EUR',{symbol:'ADA/EUR'},'usd_only'],
  ['ADA/USD',{symbol:'ADA/USD',currency:'EUR'},'usd_only'],
  ['BTC/USD',{symbol:'ADA/USD'},'invalid_quote'],
  ['MISSING-CURRENCY',{symbol:'MISSING-CURRENCY'},'usd_only'],
 ])await assert.rejects(marketData({action:'quote',symbol,exchange:'validation-'+code},'key',async()=>response({...data,close:'1',timestamp:1700000000})),e=>e.code===code);
});
test('Unavailable or rate-limited prices never invent a price',async()=>{
 await assert.rejects(marketData({action:'quote',symbol:'NO-TIMESTAMP'},'key',async()=>response({currency:'USD',close:'100'})),e=>e.code==='invalid_quote');
 await assert.rejects(marketData({action:'quote',symbol:'LIMIT'},'key',async()=>response({status:'error',code:429},429)),e=>e.code==='market_rate_limit');
 await assert.rejects(marketData({action:'search',query:'abc',kind:'stock'},''),e=>e.code==='market_not_configured');
});

test('FX quotes use original currency to USD, preserving provider timestamp',async()=>{
 const result=await marketData({action:'fx',currency:'BOB'},'fx-test',async(url)=>{
  assert.equal(url.pathname,'/exchange_rate');assert.equal(url.searchParams.get('symbol'),'BOB/USD');
  return response({symbol:'BOB/USD',rate:'0.125',timestamp:1700000000});
 });
 assert.equal(result.fx.rate,0.125);assert.equal(result.fx.asOf,'2023-11-14T22:13:20.000Z');
 assert.equal(result.fx.provider,'twelve_data');assert.equal(result.fx.currency,'BOB');assert.equal(5000*result.fx.rate,625);
});
test('USD identity needs neither provider nor API key',async()=>{
 const result=await marketData({action:'fx',currency:'USD'},'',async()=>{throw Error('Must not fetch')});
 assert.equal(result.fx.rate,1);assert.equal(result.fx.provider,'identity');
});
test('FX rejects reversed pairs, missing dates, zero and non-finite rates',async()=>{
 for(const [currency,data] of [
  ['BRL',{symbol:'USD/BRL',rate:5,timestamp:1700000000}],
  ['EUR',{symbol:'EUR/USD',rate:1.1}],
  ['JPY',{symbol:'JPY/USD',rate:0,timestamp:1700000000}],
  ['CNY',{symbol:'CNY/USD',rate:'Infinity',timestamp:1700000000}],
  ['COP',{symbol:'COP/USD',rate:1,timestamp:Math.floor(Date.now()/1000)+3600}],
 ])await assert.rejects(marketData({action:'fx',currency},'invalid-fx-test',async()=>response(data)),e=>e.code==='invalid_fx_quote');
});
test('FX unavailable is explicit and does not invent a fallback rate',async()=>{
 await assert.rejects(marketData({action:'fx',currency:'ZZZ'},'fx-error',async()=>response({status:'error',code:400},400)),e=>e.code==='fx_unavailable');
 await assert.rejects(marketData({action:'fx',currency:'bad/USD'},'fx-error'),e=>e.code==='invalid_currency');
});
