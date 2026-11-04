export type VerificationLink = { message: string; bot_phone: string; expires_at: string };

export const DEFAULT_BOT_PHONE = process.env.EXPO_PUBLIC_WHATSAPP_BOT_PHONE || '59144660408';

export function whatsappLink(link: VerificationLink, web = false) {
  const base = web ? 'https://web.whatsapp.com/send?phone=' : 'https://wa.me/';
  return `${base}${link.bot_phone}${web ? '&' : '?'}text=${encodeURIComponent(link.message)}`;
}

export function linkExpired(link: VerificationLink, now = Date.now()) {
  return !Number.isFinite(Date.parse(link.expires_at)) || Date.parse(link.expires_at) <= now;
}

export function getWhatsAppChatUrl(
  message: string = 'Hola ArkAI, quiero consultar mi presupuesto',
  botPhone: string = DEFAULT_BOT_PHONE,
  web: boolean = false
) {
  const cleanPhone = botPhone.replace(/[^0-9]/g, '');
  const base = web ? 'https://web.whatsapp.com/send?phone=' : 'https://wa.me/';
  return `${base}${cleanPhone}${web ? '&' : '?'}text=${encodeURIComponent(message)}`;
}
