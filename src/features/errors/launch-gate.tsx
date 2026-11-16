import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import { launchGuard } from '@/data/native';
import type { LaunchMode } from '@/data/launch-guard';
import { LaunchContext } from '@/features/errors/launch-context';
import { createLaunchSession } from '@/features/errors/launch-session';
import { SafeModeScreen } from '@/features/errors/safe-mode-screen';
import { createErasedNotice } from '@/features/storage/erase-flow';

type LaunchState = { status: 'checking' } | { status: LaunchMode };

// Counts the launch before storage opens, and opens safe mode after two launches in a row that
// never reached a first screen. The first screen to show, whichever gate draws it, hides the
// splash screen and marks the launch as finished.
export function LaunchGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LaunchState>({ status: 'checking' });
  const [launch] = useState(() =>
    createLaunchSession({
      guard: launchGuard,
      hideSplash: () => void SplashScreen.hideAsync(),
      erasedNotice: createErasedNotice(),
    }),
  );

  useEffect(() => {
    let active = true;
    launch.begin().then((mode) => active && setState({ status: mode }));
    return () => {
      active = false;
    };
  }, [launch]);

  useEffect(() => {
    if (state.status === 'safe-mode') SplashScreen.hideAsync();
  }, [state.status]);

  if (state.status === 'checking') return null;
  if (state.status === 'safe-mode') {
    return (
      <SafeModeScreen
        onRetry={() => setState({ status: 'normal' })}
        onErased={() => setState({ status: launch.erasedFromSafeMode() })}
      />
    );
  }
  return <LaunchContext value={launch}>{children}</LaunchContext>;
}
