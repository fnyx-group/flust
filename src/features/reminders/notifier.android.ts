import { requireNativeModule, type EventSubscription } from 'expo';

import type { Notifier } from '@/features/reminders/notifier-types';
import { isNotificationRoute } from '@/features/reminders/notification-route';

type NativeReminder = {
  id: number;
  body: string;
  route: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  floating: boolean;
  at: number;
};

type FlustReminders = {
  getPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  setChannel(name: string, description: string): void;
  replace(reminders: NativeReminder[]): Promise<void>;
  clearDelivered(): void;
  takeLaunchTap(): string | null;
  addListener(event: 'onTap', listener: (event: { route: string }) => void): EventSubscription;
};

// modules/flust-reminders: AlarmManager and one notification channel, with no Firebase.
const native = requireNativeModule<FlustReminders>('FlustReminders');

export const notifier: Notifier = {
  getPermission: () => native.getPermission(),
  requestPermission: () => native.requestPermission(),
  async describe({ channelName, channelDescription }) {
    native.setChannel(channelName, channelDescription);
  },
  replace: (notifications) =>
    native.replace(
      notifications.map(({ id, body, route, local, floating, at }) => ({
        id,
        body,
        route,
        ...local,
        floating,
        at,
      })),
    ),
  async clearDelivered() {
    native.clearDelivered();
  },
  async takeLaunchTap() {
    const route = native.takeLaunchTap();
    return isNotificationRoute(route) ? route : null;
  },
  onTap(listener) {
    const subscription = native.addListener('onTap', ({ route }) => {
      if (isNotificationRoute(route)) listener(route);
    });
    return () => subscription.remove();
  },
};
