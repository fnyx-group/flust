import type { TFunction } from 'i18next';

import {
  hourAndMinute,
  type MinuteOfDay,
  type ReminderKind,
  type ReminderSettings,
} from '@/domain/reminders';
import type { NotificationLabels } from '@/features/reminders/notifier-types';

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

// Follows the device's 12 or 24 hour setting. The fields are formatted as UTC so the device time
// zone cannot shift them.
export function formatReminderTime(language: string, minute: MinuteOfDay, hour12: boolean): string {
  const time = hourAndMinute(minute);
  return new Intl.DateTimeFormat(language, {
    hour: hour12 ? 'numeric' : '2-digit',
    minute: '2-digit',
    hour12,
    timeZone: 'UTC',
  }).format(Date.UTC(2000, 0, 1, time.hour, time.minute));
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
