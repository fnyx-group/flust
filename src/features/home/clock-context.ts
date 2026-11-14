import { createContext, use, useSyncExternalStore } from 'react';

import type { Timestamp } from '@/domain/time';
import type { MinuteClock } from '@/features/home/minute-clock';

export const ClockContext = createContext<MinuteClock | null>(null);

// Only the components that call this re-render on a tick, and only when the selected value
// changes: a selector returning the local day re-renders once a day.
export function useClock<T>(select: (now: Timestamp) => T): T {
  const clock = use(ClockContext);
  if (clock === null) throw new Error('useClock must be called below ClockContext.');
  return useSyncExternalStore(clock.subscribe, () => select(clock.now()));
}
