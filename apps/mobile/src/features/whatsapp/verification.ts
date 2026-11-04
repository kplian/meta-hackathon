export type VerificationLink = { message: string; bot_phone: string; expires_at: string };
export function whatsappLink(link: VerificationLink, web = false) {
  const base = web ? 'https://web.whatsapp.com/send?phone=' : 'https://wa.me/';
  return `${base}${link.bot_phone}${web ? '&' : '?'}text=${encodeURIComponent(link.message)}`;
}
export function linkExpired(link: VerificationLink, now = Date.now()) {
  return !Number.isFinite(Date.parse(link.expires_at)) || Date.parse(link.expires_at) <= now;
}
