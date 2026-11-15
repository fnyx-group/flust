import { createContext, use } from 'react';

import type { LockSettings } from '@/domain/lock';
import type { DeviceSecurity } from '@/features/lock/local-auth';

export type LockApi = {
  readonly settings: LockSettings;
  readonly security: DeviceSecurity;
  // The lock is on, but the device has no screen lock any more, so it cannot ask.
  readonly paused: boolean;
  // The app is covered or asks to be unlocked: nothing should open or be recorded meanwhile.
  readonly locked: boolean;
  // Applies settings already stored, such as by the end of the onboarding.
  applySettings(settings: LockSettings): void;
  // Reads the device's screen lock again, after the person may have changed it.
  refreshSecurity(): Promise<DeviceSecurity>;
  withSystemScreen<T>(task: () => Promise<T>): Promise<T>;
};

export const LockContext = createContext<LockApi | null>(null);

export function useLock(): LockApi {
  const lock = use(LockContext);
  if (lock === null) throw new Error('useLock must be called below LockGate.');
  return lock;
}
