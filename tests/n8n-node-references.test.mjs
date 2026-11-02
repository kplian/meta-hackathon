import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const patches = JSON.parse(readFileSync(new URL('../n8n/patches/node-reference-fix.json', import.meta.url), 'utf8'));
const expression = (name, field) => patches.find(p => p.nodeName === name).parameters[field];
const sender = '15550000001';
function evaluate(source, { input = {}, normalized = {}, ai = {} } = {}) {
  return vm.runInNewContext(source.slice(3, -2), {
    $json: input,
    $fromAI: key => ai[key],
    $: name => {
      // Unexecuted media branches and nonexistent nodes deliberately throw.
      if (name === 'Webhook') return { first: () => ({ json: { body: { entry: [{ changes: [{ value: { messages: [{ from: sender }] } }] }] } } }) };
      if (name === 'Code in JavaScript1') return { first: () => ({ json: normalized }) };
      throw new Error(`Node unavailable: ${name}`);
    },
  }, { timeout: 100 });
}

for (const [name, field] of [
  ['get_budget_summary', 'p_whatsapp_phone'],
  ['add_user_to_household', 'p_admin_whatsapp_phone'],
  ['get_recent_transactions', 'p_whatsapp_phone'],
]) {
  test(`${name} binds sender to WhatsApp metadata, independent of model input`, () => {
    const result = evaluate(expression(name, 'jsonBody'), { ai: { p_whatsapp_phone: 'spoofed', p_admin_whatsapp_phone: 'spoofed' } });
    assert.equal(result[field], sender);
    assert.equal(result.p_household_name, null);
  });
}

test('tool bodies retain quotes, newlines, target contact and numeric limit', () => {
  const ai = { household_name: 'Familia "A"\nB', target_full_name: 'Ana "María"', target_whatsapp_phone: '15550000002', role: 'admin', limit: 7 };
  const member = evaluate(expression('add_user_to_household', 'jsonBody'), { ai });
  assert.equal(JSON.parse(JSON.stringify(member)).p_target_full_name, ai.target_full_name);
  assert.equal(member.p_target_whatsapp_phone, ai.target_whatsapp_phone);
  assert.equal(member.p_admin_whatsapp_phone, sender);
  assert.equal(member.p_household_name, ai.household_name);
  assert.equal(member.p_role, 'admin');
  assert.equal(evaluate(expression('get_recent_transactions', 'jsonBody'), { ai }).p_limit, 7);
  assert.equal(evaluate(expression('get_recent_transactions', 'jsonBody')).p_limit, 10);
});

test('text prompt does not access the audio branch', () => {
  assert.equal(evaluate(expression('AI Agent', 'text'), { input: { text: 'Consulta mi saldo' } }), 'Consulta mi saldo');
});

test('audio prompt uses the transcription received as immediate input', () => {
  assert.equal(evaluate(expression('AI Agent', 'text'), { input: { text: 'Transcripción de audio' }, normalized: { text: null } }), 'Transcripción de audio');
});

test('image/document prompt works when the audio branch did not execute', () => {
  const result = evaluate(expression('AI Agent', 'text'), { normalized: { text: null } });
  assert.match(result, /Analiza el contenido adjunto/);
});

test('prompt can use normalized text if media input replaced the JSON', () => {
  assert.equal(evaluate(expression('AI Agent', 'text'), { normalized: { text: 'Mensaje original' } }), 'Mensaje original');
});
