import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import { launchGuard } from '@/data/native';
import type { LaunchMode } from '@/data/launch-guard';
import { LaunchContext } from '@/features/errors/launch-context';
import { SafeModeScreen } from '@/features/errors/safe-mode-screen';
import { createErasedNotice } from '@/features/storage/erase-flow';

type LaunchState = { status: 'checking' } | { status: LaunchMode };

// Counts the launch before storage opens, and opens safe mode after two launches in a row that
// never reached a first screen. The first screen to show, whichever gate draws it, hides the
// splash screen and marks the launch as finished.
export function LaunchGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LaunchState>({ status: 'checking' });
  const [launch] = useState(() => {
    let finished = false;
    return {
      erasedNotice: createErasedNotice(),
      firstScreenShown: () => {
        SplashScreen.hideAsync();
        if (finished) return;
        finished = true;
        void launchGuard.finish();
      },
    };
  });

  useEffect(() => {
    let active = true;
    launchGuard.begin().then((mode) => active && setState({ status: mode }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.status === 'safe-mode') SplashScreen.hideAsync();
  }, [state.status]);

  if (state.status === 'checking') return null;
  if (state.status === 'safe-mode') {
    return (
      <SafeModeScreen
        // Not counted as a new launch: if it fails again, the next launch opens safe mode again.
        onRetry={() => setState({ status: 'normal' })}
        onErased={() => {
          launch.erasedNotice.mark();
          setState({ status: 'normal' });
        }}
      />
    );
  }
  return <LaunchContext value={launch}>{children}</LaunchContext>;
}
