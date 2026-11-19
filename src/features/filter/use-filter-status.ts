import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import type { FilterStatus } from '@/domain/filter-state';
import { filterBridge } from '@/features/filter/filter-native';

const POLL_MS = 2000;

// The filter's status, read again when the screen comes into focus and when flust comes back to
// the foreground, since it changes from the system settings. `poll` also reads it every two
// seconds, for the screen that shows it in full.
export function useFilterStatus({ poll = false }: { poll?: boolean } = {}) {
  const [status, setStatus] = useState<FilterStatus>(() => filterBridge.status());
  const refresh = useCallback(() => setStatus(filterBridge.status()), []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      const timer = poll ? setInterval(refresh, POLL_MS) : null;
      return () => {
        subscription.remove();
        if (timer !== null) clearInterval(timer);
      };
    }, [poll, refresh]),
  );

  return { status, refresh };
}
