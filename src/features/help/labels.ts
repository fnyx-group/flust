import type { TFunction } from 'i18next';

import {
  checkedOnTime,
  type HelpAction,
  type HelpEntry,
  type HelpRegion,
} from '@/domain/help-resources';

export function regionLabel(t: TFunction, region: HelpRegion): string {
  return t(`help.regions.${region}`);
}

export function entryName(t: TFunction, entry: HelpEntry): string {
  return t(`help.entries.${entry.id}.name`);
}

export function entryDetail(t: TFunction, entry: HelpEntry): string {
  return t(`help.entries.${entry.id}.detail`);
}

// Screen readers read "3114" as a quantity, "three thousand one hundred fourteen". Separate
// digits are read one by one, as people dial them.
export function spokenNumber(display: string): string {
  return display.replace(/ /g, '').split('').join(' ');
}

export function spokenAction(t: TFunction, entry: HelpEntry, action: HelpAction): string {
  const options = { number: spokenNumber(entry.display), name: entryName(t, entry) };
  return action === 'call' ? t('help.callSpoken', options) : t('help.textSpoken', options);
}

export function actionHint(t: TFunction, action: HelpAction): string {
  return action === 'call' ? t('help.callHint') : t('help.textHint');
}

export function openFailedMessage(t: TFunction, entry: HelpEntry, action: HelpAction): string {
  const options = { number: entry.display };
  return action === 'call' ? t('help.callFailed', options) : t('help.textFailed', options);
}

// "novembre 2026": the month of a check, YYYY-MM-DD, or null when it cannot be read.
export function checkedMonth(language: string, checkedOn: string | null): string | null {
  const time = checkedOn === null ? null : checkedOnTime(checkedOn);
  if (time === null) return null;
  return new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(time);
}
