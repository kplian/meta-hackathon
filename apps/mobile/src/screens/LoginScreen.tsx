import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getOidcProvider, getOidcProviderLabel, isSsoConfigured, signInWithDemo, signInWithEmail, signInWithOidcProvider, signInWithSSO, signUpWithEmail, resendConfirmation, requestPasswordReset, getAuthRedirectUri } from '../lib/auth';
import { AUTH_CONSTANTS, SUPPORTED_LANGUAGES, changeAppLanguage, type SupportedLanguage } from '../i18n';
import PasswordField from '../features/auth-session/PasswordField';
import { authErrorKey, passwordValidation, validateEmail } from '../features/auth-session/protocol';
import '../features/auth-session/i18n';
type Mode = 'sign-in' | 'sign-up' | 'recovery';
export default function LoginScreen({ invited = false, callbackError = '', onClearError }: { invited?: boolean; callbackError?: string; onClearError?: () => void }) {
  const { t } = useTranslation(); const { t: flowT, i18n } = useTranslation('authFlow');
  const [mode, setMode] = useState<Mode>(invited ? 'sign-up' : 'sign-in');
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState(''); const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resendAt, setResendAt] = useState(0); const [now, setNow] = useState(Date.now);
  const currentLang = (i18n.language?.slice(0, 2) || 'es') as SupportedLanguage;
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(getAuthRedirectUri());
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => { if (!confirmationEmail) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [confirmationEmail]);
  function changeMode(next: Mode) { setMode(next); setError(''); setPassword(''); setConfirmation(''); setConfirmationEmail(''); setRecoveryEmail(''); onClearError?.(); }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); onClearError?.();
    try { await action(); } catch (error) { const key = authErrorKey(error); setError(key); if (key === 'emailUnconfirmed') { setConfirmationEmail(email.trim().toLowerCase()); setPassword(''); setConfirmation(''); } }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!validateEmail(email)) { setError('invalidEmail'); return; }
    if (mode !== 'recovery' && !password) { setError('missingPassword'); return; }
    if (mode === 'sign-up') { const invalid = passwordValidation(password, confirmation); if (invalid) { setError(invalid); return; } }
    await run(async () => {
      if (mode === 'sign-in') await signInWithEmail(email, password);
      else if (mode === 'recovery') { await requestPasswordReset(email); setRecoveryEmail(email.trim().toLowerCase()); }
      else {
        const needsConfirmation = await signUpWithEmail(email, password, name);
        setPassword(''); setConfirmation('');
        if (needsConfirmation) { setConfirmationEmail(email.trim().toLowerCase()); setResendAt(Date.now() + 60000); setNow(Date.now()); }
      }
    });
  }
  return <SafeAreaView className="flex-1 bg-mint"><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow justify-center p-5 py-8">
      <View className="w-full max-w-lg self-center gap-4">
        <View className="flex-row justify-center gap-2">{SUPPORTED_LANGUAGES.map(lang => <Pressable accessibilityRole="button" key={lang.code} onPress={() => void changeAppLanguage(lang.code)} className={`rounded-full px-3 py-2 ${currentLang === lang.code ? 'bg-pine' : 'bg-white'}`}><Text className={currentLang === lang.code ? 'text-white' : 'text-pine'}>{lang.shortLabel}</Text></Pressable>)}</View>
        <View className="items-center gap-2"><Image source={require('../../assets/logo.png')} style={{ width: 140, height: 184 }} resizeMode="contain" accessibilityLabel={t(AUTH_CONSTANTS.BRAND_TITLE)} /><Text className="text-center text-sage">{t(AUTH_CONSTANTS.SUBTITLE)}</Text></View>
        {invited ? <Text className="rounded-xl bg-white p-4 text-pine">{flowT('invited')}</Text> : null}
        <View className="rounded-2xl bg-white p-6 gap-4">
          {confirmationEmail ? <>
            <Text className="text-xl font-bold text-pine">{flowT('checkEmail')}</Text><Text className="text-pine">{flowT('confirmationSent', { email: confirmationEmail })}</Text><Text className="text-sm text-sage">{flowT('confirmationHelp')}</Text>{isLoopback ? <Text className="text-sm text-sage">{flowT('localConfirmation')}</Text> : null}
            <Pressable accessibilityRole="button" disabled={busy || wait > 0} onPress={() => void run(async () => { await resendConfirmation(confirmationEmail); setResendAt(Date.now() + 60000); setNow(Date.now()); })} className={`rounded-xl bg-pine p-3 ${busy || wait > 0 ? 'opacity-50' : ''}`}><Text className="text-center font-bold text-white">{flowT(wait > 0 ? 'resendIn' : 'resend', { seconds: wait })}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode('sign-in')} className="p-3"><Text className="text-center font-semibold text-pine">{flowT('alreadyConfirmed')}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode('sign-up')} className="p-2"><Text className="text-center text-sage">{flowT('differentEmail')}</Text></Pressable>
          </> : recoveryEmail ? <>
            <Text className="text-xl font-bold text-pine">{flowT('checkEmail')}</Text><Text className="text-pine">{flowT('recoverySent', { email: recoveryEmail })}</Text>
            <Pressable accessibilityRole="button" onPress={() => changeMode('sign-in')} className="rounded-xl bg-pine p-3"><Text className="text-center font-bold text-white">{flowT('backSignIn')}</Text></Pressable>
          </> : <>
            {mode === 'recovery' ? <Text className="text-xl font-bold text-pine">{flowT('recover')}</Text> : <View className="flex-row gap-2">{(['sign-up','sign-in'] as const).map(value => <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === value }} disabled={busy} key={value} onPress={() => changeMode(value)} className={`flex-1 rounded-xl p-3 ${mode === value ? 'bg-pine' : 'bg-mint'}`}><Text className={`text-center font-bold ${mode === value ? 'text-white' : 'text-pine'}`}>{flowT(value === 'sign-up' ? 'signUp' : 'signIn')}</Text></Pressable>)}</View>}
            {mode === 'sign-up' ? <><Text className="font-semibold text-pine">{flowT('name')}</Text><TextInput accessibilityLabel={flowT('name')} value={name} onChangeText={setName} maxLength={100} autoCapitalize="words" editable={!busy} className="rounded-xl border border-[#D3E8DC] p-3 text-pine" /></> : null}
            <Text className="font-semibold text-pine">{flowT('email')}</Text><TextInput accessibilityLabel={flowT('email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!busy} className="rounded-xl border border-[#D3E8DC] p-3 text-pine" onSubmitEditing={mode === 'recovery' ? () => void submit() : undefined} />
            {mode !== 'recovery' ? <>
              <Text className="font-semibold text-pine">{flowT('password')}</Text><PasswordField value={password} onChangeText={setPassword} label={flowT('password')} disabled={busy} newPassword={mode === 'sign-up'} onSubmit={mode === 'sign-in' ? () => void submit() : undefined} />
              {mode === 'sign-up' ? <><Text className="text-sm text-sage">{flowT('passwordHint')}</Text><Text className="font-semibold text-pine">{flowT('repeatPassword')}</Text><PasswordField value={confirmation} onChangeText={setConfirmation} label={flowT('repeatPassword')} disabled={busy} newPassword onSubmit={() => void submit()} /></> : <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode('recovery')} className="self-end py-2"><Text className="font-semibold text-pine">{flowT('forgotPassword')}</Text></Pressable>}
            </> : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} className={`rounded-xl bg-pine p-4 ${busy ? 'opacity-50' : ''}`}>{busy ? <ActivityIndicator color="white" /> : <Text className="text-center font-bold text-white">{flowT(mode === 'sign-up' ? 'signUp' : mode === 'sign-in' ? 'signIn' : 'sendRecovery')}</Text>}</Pressable>
            {mode === 'recovery' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode('sign-in')} className="p-3"><Text className="text-center text-pine">{flowT('backSignIn')}</Text></Pressable> : <>
              <Text className="text-center text-xs text-sage">{t(AUTH_CONSTANTS.OR_EMAIL)}</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(signInWithOidcProvider)} className="flex-row items-center justify-center gap-2 rounded-xl bg-mint p-3"><FontAwesome name={getOidcProvider() === 'google' ? 'google' : 'openid'} size={17} color="#0B3D2E" /><Text className="font-semibold text-pine">{t(AUTH_CONSTANTS.CONTINUE_WITH_PROVIDER)} {getOidcProviderLabel()}</Text></Pressable>
              {isSsoConfigured() ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(signInWithSSO)} className="p-3"><Text className="text-center text-pine">{t(AUTH_CONSTANTS.CONTINUE_SSO)}</Text></Pressable> : null}
              {process.env.EXPO_PUBLIC_DEMO_EMAIL ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(signInWithDemo)} className="p-2"><Text className="text-center text-sage">{t(AUTH_CONSTANTS.DEMO_MODE_BTN)}</Text></Pressable> : null}
            </>}
          </>}
          {error || callbackError ? <Text accessibilityRole="alert" className="text-sm text-red-700">{flowT(error || callbackError)}</Text> : null}
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
