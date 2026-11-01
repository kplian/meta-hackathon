import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Read keys from the running local stack, never from a hosted project.
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
}));
if (!['localhost', '127.0.0.1'].includes(new URL(status.API_URL).hostname)) {
  throw new Error('This setup only supports local Supabase.');
}
const file = 'apps/mobile/.env';
let env = readFileSync(existsSync(file) ? file : `${file}.example`, 'utf8');
const values = {
  EXPO_PUBLIC_SUPABASE_URL: status.API_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
};
for (const [key, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, `${key}=${value}`) : `${env}\n${key}=${value}\n`;
}
writeFileSync(file, env);
const readEnv = (key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
const email = readEnv('EXPO_PUBLIC_DEMO_EMAIL');
const password = readEnv('EXPO_PUBLIC_DEMO_PASSWORD');
if (!email || !password) throw new Error('Configure the demo email and password in apps/mobile/.env.');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY);
const client = createClient(status.API_URL, status.ANON_KEY);
let login = await client.auth.signInWithPassword({ email, password });
if (login.error) {
  // Reuse the seeded profile UUID to preserve its household memberships and transactions.
  const profile = await admin.schema('budget').from('tuser').select('id').eq('email_user', email).single();
  if (profile.error) throw new Error('Demo profile missing. Load supabase/seed.demo.sql in your local database first.');
  const created = await admin.auth.admin.createUser({
    id: profile.data.id, email, password, email_confirm: true,
    user_metadata: { full_name: 'Valentina Morales' },
  });
  if (created.error) throw created.error;
  login = await client.auth.signInWithPassword({ email, password });
}
if (login.error) throw login.error;
for (const table of ['thousehold', 'tbudget', 'ttransaction']) {
  const result = await client.schema('budget').from(table).select('id', { count: 'exact', head: true });
  if (result.error) throw result.error;
  console.log(`${table}: ${result.count} records accessible`);
}
await client.auth.signOut();
console.log('Local frontend configured; demo login verified.');
