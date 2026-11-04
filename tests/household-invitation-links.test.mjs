import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationToken, invitationUrl } from '../apps/mobile/src/features/household-access/links.ts';
const token = 'a'.repeat(64);
test('web and native entry URLs capture the same invitation without accepting invalid tokens', () => {
  for (const base of ['https://family.example/app?old=1#old','http://localhost:8090']) {
    const link = invitationUrl(base, token); assert.equal(invitationToken(link), token);
    const url = new URL(link); assert.equal(url.pathname,'/'); assert.equal(url.hash,''); assert.equal(url.searchParams.get('old'),null);
  }
  assert.equal(invitationToken('aifamilybudget://join?invite='+token),token);
  for (const url of [null,'invalid','https://example.com/?invite=wrong','https://example.com/?invite='+token+'x']) assert.equal(invitationToken(url),null);
  assert.throws(()=>invitationUrl('javascript:alert(1)',token));
});
