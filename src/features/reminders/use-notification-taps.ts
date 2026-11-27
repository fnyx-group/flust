import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { hold, isLocked } from '@/features/lock/held-navigation';
import type { NotificationRoute } from '@/features/reminders/notification-route';
import { notifier } from '@/features/reminders/notifier';

// A tap opens the screen of its reminder. While the app is locked, it waits for the unlock. Only
// the current root takes a tap (useCurrentRoot), so one that is unmounting never loses it.
export function useNotificationTaps(isCurrentRoot: () => boolean): void {
  const router = useRouter();
  useEffect(() => {
    if (!isCurrentRoot()) return;
    function open(route: NotificationRoute) {
      if (!isCurrentRoot()) return;
      if (isLocked()) hold(route);
      else router.navigate(route);
    }
    void notifier.takeLaunchTap().then((route) => {
      if (route !== null) open(route);
    });
    return notifier.onTap(open);
  }, [router, isCurrentRoot]);
}
