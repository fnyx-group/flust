import { createContext, use } from 'react';

import type { LaunchSession } from '@/features/errors/launch-session';
import type { ErasedNotice } from '@/features/storage/erase-flow';

type Launch = Pick<LaunchSession, 'firstScreenShown' | 'erasedNotice'>;

export const LaunchContext = createContext<Launch | null>(null);

function useLaunch(): Launch {
  const launch = use(LaunchContext);
  if (launch === null) throw new Error('useLaunch must be called below LaunchGate.');
  return launch;
}

export function useFirstScreenShown(): () => void {
  return useLaunch().firstScreenShown;
}

// Shared by StorageGate and safe mode, which can both erase everything before the welcome screen.
export function useLaunchErasedNotice(): ErasedNotice {
  return useLaunch().erasedNotice;
}
