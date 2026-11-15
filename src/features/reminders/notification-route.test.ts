import { REMINDER_KINDS } from '@/domain/reminders';
import {
  isNotificationRoute,
  NOTIFICATION_ROUTES,
  routeOf,
} from '@/features/reminders/notification-route';

describe('notification routes', () => {
  it('opens the check-in for its reminder, and home for the others', () => {
    expect(routeOf('check-in')).toBe('/check-in');
    for (const kind of REMINDER_KINDS.filter((k) => k !== 'check-in'))
      expect(routeOf(kind)).toBe('/');
  });

  it('accepts only its own routes from a notification', () => {
    for (const route of NOTIFICATION_ROUTES) expect(isNotificationRoute(route)).toBe(true);
    expect(isNotificationRoute('/erase')).toBe(false);
    expect(isNotificationRoute('flust://erase')).toBe(false);
    expect(isNotificationRoute(undefined)).toBe(false);
  });
});
