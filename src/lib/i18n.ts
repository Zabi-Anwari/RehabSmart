/**
 * i18n bootstrap.
 *
 * Loads en/ru/kk JSON bundles and resolves the initial language from
 * localStorage → browser → 'en'. The Firestore-backed user preference is
 * applied separately by LanguageSwitcher / AuthContext after sign-in.
 *
 * Import this module exactly once (in src/index.tsx) before <App /> renders.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en.json';
import ru from '../locales/ru.json';
import kk from '../locales/kk.json';

export const SUPPORTED_LANGUAGES = ['en', 'ru', 'kk'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, { native: string; english: string }> = {
  en: { native: 'English',    english: 'English' },
  ru: { native: 'Русский',    english: 'Russian' },
  kk: { native: 'Қазақша',    english: 'Kazakh'  },
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      kk: { translation: kk },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'rehab.lang',
    },
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });

export default i18n;

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
