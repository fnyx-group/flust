import { createContext, use } from 'react';

// True while the app is locked. Sheets are native windows above the lock cover, so they close
// instead, and come back with their state once the app is unlocked.
export const OverlaysHiddenContext = createContext(false);

export function useOverlaysHidden(): boolean {
  return use(OverlaysHiddenContext);
}
