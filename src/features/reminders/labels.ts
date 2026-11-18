import type { TFunction } from 'i18next';

import { hourRows, minuteRows } from '@/domain/time-wheel';
import {
  hourAndMinute,
  type MinuteOfDay,
  type ReminderKind,
  type ReminderSettings,
} from '@/domain/reminders';
import type { NotificationLabels } from '@/features/reminders/notifier-types';
import { formatClockTime } from '@/features/shared/clock-time';

const NOTIFICATION_TEXT = {
  'check-in': 'reminders.notifications.check-in',
  thought: 'reminders.notifications.thought',
  'risk-hours': 'reminders.notifications.risk-hours',
  rank: 'reminders.notifications.rank',
  return: 'reminders.notifications.return',
} as const satisfies Record<ReminderKind, string>;

// Neutral on purpose: nothing in a notification says what flust is about.
export function notificationText(t: TFunction, kind: ReminderKind): string {
  return t(NOTIFICATION_TEXT[kind]);
}

export function notificationLabels(t: TFunction): NotificationLabels {
  return {
    channelName: t('reminders.notifications.channelName'),
    channelDescription: t('reminders.notifications.channelDescription'),
    previewPlaceholder: t('reminders.notifications.previewPlaceholder'),
  };
}

// Follows the device's 12 or 24 hour setting: "21 h" in French.
export function formatReminderTime(language: string, minute: MinuteOfDay, hour12: boolean): string {
  const time = hourAndMinute(minute);
  return formatClockTime(language, time.hour, time.minute, hour12);
}

// The value of the settings row: the evening check-in's time, else the morning thought's, else
// nothing when another reminder is on, and "Off" when none is.
export function remindersValue(
  t: TFunction,
  settings: ReminderSettings,
  language: string,
  hour12: boolean,
): string | undefined {
  if (settings.checkIn.on) return formatReminderTime(language, settings.checkIn.minute, hour12);
  if (settings.thought.on) return formatReminderTime(language, settings.thought.minute, hour12);
  if (settings.riskHours || settings.ranks) return undefined;
  return t('reminders.off');
}

export type WheelRowLabels = {
  readonly hours: readonly string[];
  readonly minutes: readonly string[];
  readonly periods: readonly [string, string];
};

// The rows of the time wheels: hours on two digits on a 24 hour clock, as the app shows times,
// minutes on two digits, and the language's own names for the morning and afternoon periods.
export function wheelRowLabels(language: string, hour12: boolean): WheelRowLabels {
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  return {
    hours: hourRows(hour12).map((hour) => (hour12 ? String(hour) : twoDigits(hour))),
    minutes: minuteRows().map(twoDigits),
    periods: [periodName(language, 9), periodName(language, 21)],
  };
}

function periodName(language: string, hour: number): string {
  const parts = new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  }).formatToParts(Date.UTC(2000, 0, 1, hour));
  return parts.find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM');
}
