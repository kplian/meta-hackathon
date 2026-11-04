import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { changePassword, signOut } from '../../lib/auth';
import PasswordField from './PasswordField';
import { authErrorKey, passwordValidation } from './protocol';
import './i18n';
export default function ResetPasswordScreen({ onDone }: { onDone: () => Promise<void> }) {
  const { t } = useTranslation('authFlow');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save() {
    const invalid = passwordValidation(password, confirmation); if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    try { await changePassword(password); setPassword(''); setConfirmation(''); await onDone(); }
    catch (error) { setError(authErrorKey(error)); } finally { setBusy(false); }
  }
  return <SafeAreaView className="flex-1 bg-mint"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow justify-center p-5"><View className="w-full max-w-lg self-center rounded-2xl bg-white p-6 gap-4">
    <Text className="text-xl font-bold text-pine">{t('newPassword')}</Text><Text className="text-sage">{t('recoveryHelp')}</Text>
    <PasswordField value={password} onChangeText={setPassword} label={t('newPassword')} disabled={busy} newPassword />
    <Text className="text-sm text-sage">{t('passwordHint')}</Text>
    <PasswordField value={confirmation} onChangeText={setConfirmation} label={t('repeatPassword')} disabled={busy} newPassword onSubmit={() => void save()} />
    {error ? <Text accessibilityRole="alert" className="text-red-700">{t(error)}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} className="rounded-xl bg-pine p-3">{busy ? <ActivityIndicator color="white" /> : <Text className="text-center font-bold text-white">{t('savePassword')}</Text>}</Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void signOut().catch(error => setError(authErrorKey(error))); }} className="p-3"><Text className="text-center text-sage">{t('signOut')}</Text></Pressable>
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
