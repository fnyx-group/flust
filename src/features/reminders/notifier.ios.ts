import {
  addNotificationResponseReceivedListener,
  cancelAllScheduledNotificationsAsync,
  clearLastNotificationResponse,
  dismissAllNotificationsAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationCategoryAsync,
  setNotificationHandler,
  type NotificationResponse,
} from 'expo-notifications';

import type { Notifier } from '@/features/reminders/notifier-types';
import {
  isNotificationRoute,
  type NotificationRoute,
} from '@/features/reminders/notification-route';

const CATEGORY = 'reminder';

// The person is already in the app: a reminder arriving now shows nothing.
setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function routeOf(response: NotificationResponse | null): NotificationRoute | null {
  const route = response?.notification.request.content.data?.route;
  return isNotificationRoute(route) ? route : null;
}

export const notifier: Notifier = {
  async getPermission() {
    const { granted, canAskAgain } = await getPermissionsAsync();
    return { granted, canAskAgain: !granted && canAskAgain };
  },
  async requestPermission() {
    const { granted, canAskAgain } = await requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return { granted, canAskAgain: !granted && canAskAgain };
  },
  // iOS has no setting an app can use to hide previews; this text replaces the body when the
  // person has chosen to hide them.
  async describe({ previewPlaceholder }) {
    await setNotificationCategoryAsync(CATEGORY, [], { previewPlaceholder });
  },
  // A calendar trigger without a time zone floats: it keeps its wall time when the zone or the
  // clocks change. A fixed reminder keeps its instant.
  async replace(notifications) {
    await cancelAllScheduledNotificationsAsync();
    for (const { id, body, route, local, floating, at } of notifications) {
      await scheduleNotificationAsync({
        identifier: String(id),
        content: { body, data: { route }, categoryIdentifier: CATEGORY, sound: 'default' },
        trigger: floating
          ? { type: SchedulableTriggerInputTypes.CALENDAR, repeats: false, ...local }
          : { type: SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  },
  clearDelivered: () => dismissAllNotificationsAsync(),
  async takeLaunchTap() {
    const route = routeOf(getLastNotificationResponse());
    clearLastNotificationResponse();
    return route;
  },
  onTap(listener) {
    const subscription = addNotificationResponseReceivedListener((response) => {
      const route = routeOf(response);
      if (route !== null) listener(route);
    });
    return () => subscription.remove();
  },
};
