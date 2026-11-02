// Deploy the versioned function and only its provider secret, never the full .env.
import {readFileSync,existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function envFile(name) {
  const path=join(root,name);
  if(!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path,'utf8').split(/\r?\n/).flatMap(line=>{
    const match=line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(!match) return [];
    const value=match[2].replace(/^(['"])(.*)\1$/,'$2');
    return [[match[1],value]];
  }));
}
function cli(args) {
  const result=spawnSync('npx',['--no-install','supabase',...args],{cwd:root,stdio:'inherit'});
  if(result.error || result.status!==0) throw new Error('Supabase command failed. Authenticate with npx supabase login and verify project access.');
}
try {
  const cloud={...envFile('.env.cloud'),...envFile('apps/mobile/.env.cloud')};
  const url=new URL(cloud.EXPO_PUBLIC_SUPABASE_URL||cloud.SUPABASE_URL||'');
  const project=url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  if(!project) throw new Error('Configure a hosted Supabase URL in .env.cloud.');
  const key=process.env.TWELVE_DATA_KEY||envFile('.env.cloud').TWELVE_DATA_KEY||envFile('.env').TWELVE_DATA_KEY;
  if(!key || !/^[a-zA-Z0-9_-]+$/.test(key) || /your_|placeholder/i.test(key)) throw new Error('Set TWELVE_DATA_KEY in the backend .env first.');
  console.log(`Deploying asset-market to ${project}. No database reset or migrations will run.`);
  cli(['functions','list','--project-ref',project]);
  const temp=mkdtempSync(join(tmpdir(),'asset-market-secret-'));
  try {
    const file=join(temp,'.env');
    writeFileSync(file,`TWELVE_DATA_KEY=${key}\n`,{mode:0o600});
    cli(['secrets','set','--project-ref',project,'--env-file',file]);
    cli(['functions','deploy','asset-market','--project-ref',project,'--use-api']);
  } finally {rmSync(temp,{recursive:true,force:true});}
  const response=await fetch(`${url.origin}/functions/v1/asset-market`,{method:'OPTIONS',headers:{Origin:'http://localhost:8090','Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`Deployment completed, but the preflight check returned HTTP ${response.status}.`);
  console.log(`asset-market is deployed; CORS preflight returned HTTP ${response.status}. Sign in to the app to test searches and quotes.`);
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
}
