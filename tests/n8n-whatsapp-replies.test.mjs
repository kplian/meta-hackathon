import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const patches = JSON.parse(readFileSync(new URL('../n8n/patches/whatsapp-replies.json', import.meta.url), 'utf8'));
const parameter = (node, key) => patches.find(p => p.nodeName === node && key in p.parameters).parameters[key];
const sender = '15550000001';
function webhook(message) {
  return { body: { entry: [{ changes: [{ value: { messages: [message], metadata: { phone_number_id: '123456' } } }] }] } };
}
function normalize(input) {
  return vm.runInNewContext(`(function(){${parameter('Code in JavaScript1', 'jsCode')}\n})()`, { $input: { item: { json: input } } }, { timeout: 100 });
}
function format(output, message = { from: sender }) {
  return vm.runInNewContext(`(function(){${parameter('Code in JavaScript', 'jsCode')}\n})()`, {
    $input: { item: { json: { output } } },
    $: name => {
      assert.equal(name, 'Webhook');
      return { first: () => ({ json: webhook(message) }) };
    },
  }, { timeout: 100 });
}

test('delivery/read/failure status callbacks produce no downstream item', () => {
  for (const status of ['sent', 'delivered', 'read', 'failed']) {
    assert.equal(normalize({ body: { entry: [{ changes: [{ value: { statuses: [{ status }] } }] }] } }), null);
  }
});

test('empty and unrelated webhook callbacks produce no reply', () => {
  for (const input of [{}, { body: {} }, { body: { entry: [] } }, { body: { entry: [{ changes: [{ value: {} }] }] } }]) {
    assert.equal(normalize(input), null);
  }
});

test('normal inbound messages retain metadata and take their existing routes', () => {
  for (const type of ['text', 'audio', 'image', 'document', 'sticker']) {
    const result = normalize(webhook({ from: sender, id: 'test-wamid', type, text: { body: 'Hola' } }));
    assert.equal(result.json.ignore, false);
    assert.equal(result.json.from, sender);
    assert.equal(result.json.type, type);
  }
});

test('agent reply serializes as an explicit WhatsApp text message', () => {
  const text = 'Saldo "disponible"\nCafé ☕';
  const result = JSON.parse(JSON.stringify(format(text)))[0].json;
  assert.deepEqual(result, { messaging_product: 'whatsapp', recipient_type: 'individual', to: sender, type: 'text', text: { body: text } });
});

test('blank, absent and structured agent output is rejected before HTTP send', () => {
  for (const output of [undefined, null, '', '   ', {}, []]) assert.throws(() => format(output), /EMPTY_WHATSAPP_REPLY/);
});

test('missing or invalid recipient metadata is rejected before HTTP send', () => {
  for (const message of [{}, { from: '' }, { from: 'not-a-phone' }]) assert.throws(() => format('Hola', message), /INVALID_WHATSAPP_RECIPIENT/);
});

test('unsupported message route sends a text payload instead of the normalized event', () => {
  const expression = parameter('Response to Whatsapp1', 'jsonBody');
  const result = vm.runInNewContext(expression.slice(3, -2), { $: () => ({ first: () => ({ json: webhook({ from: sender, type: 'sticker' }) }) }) }, { timeout: 100 });
  assert.equal(result.messaging_product, 'whatsapp');
  assert.equal(result.type, 'text');
  assert.equal(result.to, sender);
  assert.match(result.text.body, /texto, audio/);
  assert.equal(result.media_id, undefined);
});

test('HTTP send failures remain failures and are not hidden by neverError', () => {
  for (const node of ['Response to Whatsapp', 'Response to Whatsapp1']) {
    const options = parameter(node, 'options');
    assert.equal(options.response.response.neverError, false);
    assert.equal(options.response.response.fullResponse, true);
    assert.equal(options.timeout, 15000);
  }
});
