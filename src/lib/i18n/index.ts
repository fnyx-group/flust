import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { fallbackLanguage, getDeviceLanguage, supportedLanguages, type Language } from './language';
import en from './locales/en.json';
import fr from './locales/fr.json';
import { ensurePluralRules } from './plural-rules';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

export function createI18n(language: Language) {
  ensurePluralRules();
  const instance = createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: fallbackLanguage,
    supportedLngs: supportedLanguages,
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}

export const i18n = createI18n(getDeviceLanguage());
