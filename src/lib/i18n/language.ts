import { getLocales } from 'expo-localization';

export const supportedLanguages = ['en', 'fr'] as const;
export type Language = (typeof supportedLanguages)[number];
export const fallbackLanguage: Language = 'en';

function isSupported(code: string): code is Language {
  return (supportedLanguages as readonly string[]).includes(code);
}

export function resolveLanguage(languageCode: string | null | undefined): Language {
  const code = languageCode?.toLowerCase();
  return code && isSupported(code) ? code : fallbackLanguage;
}

export function getDeviceLanguage(): Language {
  return resolveLanguage(getLocales()[0]?.languageCode);
}
