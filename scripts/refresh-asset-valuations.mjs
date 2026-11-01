import {readFileSync, existsSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';

const local=Object.fromEntries((existsSync('apps/mobile/.env')?readFileSync('apps/mobile/.env','utf8'):'').split('\n').filter(l=>/^\w+=/.test(l)).map(l=>{
 const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];
}));
const url=process.env.EXPO_PUBLIC_SUPABASE_URL??local.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY??local.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const token=process.env.ASSET_REFRESH_ACCESS_TOKEN;
const isLocal=['localhost','127.0.0.1'].includes(new URL(url).hostname);
const client=createClient(url,key,{auth:{persistSession:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:{}});
let signedIn=false;
try {
 if(!token){
  const email=process.env.ASSET_REFRESH_EMAIL??(isLocal?local.EXPO_PUBLIC_DEMO_EMAIL:undefined);
  const password=process.env.ASSET_REFRESH_PASSWORD??(isLocal?local.EXPO_PUBLIC_DEMO_PASSWORD:undefined);
  if(!email||!password)throw Error('Configure ASSET_REFRESH_ACCESS_TOKEN or ASSET_REFRESH_EMAIL / ASSET_REFRESH_PASSWORD.');
  const login=await client.auth.signInWithPassword({email,password});
  if(login.error)throw Error('Authentication failed');
  signedIn=true;
 }
 const args=process.argv.slice(2);
 const arg=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]};
 const household=arg('--household');const position=arg('--position');
 if(!household&&!position)throw Error('Specify --household UUID or --position UUID.');
 let query=client.schema('budget').from('tasset_position').select('id').eq('status','active').is('deleted_at',null).in('asset_type_code',['stock','etf','crypto']).order('id');
 if(household)query=query.eq('household_id',household);
 if(position)query=query.eq('id',position);
 const assets=await query;
 if(assets.error)throw Error('Could not read authorized assets');
 let failed=0;
 for(const [i,asset] of assets.data.entries()){
  // At most 18 requests/minute; provider limits may be lower for a given plan.
  if(i)await delay(3400);
  const result=await client.functions.invoke('asset-market',{body:{action:'refresh',positionId:asset.id}});
  if(result.error){failed++;console.error(`Position ${asset.id}: refresh failed; prior valuation preserved`)}
  else console.log(`Position ${asset.id}: valuation ${result.data.valuationId} recorded`);
 }
 console.log(`${assets.data.length-failed} updated; ${failed} failed. No journal revaluations were posted.`);
 if(failed)process.exitCode=1;
} catch(error){console.error(error.message);process.exitCode=1}
finally{if(signedIn)await client.auth.signOut({scope:'local'})}
