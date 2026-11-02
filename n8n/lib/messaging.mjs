// Pure channel adapters. Their callers must be the authenticated native triggers.
export function normalizeWhatsApp(event) {
  const accountId = String(event?.metadata?.phone_number_id || '');
  if (!/^\d+$/.test(accountId) || !Array.isArray(event?.messages)) return [];
  return event.messages.flatMap(message => {
    const sender = String(message.from || '');
    if (!/^\d+$/.test(sender) || !message.id) return [];
    const kind = ['voice', 'audio'].includes(message.type) ? 'audio'
      : ['text', 'image', 'document'].includes(message.type) ? message.type : 'unsupported';
    const media = message[message.type] || {};
    return [{ version: 1, message: {
      id: String(message.id), kind,
      text: String(message.text?.body || media.caption || ''),
      attachments: media.id ? [{ id: String(media.id), mimeType: media.mime_type || null, fileName: media.filename || null }] : [],
    }, localeHint: null, transport: {
      channel: 'whatsapp', senderId: sender, recipientId: sender,
      accountId, messageId: String(message.id),
    } }];
  });
}

export function normalizeTelegram(update) {
  const message = update?.message;
  // Financial conversations are private. Groups, bot senders and edited updates
  // must not reuse a private user's identity or leak financial replies to a group.
  if (!message || message.chat?.type !== 'private' || message.from?.is_bot) return [];
  const sender = String(message.from?.id || '');
  const recipient = String(message.chat?.id || '');
  if (!/^\d+$/.test(sender) || recipient !== sender || message.message_id === undefined) return [];
  const media = message.voice || message.audio || message.photo?.at(-1) || message.document;
  const kind = message.voice || message.audio ? 'audio' : message.photo ? 'image'
    : message.document ? 'document' : typeof message.text === 'string' ? 'text' : 'unsupported';
  return [{ version: 1, message: {
    id: `${update.update_id}:${message.message_id}`, kind,
    text: String(message.text || message.caption || ''),
    attachments: media?.file_id ? [{ id: String(media.file_id), mimeType: media.mime_type || null, fileName: media.file_name || null }] : [],
  }, localeHint: message.from.language_code || null, transport: {
    channel: 'telegram', senderId: sender, recipientId: recipient,
    accountId: null, messageId: String(message.message_id),
  } }];
}

export function supportedLocale(value) {
  const code = String(value || '').toLowerCase().split(/[-_]/)[0];
  return ['es', 'en', 'pt'].includes(code) ? code : null;
}

export function detectTextLocale(text) {
  const input = String(text || '').toLowerCase();
  const explicit = input.match(/^\/(?:lang|language|idioma|start)\s+(es|en|pt)\b/);
  if (explicit) return explicit[1];
  const words = input.match(/[\p{L}]+/gu) || [];
  const dictionaries = {
    es: ['hola', 'buenas', 'quiero', 'necesito', 'gasté', 'gasto', 'cuánto', 'hogar', 'ingresos', 'ayuda', 'registrarme', 'gracias', 'español'],
    en: ['hello', 'hi', 'please', 'spent', 'spend', 'income', 'expense', 'register', 'account', 'help', 'thanks', 'balance', 'english'],
    pt: ['oi', 'olá', 'bom', 'obrigado', 'obrigada', 'quero', 'preciso', 'gastei', 'despesa', 'receita', 'família', 'cadastro', 'ajuda', 'português'],
  };
  const scores = Object.entries(dictionaries).map(([locale, dictionary]) => ({ locale, score: words.filter(word => dictionary.includes(word)).length }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 && scores[0].score > scores[1].score ? scores[0].locale : null;
}

export function selectLocale(envelope, profileLocale) {
  return detectTextLocale(envelope.message.text) || supportedLocale(profileLocale) || supportedLocale(envelope.localeHint);
}

export function authorizeContext(envelope, httpResponse) {
  const status = httpResponse?.statusCode ?? 200;
  const body = httpResponse?.body ?? httpResponse;
  const healthy = status >= 200 && status < 300 && body?.success === true;
  const registered = healthy && body.registered === true && typeof body.user?.id === 'string';
  return {
    ...envelope,
    state: registered ? 'registered' : healthy && body.registered === false ? 'unregistered' : 'unavailable',
    locale: selectLocale(envelope, registered ? body.user.locale : null),
    user: registered ? body.user : null,
  };
}

export function genericReply(context, reason = context.state) {
  const catalog = {
    unregistered: {
      es: 'Para usar el asistente, crea tu cuenta en la app y vincula este medio de contacto. Si ya tienes cuenta, verifica que este contacto esté vinculado.',
      en: 'To use the assistant, create an account in the app and link this contact method. If you already have an account, make sure this contact is linked.',
      pt: 'Para usar o assistente, crie sua conta no app e vincule este meio de contato. Se já tem uma conta, verifique se este contato está vinculado.',
    },
    unavailable: {
      es: 'No pudimos verificar tu cuenta en este momento. Inténtalo más tarde.',
      en: 'We could not verify your account right now. Please try again later.',
      pt: 'Não foi possível verificar sua conta agora. Tente novamente mais tarde.',
    },
    unsupported: {
      es: 'Envíame tu consulta como texto, audio, imagen o documento.',
      en: 'Please send your question as text, audio, an image or a document.',
      pt: 'Envie sua pergunta como texto, áudio, imagem ou documento.',
    },
  };
  const messages = catalog[reason];
  if (!messages) throw new Error('Unknown generic reply');
  const text = context.locale ? messages[context.locale] : ['es', 'en', 'pt'].map(locale => messages[locale]).join('\n\n');
  return { text };
}

export function assistantInput(context, content) {
  if (context.state !== 'registered') throw new Error('Unregistered users cannot reach the assistant');
  const text = typeof content === 'string' && content.trim() ? content : context.message.text;
  // This is the ONLY object serialized into the model prompt. No provider IDs,
  // routing, webhook headers, token, raw event or signature is included.
  return {
    message: { text, kind: context.message.kind, attachments: context.message.attachments.map(file => ({ mimeType: file.mimeType, fileName: file.fileName })) },
    user: { name: context.user.name, households: context.user.households || [] },
    locale: context.locale,
  };
}

export function standardReply(output) {
  const text = typeof output === 'string' ? output : output?.text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('EMPTY_ASSISTANT_REPLY');
  return { text };
}

export function chunkReply(reply, transport) {
  const result = [];
  let remaining = standardReply(reply).text;
  while (remaining.length) {
    let end = Math.min(4000, remaining.length);
    // Avoid cutting an emoji surrogate pair in half. The conservative limit also
    // fits both channels' text limits, without truncating a financial report.
    if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
    result.push({ reply: { text: remaining.slice(0, end) }, transport });
    remaining = remaining.slice(end);
  }
  return result;
}

export function whatsappReply(item) {
  if (item.transport.channel !== 'whatsapp') throw new Error('Wrong outbound adapter');
  const to = String(item.transport.recipientId || '');
  if (!/^\d+$/.test(to)) throw new Error('Invalid recipient');
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: standardReply(item.reply).text } };
}

export function telegramReply(item) {
  if (item.transport.channel !== 'telegram') throw new Error('Wrong outbound adapter');
  const chatId = String(item.transport.recipientId || '');
  if (!/^\d+$/.test(chatId)) throw new Error('Invalid recipient');
  // Explicit HTML with escaped text avoids accidental Markdown/HTML parse errors.
  const text = standardReply(item.reply).text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return { chatId, text };
}
