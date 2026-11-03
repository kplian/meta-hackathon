import assert from 'node:assert/strict';
import test from 'node:test';
import { linkExpired, whatsappLink } from '../apps/mobile/src/features/whatsapp/verification.ts';
import { authorizeContext, genericReply, assistantInput } from '../n8n/lib/messaging.mjs';
const link = { message: 'LINK ' + 'a'.repeat(64), bot_phone: '59144660408', expires_at: '2030-01-01T00:00:00Z' };
const envelope = { message: { text: link.message, kind: 'text', attachments: [] }, transport: { channel: 'whatsapp' } };
test('mobile and desktop links prefill identical single-use message', () => {
  const mobile = new URL(whatsappLink(link)); const web = new URL(whatsappLink(link, true));
  assert.equal(mobile.hostname, 'wa.me'); assert.equal(web.hostname, 'web.whatsapp.com');
  assert.equal(web.searchParams.get('phone'), link.bot_phone);
  assert.equal(mobile.searchParams.get('text'), link.message); assert.equal(web.searchParams.get('text'), link.message);
  assert.equal(linkExpired(link, Date.parse(link.expires_at)), true);
  assert.equal(linkExpired(link, Date.parse(link.expires_at) - 1), false);
});
test('verification always bypasses AI and uses app-selected locale', () => {
  for (const locale of ['es','en','pt']) for (const verified of [true,false]) {
    const context = authorizeContext(envelope, { success: true, verification: { handled: true, verified, locale } });
    assert.equal(context.state, 'verification'); assert.equal(context.user, null); assert.equal(context.locale, locale);
    assert.throws(() => assistantInput(context));
    const reply = genericReply(context).text;
    assert.ok(reply.length); assert.ok(!reply.includes(link.message));
  }
});
test('untrusted HTTP failure cannot mark a code as verified', () => {
  const context = authorizeContext(envelope, { statusCode: 401, body: { success: true, verification: { handled: true, verified: true } } });
  assert.equal(context.state, 'unavailable'); assert.throws(() => assistantInput(context));
});
