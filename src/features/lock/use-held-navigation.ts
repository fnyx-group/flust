import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { onReleased, takeHeld } from '@/features/lock/held-navigation';

// Goes where a notification tap asked while the app was locked, once it is unlocked. Only the
// current root takes the route (useCurrentRoot), so one that is unmounting never loses it.
export function useHeldNavigation(isCurrentRoot: () => boolean): void {
  const router = useRouter();
  useEffect(
    () =>
      onReleased(() => {
        if (!isCurrentRoot()) return;
        const route = takeHeld();
        if (route !== null) router.navigate(route);
      }),
    [router, isCurrentRoot],
  );
}
