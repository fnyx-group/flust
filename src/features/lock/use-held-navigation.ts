import { router } from 'expo-router';
import { useEffect } from 'react';

import { onReleased, takeHeld } from '@/features/lock/held-navigation';

// Goes where a notification tap asked while the app was locked, once it is unlocked.
export function useHeldNavigation(): void {
  useEffect(
    () =>
      onReleased(() => {
        const route = takeHeld();
        if (route !== null) router.navigate(route);
      }),
    [],
  );
}
