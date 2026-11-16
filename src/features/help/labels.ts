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

// The detail is part of what is read: the label replaces the row's own texts for screen readers,
// and the detail holds what matters before calling, such as the language or the cost.
export function spokenAction(t: TFunction, entry: HelpEntry, action: HelpAction): string {
  const options = {
    number: spokenNumber(entry.display),
    name: entryName(t, entry),
    detail: entryDetail(t, entry),
  };
  return action === 'call' ? t('help.callSpoken', options) : t('help.textSpoken', options);
}

// Groups joined by no-break spaces, so a number never wraps onto two lines.
export function unbrokenNumber(display: string): string {
  return display.replace(/ /g, '\u00a0');
}

export function textRowLabel(t: TFunction, entry: HelpEntry): string {
  return t('help.textRow', { number: unbrokenNumber(entry.display) });
}

export function actionHint(t: TFunction, action: HelpAction): string {
  return action === 'call' ? t('help.callHint') : t('help.textHint');
}

export function openFailedMessage(t: TFunction, entry: HelpEntry, action: HelpAction): string {
  const options = { number: unbrokenNumber(entry.display) };
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
