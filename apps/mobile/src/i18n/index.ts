import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { en } from './locales/en';
import { es } from './locales/es';
import { pt } from './locales/pt';

export type SupportedLanguage = 'en' | 'es' | 'pt';

export const LANGUAGE_STORAGE_KEY = '@budget_ai/language';

export const SUPPORTED_LANGUAGES: Array<{ code: SupportedLanguage; label: string; shortLabel: string }> = [
  { code: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'es', label: 'Español', shortLabel: 'ES' },
  { code: 'pt', label: 'Português', shortLabel: 'PT' },
];

const resources = {
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'es',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

// Load persisted language from AsyncStorage on startup
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((savedLang) => {
    if (savedLang && (savedLang === 'en' || savedLang === 'es' || savedLang === 'pt')) {
      i18n.changeLanguage(savedLang);
    }
  })
  .catch(() => {
    // Ignore storage read errors and keep default language
  });

export async function changeAppLanguage(lang: SupportedLanguage) {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage write errors
  }
}

export default i18n;
export * from './constants';

