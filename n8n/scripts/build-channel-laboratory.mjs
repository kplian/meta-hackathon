// Generates a sanitized graph specification; it never reads or exports secrets.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const library = readFileSync(new URL('lib/messaging.mjs', root), 'utf8').replace(/^export /gm, '');
const policy = readFileSync(new URL('prompts/tool_error_policy.md', root), 'utf8');
const purpose = readFileSync(new URL('mcp/assistant-prompt.md', root), 'utf8');
const formatRepair = readFileSync(new URL('prompts/format_only_repair.md', root), 'utf8');
const nodes = [];
const edges = [];
const credentials = {
  whatsappTrigger: { key: 'whatsAppTriggerApi', id: '2FeT8VcF0ZStRcFL', name: 'WhatsApp DEV' },
  whatsappSend: { key: 'httpHeaderAuth', id: 'IewFQldhEIETRHZE', name: 'Header Auth Meta 1' },
  telegram: { key: 'telegramApi', id: '5QPZfZspne7yifAe', name: 'Telegram account 2' },
  database: { key: 'supabaseApi', id: 'D7CKuo645oY8I6Dc', name: 'Supabase account 2' },
  groq: { key: 'groqApi', id: '3j3emt2oYaVfvbZA', name: 'Groq account' },
};
const base = 'https://ywibmualqaipmygmrojz.supabase.co/rest/v1/rpc/';
function add(name, type, typeVersion, parameters, position, credential, keep) {
  nodes.push({ name, type, typeVersion, parameters, position, credential, keep });
}
function code(name, body, position, keep, all = false) {
  add(name, 'n8n-nodes-base.code', 2, { mode: all ? 'runOnceForAllItems' : 'runOnceForEachItem', jsCode: library + '\n' + body }, position, undefined, keep);
}
function edge(source, target, sourceIndex = 0, connectionType = 'main') { edges.push({ source, target, sourceIndex, connectionType }); }
function route(name, output, numberOutputs, position, keep) {
  add(name, 'n8n-nodes-base.switch', 3.4, { mode: 'expression', output, numberOutputs }, position, undefined, keep);
}
const response = { response: { fullResponse: true, neverError: true, responseFormat: 'json' } };

add('WhatsApp entry', 'n8n-nodes-base.whatsAppTrigger', 1, { updates: ['messages'], options: { messageStatusUpdates: [] } }, [0, 0], credentials.whatsappTrigger);
add('Telegram entry', 'n8n-nodes-base.telegramTrigger', 1.5, { updates: ['message'], additionalFields: { download: false } }, [0, 250], credentials.telegram);
code('Normalize WhatsApp', "return $input.all().flatMap((item, index) => normalizeWhatsApp(item.json).map(json => ({ json, pairedItem: { item: index } })));", [250, 0], 'Code in JavaScript1', true);
code('Normalize Telegram', "return $input.all().flatMap((item, index) => normalizeTelegram(item.json).map(json => ({ json, pairedItem: { item: index } })));", [250, 250], undefined, true);
add('One message at a time', 'n8n-nodes-base.splitInBatches', 3, { batchSize: 1, options: {} }, [500, 100]);
add('Resolve registration', 'n8n-nodes-base.httpRequest', 4.5, {
  method: 'POST', url: base + 'f_messaging_context_lab', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [{ name: 'Content-Profile', value: 'budget' }] },
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: '={{ ({p_channel_type: $json.transport.channel, p_channel_code: $json.transport.senderId}) }}',
  options: { timeout: 10000, response },
}, [750, 100], credentials.database);
code('Authorized context', "const source = $('One message at a time').item.json; return { json: authorizeContext(source, $input.item.json) };", [1000, 100]);
add('Registered user?', 'n8n-nodes-base.if', 2.3, { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
  conditions: [{ leftValue: '={{ $json.state }}', rightValue: 'registered', operator: { type: 'string', operation: 'equals' } }], combinator: 'and',
}, options: {} }, [1250, 100]);
code('Registration reply', 'return { json: { reply: genericReply($input.item.json) } };', [1500, 500]);
route('Content route', "={{ $json.message.kind === 'text' ? 0 : ['audio','image','document'].includes($json.message.kind) ? 1 : 2 }}", 3, [1500, 0], 'Switch1');
code('Unsupported reply', "return { json: { reply: genericReply($input.item.json, 'unsupported') } };", [1750, 500]);
route('Media channel', "={{ $json.transport.channel === 'whatsapp' ? 0 : 1 }}", 2, [1750, 200]);
add('WhatsApp media metadata', 'n8n-nodes-base.httpRequest', 4.5, {
  method: 'GET', url: "=https://graph.facebook.com/v26.0/{{ $('Authorized context').item.json.message.attachments[0].id }}",
  authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', options: { timeout: 15000 },
}, [2000, 100], credentials.whatsappSend, 'HTTP Request1');
add('WhatsApp media download', 'n8n-nodes-base.httpRequest', 4.5, {
  method: 'GET', url: '={{ $json.url }}', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
  options: { timeout: 15000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } },
}, [2250, 100], credentials.whatsappSend, 'HTTP Request2');
add('Telegram media download', 'n8n-nodes-base.telegram', 1.2, { resource: 'file', operation: 'get', fileId: "={{ $('Authorized context').item.json.message.attachments[0].id }}", download: true, additionalFields: {} }, [2250, 300], credentials.telegram);
route('Audio or attachment', "={{ $('Authorized context').item.json.message.kind === 'audio' ? 0 : 1 }}", 2, [2500, 200]);
add('Transcribe audio', 'n8n-nodes-base.httpRequest', 4.5, {
  method: 'POST', url: 'https://ywibmualqaipmygmrojz.supabase.co/functions/v1/audio-transcribe',
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'multipart-form-data', bodyParameters: { parameters: [
    { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' },
  ] }, options: { timeout: 45000 },
}, [2750, 100], credentials.database, 'Meta Muse Transcribe');
code('Assistant input', "const context = $('Authorized context').item.json; const current = $input.item; return { json: { assistant: assistantInput(context, current.json.text) }, ...(current.binary ? { binary: current.binary } : {}) };", [3000, 0]);
add('AI Agent', '@n8n/n8n-nodes-langchain.agent', 3.1, {
  promptType: 'define', text: '={{ JSON.stringify($json.assistant) }}', hasOutputParser: true,
  options: { systemMessage: policy + '\n\n' + purpose, maxIterations: 6, enableStreaming: false, passthroughBinaryImages: true },
}, [3250, 0], undefined, 'AI Agent');
nodes.find(n => n.name === 'AI Agent').settings = { onError: 'continueErrorOutput' };
code('Assistant failure reply', "return { json: { reply: assistantFailureReply($('Authorized context').item.json) } };", [3500, 500]);
add('DeepSeek Chat Model', '@n8n/n8n-nodes-langchain.lmChatDeepSeek', 1, { model: 'deepseek-v4-pro', options: {} }, [3000, -400], undefined, 'DeepSeek Chat Model');
add('Simple Memory', '@n8n/n8n-nodes-langchain.memoryBufferWindow', 1.4, { sessionIdType: 'customKey', sessionKey: "={{ 'messaging:mcp-v1:' + $('Authorized context').item.json.user.id }}", contextWindowLength: 5 }, [3250, -400], undefined, 'Simple Memory');
add('Standard response schema', '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, { schemaType: 'manual', inputSchema: JSON.stringify({ type: 'object', properties: { text: { type: 'string', minLength: 1 } }, required: ['text'], additionalProperties: false }), autoFix: true, customizeRetryPrompt: true, prompt: formatRepair }, [3500, -400]);
code('Standard reply', "if ($input.all().length !== 1) throw new Error('Expected one authorized message'); const current = $input.first().json; const context = $('Authorized context').item.json; return chunkReply(standardReply(current.reply || current.output), context.transport).map(json => ({ json, pairedItem: { item: 0 } }));", [3750, 100], 'Code in JavaScript', true);
route('Reply channel', "={{ $json.transport.channel === 'whatsapp' ? 0 : 1 }}", 2, [4000, 100]);
code('Format WhatsApp reply', 'return { json: { transport: $input.item.json.transport, body: whatsappReply($input.item.json) } };', [4250, 0]);
code('Format Telegram reply', 'return { json: { transport: $input.item.json.transport, telegram: telegramReply($input.item.json) } };', [4250, 250]);
add('Send WhatsApp', 'n8n-nodes-base.httpRequest', 4.5, {
  method: 'POST', url: '=https://graph.facebook.com/v26.0/{{ $json.transport.accountId }}/messages',
  authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '={{ $json.body }}',
  options: { timeout: 15000, batching: { batch: { batchSize: 1, batchInterval: 250 } }, response: { response: { fullResponse: true, neverError: false, responseFormat: 'json' } } },
}, [4500, 0], credentials.whatsappSend, 'Response to Whatsapp');
add('Send Telegram', 'n8n-nodes-base.telegram', 1.2, { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.telegram.chatId }}', text: '={{ $json.telegram.text }}', additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true } }, [4500, 250], credentials.telegram);
add('Reply complete', 'n8n-nodes-base.code', 2, { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { completed: true } }];' }, [4750, 100]);

add('Family MCP client', '@n8n/n8n-nodes-langchain.mcpClientTool', 1.4, {
  endpointUrl: 'https://dev-n8n.kplian.com/mcp/family-finance-lab', serverTransport: 'httpStreamable',
  authentication: 'multipleHeadersAuth', include: 'all', options: { timeout: 120000 },
}, [3250, -700], { key: 'httpMultipleHeadersAuth', id: 'KY5EZMF56w8Zf31U', name: 'Multiple Headers Auth account' });
edge('Family MCP client', 'AI Agent', 0, 'ai_tool');

edge('WhatsApp entry', 'Normalize WhatsApp'); edge('Telegram entry', 'Normalize Telegram');
edge('Normalize WhatsApp', 'One message at a time'); edge('Normalize Telegram', 'One message at a time');
edge('One message at a time', 'Resolve registration', 1);
edge('Resolve registration', 'Authorized context'); edge('Authorized context', 'Registered user?');
edge('Registered user?', 'Content route', 0); edge('Registered user?', 'Registration reply', 1);
edge('Registration reply', 'Standard reply');
edge('Content route', 'Assistant input', 0); edge('Content route', 'Media channel', 1); edge('Content route', 'Unsupported reply', 2);
edge('Unsupported reply', 'Standard reply');
edge('Media channel', 'WhatsApp media metadata', 0); edge('Media channel', 'Telegram media download', 1);
edge('WhatsApp media metadata', 'WhatsApp media download'); edge('WhatsApp media download', 'Audio or attachment'); edge('Telegram media download', 'Audio or attachment');
edge('Audio or attachment', 'Transcribe audio', 0); edge('Audio or attachment', 'Assistant input', 1); edge('Transcribe audio', 'Assistant input');
edge('Assistant input', 'AI Agent'); edge('AI Agent', 'Standard reply');
edge('AI Agent', 'Assistant failure reply', 1); edge('Assistant failure reply', 'Standard reply');
edge('DeepSeek Chat Model', 'AI Agent', 0, 'ai_languageModel'); edge('Simple Memory', 'AI Agent', 0, 'ai_memory'); edge('Standard response schema', 'AI Agent', 0, 'ai_outputParser');
edge('DeepSeek Chat Model', 'Standard response schema', 0, 'ai_languageModel');
edge('Standard reply', 'Reply channel'); edge('Reply channel', 'Format WhatsApp reply', 0); edge('Reply channel', 'Format Telegram reply', 1);
edge('Format WhatsApp reply', 'Send WhatsApp'); edge('Format Telegram reply', 'Send Telegram');
edge('Send WhatsApp', 'Reply complete'); edge('Send Telegram', 'Reply complete'); edge('Reply complete', 'One message at a time');

const outbound = ['Reply channel','Format WhatsApp reply','Format Telegram reply','Send WhatsApp','Send Telegram','Reply complete'];
const groupedElsewhere = ['WhatsApp entry','Telegram entry','Normalize WhatsApp','Normalize Telegram','One message at a time',...outbound];
const groups = [
  { name: 'WhatsApp input', description: 'Verified Meta event to standard message. No AI or account creation.', nodeNames: ['Normalize WhatsApp'] },
  { name: 'Telegram input', description: 'Verified private update to standard message. No AI or account creation.', nodeNames: ['Normalize Telegram'] },
  { name: 'Shared assistant', description: 'Resolve account, localize generic replies, prepare media and run the channel-independent financial assistant.', nodeNames: nodes.filter(n => !groupedElsewhere.includes(n.name)).map(n => n.name) },
  { name: 'Channel delivery', description: 'Standard reply to provider payload. Existing credentials; no automatic send retries.', nodeNames: outbound },
];
const spec = { workflowId: 'Mp1ACq1Zxypiktdg', nodes, edges, groups };
const target = new URL('workflows/channel-laboratory.spec.json', root);
writeFileSync(target, JSON.stringify(spec, null, 2) + '\n');
console.log(`Generated ${nodes.length} nodes and ${edges.length} connections: ${fileURLToPath(target)}`);
