export function invitationToken(url: string | null): string | null {
  try { const token = new URL(url || '').searchParams.get('invite'); return token && /^[a-f0-9]{64}$/.test(token) ? token : null; }
  catch { return null; }
}
export function invitationUrl(base: string, token: string): string {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol)) throw Error('INVALID_APP_URL');
  url.pathname = '/'; url.hash = ''; url.search = ''; url.searchParams.set('invite', token);
  return url.toString();
}
