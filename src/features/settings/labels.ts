import type { TFunction } from 'i18next';

import { DEVICE_LANGUAGE, type LanguagePreference } from '@/lib/i18n/language';

export const WEBSITE_URL = 'https://fnyx-group.org/flust/';
export const SOURCE_URL = 'https://github.com/fnyx-group/flust';

// Each language is named in itself, so someone who chose the wrong one can still find theirs.
export function languageLabel(t: TFunction, preference: LanguagePreference): string {
  return preference === DEVICE_LANGUAGE
    ? t('settings.deviceLanguage')
    : t(`languages.${preference}`);
}

export function planCountLabel(t: TFunction, count: number): string {
  return t('settings.planCount', { count });
}

// The address as people would type it, shown next to a link so it can be checked before opening.
export function displayUrl(url: string): string {
  return url.replace(/^https:\/\//, '').replace(/\/$/, '');
}
