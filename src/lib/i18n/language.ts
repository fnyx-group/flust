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

// What the user chose in the settings: a language, or the device's, which follows it.
export const DEVICE_LANGUAGE = 'device';
export type LanguagePreference = Language | typeof DEVICE_LANGUAGE;

// A stored value that is missing or unknown, including the device choice, means the device
// language, so a damaged setting never blocks or confuses startup.
export function toPreference(stored: string | null): LanguagePreference {
  return isLanguage(stored) ? stored : DEVICE_LANGUAGE;
}

export function languageOf(preference: LanguagePreference, deviceLanguage: Language): Language {
  return preference === DEVICE_LANGUAGE ? deviceLanguage : preference;
}
