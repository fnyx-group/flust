import { router } from 'expo-router';
import { useEffect } from 'react';

import { hold, isLocked } from '@/features/lock/held-navigation';
import type { NotificationRoute } from '@/features/reminders/notification-route';
import { notifier } from '@/features/reminders/notifier';

// A tap opens the screen of its reminder. While the app is locked, it waits for the unlock.
export function useNotificationTaps(): void {
  useEffect(() => {
    function open(route: NotificationRoute) {
      if (isLocked()) hold({ kind: 'route', route });
      else router.navigate(route);
    }
    void notifier.takeLaunchTap().then((route) => {
      if (route !== null) open(route);
    });
    return notifier.onTap(open);
  }, []);
}
