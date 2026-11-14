import { AppState } from 'react-native';

import type { ClockDeps } from '@/features/home/minute-clock';

// 'inactive' is skipped: on iOS it covers the notification center and the app switcher, where
// the screen is still partly visible.
export const nativeClockDeps: ClockDeps = {
  now: () => Date.now(),
  setTimer(callback, ms) {
    const id = setTimeout(callback, ms);
    return () => clearTimeout(id);
  },
  watchActivity(listener) {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') listener('foreground');
      if (state === 'background') listener('background');
    });
    return () => subscription.remove();
  },
};
