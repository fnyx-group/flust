import { isOneOf } from '@/domain/guards';
import type { ReminderKind } from '@/domain/reminders';

// The only screens a notification can open. Anything else read back from a notification is
// ignored, so a tap can never be used to reach another route.
export const NOTIFICATION_ROUTES = ['/', '/check-in'] as const;

export type NotificationRoute = (typeof NOTIFICATION_ROUTES)[number];

export const isNotificationRoute = isOneOf(NOTIFICATION_ROUTES);

export function routeOf(kind: ReminderKind): NotificationRoute {
  return kind === 'check-in' ? '/check-in' : '/';
}
