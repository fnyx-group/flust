import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { onReleased, takeHeld } from '@/features/lock/held-navigation';

// Goes where a link or a notification tap asked while the app was locked, once it is unlocked.
export function useHeldNavigation(): void {
  useEffect(
    () =>
      onReleased(() => {
        const held = takeHeld();
        if (held === null) return;
        router.navigate((held.kind === 'link' ? held.url : held.route) as Href);
      }),
    [],
  );
}
