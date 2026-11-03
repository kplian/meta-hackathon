import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuthCallback, callbackMatchesApp, cleanAuthCallbackUrl, validateEmail, passwordValidation, authErrorKey, applyAuthCallback } from '../apps/mobile/src/features/auth-session/protocol.ts';
const invite = 'a'.repeat(64);
const emailCallback = `https://family.example/?invite=${invite}#access_token=access&refresh_token=refresh&type=signup&expires_in=3600&provider_token=private`;
function authFixture(error = null, session = { user: { id: 'test-user' } }) {
  const calls = [];
  const api = Object.fromEntries(['setSession','exchangeCodeForSession','verifyOtp'].map(name => [name, async payload => { calls.push({name,payload}); return { data:{session}, error }; }]));
  return {api,calls};
}
test('confirmation establishes a session through Supabase, preserving the invitation', async () => {
  const {api,calls} = authFixture(); const result = await applyAuthCallback(api,emailCallback);
  assert.deepEqual(result,{handled:true,recovery:false}); assert.deepEqual(calls,[{name:'setSession',payload:{access_token:'access',refresh_token:'refresh'}}]);
  const clean = new URL(cleanAuthCallbackUrl(emailCallback)); assert.equal(clean.searchParams.get('invite'),invite); assert.equal(clean.hash,'');
  for (const value of ['access_token','refresh_token','provider_token']) assert.equal(clean.toString().includes(value),false);
});
test('native confirmation and same-origin web callbacks are accepted only at the app root', () => {
  assert.equal(callbackMatchesApp(emailCallback,'https://family.example/'),true);
  assert.equal(callbackMatchesApp('aifamilybudget://#access_token=a&refresh_token=b','aifamilybudget://'),true);
  for (const url of ['https://attacker.example/#access_token=a&refresh_token=b','http://family.example/','https://family.example.attacker.com/','https://family.example/reporte']) assert.equal(callbackMatchesApp(url,'https://family.example/'),false);
});
test('expired, incomplete and rejected callbacks never create an authenticated session', async () => {
  const fixture=authFixture();
  for (const url of ['https://family.example/#error=access_denied&error_code=otp_expired','https://family.example/#access_token=only-access']) await assert.rejects(applyAuthCallback(fixture.api,url));
  assert.equal(fixture.calls.length,0);
  const rejected=authFixture(new Error('Server rejected token')); await assert.rejects(applyAuthCallback(rejected.api,emailCallback),/Server rejected/);
  const missing=authFixture(null,null); await assert.rejects(applyAuthCallback(missing.api,emailCallback),/did not create a session/);
});
test('query-code and token-hash email flows use their SDK exchanges, not invented sessions',async()=>{
  const {api,calls}=authFixture();
  await applyAuthCallback(api,'https://family.example/?code=one-use-code');
  await applyAuthCallback(api,'aifamilybudget://?token_hash=hashed&type=email');
  assert.deepEqual(calls,[{name:'exchangeCodeForSession',payload:'one-use-code'},{name:'verifyOtp',payload:{token_hash:'hashed',type:'email'}}]);
  const clean = new URL(cleanAuthCallbackUrl(`https://family.example/?code=secret&invite=${invite}&keep=yes`)); assert.equal(clean.searchParams.get('code'),null);assert.equal(clean.searchParams.get('invite'),invite);assert.equal(clean.searchParams.get('keep'),'yes');
});
test('password-recovery links route to new-password flow while ordinary URLs stay signed out',async()=>{
  const {api,calls}=authFixture();
  assert.deepEqual(await applyAuthCallback(api,'https://family.example/#access_token=a&refresh_token=b&type=recovery'),{handled:true,recovery:true});
  assert.deepEqual(await applyAuthCallback(api,'https://family.example/?token_hash=hash&type=recovery'),{handled:true,recovery:true});
  const before=calls.length;assert.deepEqual(await applyAuthCallback(api,`https://family.example/?invite=${invite}`),{handled:false,recovery:false});assert.equal(calls.length,before);
});
test('new-password validation does not impose signup rules on existing password sign-ins',()=>{
  assert.equal(validateEmail('  Person@example.com '),true);assert.equal(validateEmail('person@'),false);
  assert.equal(passwordValidation('1234567','1234567'),'shortPassword');assert.equal(passwordValidation('12345678','different'),'passwordMismatch');assert.equal(passwordValidation('valid-password','valid-password'),null);
  assert.equal(authErrorKey({code:'email_not_confirmed'}),'emailUnconfirmed');assert.equal(authErrorKey({code:'invalid_credentials'}),'invalidCredentials');assert.equal(authErrorKey({code:'over_email_send_rate_limit'}),'rateLimited');assert.equal(authErrorKey({code:'otp_expired'}),'expiredLink');
});
