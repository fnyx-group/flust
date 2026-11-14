import { getLocales } from 'expo-localization';

export const supportedLanguages = ['en', 'fr'] as const;
export type Language = (typeof supportedLanguages)[number];
export const fallbackLanguage: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return (supportedLanguages as readonly unknown[]).includes(value);
}

export function resolveLanguage(languageCode: string | null | undefined): Language {
  const code = languageCode?.toLowerCase();
  return code && isLanguage(code) ? code : fallbackLanguage;
}

export function getDeviceLanguage(): Language {
  return resolveLanguage(getLocales()[0]?.languageCode);
}
