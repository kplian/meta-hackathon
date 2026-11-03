import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizeWhatsApp, normalizeTelegram, authorizeContext, assistantInput, assistantFailureReply, genericReply, selectLocale, standardReply, chunkReply, whatsappReply, telegramReply } from '../n8n/lib/messaging.mjs';

const spec = JSON.parse(readFileSync(new URL('../n8n/workflows/channel-laboratory.spec.json', import.meta.url), 'utf8'));
const node = name => spec.nodes.find(n => n.name === name);
const wa = (text = 'Hola') => ({ metadata: { phone_number_id: '11111' }, messages: [{ id: 'wa-msg', from: '15550000001', type: 'text', text: { body: text } }] });
const tg = (text = 'Hello', extra = {}) => ({ update_id: 42, message: { message_id: 7, from: { id: 12345, language_code: 'en' }, chat: { id: 12345, type: 'private' }, text, ...extra } });
const known = { success: true, registered: true, user: { id: 'user-a', name: 'Ana', locale: 'es', households: [{ id: 'home-a', name: 'Familia A', currency: 'BOB', role: 'admin' }] } };

test('both channels normalize to the same message contract', () => {
  const a = normalizeWhatsApp(wa())[0], b = normalizeTelegram(tg())[0];
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  assert.deepEqual(Object.keys(a.message).sort(), Object.keys(b.message).sort());
  assert.equal(a.transport.channel, 'whatsapp'); assert.equal(b.transport.channel, 'telegram');
});
test('all WhatsApp messages in one native event are retained in order', () => {
  const input = wa(); input.messages.push({ ...input.messages[0], id: 'second', from: '15550000002' });
  assert.equal(normalizeWhatsApp(input).length, 2);
  assert.equal(normalizeWhatsApp(input)[1].transport.senderId, '15550000002');
});
test('status callbacks, edits, bot senders and groups do not reach the assistant', () => {
  assert.deepEqual(normalizeWhatsApp({ metadata: { phone_number_id: '1' }, statuses: [{ status: 'read' }] }), []);
  assert.deepEqual(normalizeTelegram({ edited_message: tg().message }), []);
  assert.deepEqual(normalizeTelegram(tg('Hi', { chat: { id: -123, type: 'group' } })), []);
  assert.deepEqual(normalizeTelegram(tg('Hi', { from: { id: 12345, is_bot: true } })), []);
});
test('Telegram identity comes from sender ID, never username, phone or forwarded author', () => {
  const input = tg('Hi', { forward_origin: { sender_user: { id: 99999 } }, from: { id: 12345, username: 'someone', phone_number: 'untrusted' } });
  assert.equal(normalizeTelegram(input)[0].transport.senderId, '12345');
});
test('media metadata is normalized without downloading files before registration', () => {
  const input = tg(undefined, { text: undefined, voice: { file_id: 'audio-id', mime_type: 'audio/ogg' } });
  const normalized = normalizeTelegram(input)[0];
  assert.equal(normalized.message.kind, 'audio'); assert.equal(normalized.message.attachments[0].id, 'audio-id');
  assert.equal(node('Telegram entry').parameters.additionalFields.download, false);
});
test('unknown sender receives registration message and cannot form model input', () => {
  const context = authorizeContext(normalizeWhatsApp(wa())[0], { success: true, registered: false });
  assert.equal(context.state, 'unregistered'); assert.match(genericReply(context).text, /crea tu cuenta/);
  assert.throws(() => assistantInput(context), /Unregistered/);
});
test('DB failures do not masquerade as missing registration or enter the model', () => {
  for (const response of [{ statusCode: 503, body: { success: false } }, { success: false, error: 'AMBIGUOUS_CHANNEL' }, {}, { success: true, registered: true }]) {
    const context = authorizeContext(normalizeTelegram(tg())[0], response);
    assert.equal(context.state, 'unavailable');
    assert.match(genericReply(context).text, /could not verify/);
    assert.throws(() => assistantInput(context));
  }
});
test('a malformed registered response fails closed', () => {
  const context = authorizeContext(normalizeWhatsApp(wa())[0], { success: true, registered: true, user: {} });
  assert.notEqual(context.state, 'registered');
});
test('generic replies use English, Spanish or Portuguese before AI', () => {
  for (const [text, expected] of [['Hello, help please', /create an account/], ['Hola, quiero ayuda', /crea tu cuenta/], ['Olá, preciso de ajuda', /crie sua conta/]]) {
    const context = authorizeContext(normalizeWhatsApp(wa(text))[0], { success: true, registered: false });
    assert.match(genericReply(context).text, expected);
  }
});
test('ambiguous first message gets a short trilingual registration reply', () => {
  const context = authorizeContext(normalizeWhatsApp(wa('25'))[0], { success: true, registered: false });
  assert.equal(context.locale, null);
  for (const phrase of ['crea tu cuenta', 'create an account', 'crie sua conta']) assert.ok(genericReply(context).text.includes(phrase));
});
test('profile locale and Telegram language hint handle ambiguous text', () => {
  const env = normalizeTelegram(tg('25'))[0];
  assert.equal(selectLocale(env, 'pt-BR'), 'pt');
  assert.equal(selectLocale(env, null), 'en');
  assert.equal(selectLocale(normalizeTelegram(tg('Hola'))[0], 'pt'), 'es');
});
test('explicit language command is supported without a model', () => {
  assert.equal(selectLocale(normalizeWhatsApp(wa('/lang pt'))[0], 'es'), 'pt');
});
test('financial questions without greetings override a different profile language', () => {
  for (const [text, language] of [
    ['List my savings vaults and their balances. Do not create or change anything.', 'en'],
    ['Quanto falta para alcançar minha meta de poupança deste mês?', 'pt'],
    ['Muéstrame mis bóvedas y cuánto tengo disponible.', 'es'],
  ]) {
    assert.equal(selectLocale(normalizeWhatsApp(wa(text))[0], language === 'es' ? 'en' : 'es'), language);
  }
});
test('assistant failures preserve language and warn about uncertain financial writes', () => {
  assert.match(assistantFailureReply({locale:'en'}).text,/check the history/);
  assert.match(assistantFailureReply({locale:'pt'}).text,/consulte o histórico/);
  assert.match(assistantFailureReply({locale:'es'}).text,/revisa el historial/);
  assert.doesNotMatch(assistantFailureReply({locale:'es'}).text,/no se guardó|registrado correctamente/i);
});
test('agent errors have a localized reply route instead of dropping the conversation', () => {
  assert.equal(node('AI Agent').settings.onError,'continueErrorOutput');
  assert.ok(spec.edges.some(e=>e.source==='AI Agent' && e.sourceIndex===1 && e.target==='Assistant failure reply'));
  assert.ok(spec.edges.some(e=>e.source==='Assistant failure reply' && e.target==='Standard reply'));
});
test('model input has neither transport details nor provider-specific file IDs', () => {
  const context = authorizeContext(normalizeTelegram(tg('Hello'))[0], known);
  context.message.attachments = [{ id: 'secret-provider-file-id', mimeType: 'image/jpeg', fileName: 'receipt.jpg' }];
  const value = assistantInput(context);
  assert.deepEqual(Object.keys(value).sort(), ['locale', 'message', 'user']);
  assert.doesNotMatch(JSON.stringify(value), /telegram|whatsapp|12345|provider-file-id|recipientId|senderId|accountId/);
});
test('model receives the same contract for the same content on both channels', () => {
  const a = authorizeContext(normalizeWhatsApp(wa('Hola'))[0], known);
  const b = authorizeContext(normalizeTelegram(tg('Hola'))[0], known);
  assert.deepEqual(assistantInput(a), assistantInput(b));
});
test('outgoing adapters own destination and provider formatting', () => {
  const context = authorizeContext(normalizeWhatsApp(wa())[0], known);
  const reply = standardReply({ text: 'Saldo <25> & "ok"' });
  const item = chunkReply(reply, context.transport)[0];
  assert.equal(whatsappReply(item).to, context.transport.senderId);
  assert.equal(whatsappReply(item).text.body, reply.text);
  const telegram = { ...item, transport: normalizeTelegram(tg())[0].transport };
  assert.equal(telegramReply(telegram).text, 'Saldo &lt;25&gt; &amp; "ok"');
  assert.throws(() => whatsappReply(telegram)); assert.throws(() => telegramReply(item));
});
test('long standard replies are split without losing text or splitting emoji pairs', () => {
  const text = 'x'.repeat(3999) + '😀' + 'y'.repeat(8000);
  const parts = chunkReply({ text }, normalizeTelegram(tg())[0].transport);
  assert.equal(parts.map(p => p.reply.text).join(''), text);
  assert.ok(parts.every(p => p.reply.text.length <= 4000 && !/[\uD800-\uDBFF]$/.test(p.reply.text)));
});
test('AI has an explicit channel-free response schema and channel-free purpose', () => {
  const schema = JSON.parse(node('Standard response schema').parameters.inputSchema);
  assert.deepEqual(schema.required, ['text']); assert.equal(schema.additionalProperties, false);
  assert.doesNotMatch(node('AI Agent').parameters.options.systemMessage, /WhatsApp|Telegram/);
  assert.equal(node('AI Agent').parameters.text, '={{ JSON.stringify($json.assistant) }}');
});
test('ingress security uses native validated triggers, never a generic public webhook', () => {
  assert.equal(node('WhatsApp entry').type, 'n8n-nodes-base.whatsAppTrigger');
  assert.equal(node('Telegram entry').type, 'n8n-nodes-base.telegramTrigger');
  assert.ok(node('Telegram entry').typeVersion > 1);
  assert.equal(node('Telegram entry').credential.name, 'Telegram account 2');
  assert.ok(!spec.nodes.some(n => n.type === 'n8n-nodes-base.webhook'));
});
test('media and AI are reachable only after the registration gate', () => {
  const gate = spec.edges.filter(e => e.source === 'Registered user?');
  assert.deepEqual(gate.map(e => [e.sourceIndex, e.target]), [[0, 'Content route'], [1, 'Registration reply']]);
  assert.equal(spec.edges.find(e => e.target === 'Resolve registration').source, 'One message at a time');
  assert.equal(node('One message at a time').parameters.batchSize, 1);
});
test('laboratory uses one authenticated MCP client instead of individual database tools', () => {
  assert.equal(spec.nodes.filter(n => n.type.endsWith('httpRequestTool')).length, 0);
  const clients = spec.nodes.filter(n => n.type.endsWith('mcpClientTool'));
  assert.equal(clients.length, 1);
  assert.equal(clients[0].parameters.authentication, 'multipleHeadersAuth');
  assert.equal(clients[0].parameters.endpointUrl, 'https://dev-n8n.kplian.com/mcp/family-finance-lab');
  assert.equal(clients[0].credential.id, 'KY5EZMF56w8Zf31U');
  assert.ok(spec.edges.some(e => e.source === clients[0].name && e.target === 'AI Agent' && e.connectionType === 'ai_tool'));
});
test('memory follows canonical user identity across linked channels', () => {
  assert.match(node('Simple Memory').parameters.sessionKey, /user\.id/);
  assert.doesNotMatch(node('Simple Memory').parameters.sessionKey, /transport|sender|Webhook/);
});
test('transcription no longer forces Spanish', () => {
  assert.ok(!node('Transcribe audio').parameters.bodyParameters.parameters.some(p => p.name === 'language'));
  assert.equal(node('Transcribe audio').credential.name, 'Supabase account 2');
});
test('MCP server binds identity from headers, never from model arguments', () => {
  const server = readFileSync(new URL('../n8n/mcp/server.sdk.ts', import.meta.url), 'utf8');
  assert.match(server, /x-family-channel/);
  assert.match(server, /x-family-sender/);
  assert.doesNotMatch(server, /fromAI\(['"](?:channel|sender|user_id|phone)/);
  assert.match(server, /authentication:'bearerAuth'/);
  assert.match(server, /f_family_mcp/);
});
