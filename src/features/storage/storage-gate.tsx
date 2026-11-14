import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import { storageService } from '@/data/native';
import type { Storage } from '@/data/open-storage';
import { ResetScreen } from '@/features/storage/reset-screen';
import { RetryScreen } from '@/features/storage/retry-screen';
import { StorageContext, StorageFailureContext } from '@/features/storage/storage-context';
import { failureScreen, type StorageFailure } from '@/features/storage/storage-failure';

type GateState =
  | { status: 'opening' }
  | { status: 'ready'; storage: Storage }
  | { status: 'failed'; failure: StorageFailure };

// Renders its children only once storage is open. The splash screen stays up until then, and
// after that until SessionGate has loaded the first screen; a failure here hides it at once.
export function StorageGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: 'opening' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    storageService.open().then((result) => {
      if (!active) return;
      setState(
        result.ok
          ? { status: 'ready', storage: result.value }
          : { status: 'failed', failure: result.error },
      );
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (state.status === 'failed') SplashScreen.hideAsync();
  }, [state.status]);

  function retry() {
    setState({ status: 'opening' });
    setAttempt((count) => count + 1);
  }

  async function fail(storage: Storage, failure: StorageFailure) {
    await storage.close().catch(() => undefined);
    setState({ status: 'failed', failure });
  }

  async function reset() {
    setState({ status: 'opening' });
    const result = await storageService.reset();
    if (result.ok) setAttempt((count) => count + 1);
    else setState({ status: 'failed', failure: result.error });
  }

  if (state.status === 'opening') return null;
  if (state.status === 'ready') {
    const { storage } = state;
    return (
      <StorageContext value={storage}>
        <StorageFailureContext value={(failure) => void fail(storage, failure)}>
          {children}
        </StorageFailureContext>
      </StorageContext>
    );
  }

  const screen = failureScreen(state.failure);
  return screen.kind === 'reset' ? (
    <ResetScreen reason={screen.reason} onRetry={retry} onReset={reset} />
  ) : (
    <RetryScreen reason={screen.reason} onRetry={retry} />
  );
}
