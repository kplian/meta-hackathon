import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  getOidcProvider,
  getOidcProviderLabel,
  isSsoConfigured,
  signInWithDemo,
  signInWithEmail,
  signInWithOidcProvider,
  signInWithSSO,
  signUpWithEmail,
} from '../lib/auth';
import {
  AUTH_CONSTANTS,
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  type SupportedLanguage,
} from '../i18n';

type Mode = 'sign-in' | 'sign-up';
type BusyAction = 'email' | 'oidc' | 'sso' | 'demo' | null;

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  const currentLang = (i18n.language?.slice(0, 2) || 'es') as SupportedLanguage;

  const toMessage = (err: unknown): string =>
    err instanceof Error ? err.message : t(AUTH_CONSTANTS.AUTH_ERROR);

  const run = async (action: Exclude<BusyAction, null>, fn: () => Promise<void>) => {
    setBusy(action);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleEmailSubmit = () =>
    run('email', () => {
      if (!email.trim() || !password) {
        return Promise.reject(new Error(t(AUTH_CONSTANTS.COMPLETE_EMAIL_PASS)));
      }
      return mode === 'sign-in'
        ? signInWithEmail(email, password)
        : signUpWithEmail(email, password);
    });

  const title =
    mode === 'sign-in' ? t(AUTH_CONSTANTS.ENTER_BUTTON) : t(AUTH_CONSTANTS.CREATE_ACCOUNT_BUTTON);

  return (
    <SafeAreaView className="flex-1 bg-mint">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center px-9 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Language Switcher Pill */}
          <View className="mb-4 flex-row justify-center">
            <View className="flex-row rounded-full bg-white/80 p-1 border border-[#D3E8DC]">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = currentLang === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    onPress={() => void changeAppLanguage(lang.code)}
                    className={`rounded-full px-3 py-1 ${active ? 'bg-pine' : ''}`}
                  >
                    <Text
                      className={`text-xs font-extrabold ${
                        active ? 'text-white' : 'text-pine'
                      }`}
                    >
                      {lang.shortLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Brand header */}
          <View className="items-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-deep">
              <MaterialCommunityIcons name="home-heart" size={30} color="#0B3D2E" />
            </View>
            <Text className="mt-4 text-center text-[30px] font-extrabold tracking-tight text-pine">
              {t(AUTH_CONSTANTS.BRAND_TITLE)}
            </Text>
            <Text className="mt-1 px-6 text-center text-[15px] leading-5 text-sage">
              {t(AUTH_CONSTANTS.SUBTITLE)}
            </Text>
          </View>

          {/* Auth card */}
          <View className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <Text className="text-center text-xl font-bold text-slate-900">
              {mode === 'sign-in'
                ? t(AUTH_CONSTANTS.SIGN_IN_TITLE)
                : t(AUTH_CONSTANTS.SIGN_UP_TITLE)}
            </Text>

            <Text className="mb-1.5 mt-5 text-[11px] font-bold tracking-widest text-slate-800">
              {t(AUTH_CONSTANTS.EMAIL_LABEL)}
            </Text>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5">
              <Ionicons name="person" size={18} color="#9AA5A1" />
              <TextInput
                className="ml-2.5 flex-1 py-3.5 text-base text-slate-900"
                placeholder={t(AUTH_CONSTANTS.EMAIL_PLACEHOLDER)}
                placeholderTextColor="#9AA5A1"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType={mode === 'sign-in' ? 'username' : 'emailAddress'}
                editable={busy === null}
              />
            </View>

            <Text className="mb-1.5 mt-4 text-[11px] font-bold tracking-widest text-slate-800">
              {t(AUTH_CONSTANTS.PASSWORD_LABEL)}
            </Text>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5">
              <Ionicons name="lock-closed" size={18} color="#9AA5A1" />
              <TextInput
                className="ml-2.5 flex-1 py-3.5 text-base text-slate-900"
                placeholder={t(AUTH_CONSTANTS.PASSWORD_PLACEHOLDER)}
                placeholderTextColor="#9AA5A1"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={busy === null}
                onSubmitEditing={handleEmailSubmit}
              />
            </View>

            {error ? <Text className="mt-3 text-sm text-red-600">{error}</Text> : null}

            <Pressable
              className="mt-5 flex-row items-center justify-center rounded-full bg-pine py-4 active:bg-pine-dark disabled:opacity-70"
              onPress={handleEmailSubmit}
              disabled={busy !== null}
            >
              {busy === 'email' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="login" size={20} color="#FFFFFF" />
                  <Text className="ml-2 text-base font-semibold text-white">{title}</Text>
                </>
              )}
            </Pressable>

            <View className="my-5 flex-row items-center">
              <View className="h-px flex-1 bg-slate-200" />
              <Text className="mx-3 text-xs text-slate-400">{t(AUTH_CONSTANTS.OR_EMAIL)}</Text>
              <View className="h-px flex-1 bg-slate-200" />
            </View>

            <Pressable
              className="flex-row items-center justify-center rounded-2xl bg-mint py-3.5 active:bg-mint-deep disabled:opacity-70"
              onPress={() => run('oidc', signInWithOidcProvider)}
              disabled={busy !== null}
            >
              {busy === 'oidc' ? (
                <ActivityIndicator color="#0B3D2E" />
              ) : (
                <>
                  <FontAwesome
                    name={getOidcProvider() === 'google' ? 'google' : 'openid'}
                    size={17}
                    color="#0B3D2E"
                  />
                  <Text className="ml-2.5 text-[15px] font-semibold text-pine">
                    {t(AUTH_CONSTANTS.CONTINUE_WITH_PROVIDER)} {getOidcProviderLabel()}
                  </Text>
                </>
              )}
            </Pressable>

            {isSsoConfigured() ? (
              <Pressable
                className="mt-3 flex-row items-center justify-center rounded-2xl bg-mint py-3.5 active:bg-mint-deep disabled:opacity-70"
                onPress={() => run('sso', signInWithSSO)}
                disabled={busy !== null}
              >
                {busy === 'sso' ? (
                  <ActivityIndicator color="#0B3D2E" />
                ) : (
                  <>
                    <Ionicons name="business" size={18} color="#0B3D2E" />
                    <Text className="ml-2 text-[15px] font-semibold text-pine">
                      {t(AUTH_CONSTANTS.CONTINUE_SSO)}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}

            <Pressable
              className="mt-3 flex-row items-center justify-center rounded-2xl bg-mint py-3.5 active:bg-mint-deep disabled:opacity-70"
              onPress={() => run('demo', signInWithDemo)}
              disabled={busy !== null}
            >
              {busy === 'demo' ? (
                <ActivityIndicator color="#0B3D2E" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#F59E0B" />
                  <Text className="ml-2 text-[15px] font-semibold text-pine">
                    {t(AUTH_CONSTANTS.DEMO_MODE_BTN)}
                  </Text>
                </>
              )}
            </Pressable>

            {mode === 'sign-in' ? (
              <Text className="mt-5 text-center text-[13px] text-slate-500">
                {t(AUTH_CONSTANTS.NO_ACCOUNT_YET)}{' '}
                <Text
                  className="font-bold text-slate-800"
                  onPress={() => {
                    setMode('sign-up');
                    setError(null);
                  }}
                >
                  {t(AUTH_CONSTANTS.REGISTER_HERE)}
                </Text>
                {'   '}
                <Text
                  className="font-bold text-slate-800"
                  onPress={() => {
                    setMode('sign-up');
                    setError(null);
                  }}
                >
                  {t(AUTH_CONSTANTS.SIGN_UP_TITLE)}
                </Text>
              </Text>
            ) : (
              <Text className="mt-5 text-center text-[13px] text-slate-500">
                {t(AUTH_CONSTANTS.ALREADY_HAVE_ACCOUNT)}{' '}
                <Text
                  className="font-bold text-slate-800"
                  onPress={() => {
                    setMode('sign-in');
                    setError(null);
                  }}
                >
                  {t(AUTH_CONSTANTS.SIGN_IN_TITLE)}
                </Text>
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
