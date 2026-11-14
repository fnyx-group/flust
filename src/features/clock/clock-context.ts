import { createContext, use, useMemo, useSyncExternalStore } from 'react';

import type { Timestamp } from '@/domain/time';
import { selectFromClock, type TickClock } from '@/features/clock/minute-clock';

export const ClockContext = createContext<TickClock | null>(null);

// Only the components that call this re-render on a tick, and only when the selected value
// changes, by Object.is or by `isEqual`: a selector returning the local day re-renders once a day.
export function useClock<T>(select: (now: Timestamp) => T, isEqual?: (a: T, b: T) => boolean): T {
  const clock = use(ClockContext);
  if (clock === null) throw new Error('useClock must be called below ClockContext.');
  const selection = useMemo(
    () => selectFromClock(clock, select, isEqual),
    [clock, select, isEqual],
  );
  return useSyncExternalStore(selection.subscribe, selection.getSnapshot);
}
