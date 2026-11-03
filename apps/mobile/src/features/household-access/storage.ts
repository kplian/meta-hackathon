import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { invitationToken, invitationUrl } from './links';
const key = 'household.pendingInvitation';
export async function captureInvitation() {
  const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : await Linking.getInitialURL();
  const token = invitationToken(url ?? null);
  if (token) await AsyncStorage.setItem(key, token);
  return token || await AsyncStorage.getItem(key);
}
export async function pendingInvitationToken() { return AsyncStorage.getItem(key); }
export async function clearInvitation() {
  await AsyncStorage.removeItem(key);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(window.location.href); url.searchParams.delete('invite');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
}
export async function saveInvitationUrl(url: string) {
  const token = invitationToken(url ?? null); if (token) await AsyncStorage.setItem(key, token);
  return token;
}
export function shareableInvitation(token: string) {
  const base = process.env.EXPO_PUBLIC_APP_URL || (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) throw Error('APP_URL_REQUIRED');
  return invitationUrl(base, token);
}
