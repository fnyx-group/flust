import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { storageService } from '@/data/native';
import type { Storage } from '@/data/open-storage';
import type { ResetStorageError } from '@/data/reset-storage';
import type { Result } from '@/domain/result';
import { ResetScreen } from '@/features/storage/reset-screen';
import { RetryScreen } from '@/features/storage/retry-screen';
import { closeThenShow } from '@/features/storage/close-then-show';
import { eraseAll } from '@/features/storage/erase-all';
import { EraseFailedScreen } from '@/features/storage/erase-failed-screen';
import {
  EraseAllContext,
  StorageContext,
  StorageFailureContext,
} from '@/features/storage/storage-context';
import { failureScreen, type StorageFailure } from '@/features/storage/storage-failure';
import { i18n } from '@/lib/i18n';
import { getDeviceLanguage } from '@/lib/i18n/language';

type GateState =
  | { status: 'opening' }
  | { status: 'ready'; storage: Storage }
  | { status: 'failed'; failure: StorageFailure }
  | { status: 'erase-failed' };

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
    if (state.status === 'failed' || state.status === 'erase-failed') SplashScreen.hideAsync();
  }, [state.status]);

  function retry() {
    setState({ status: 'opening' });
    setAttempt((count) => count + 1);
  }

  function fail(storage: Storage, failure: StorageFailure) {
    void closeThenShow(storage, failure, (shown) => setState({ status: 'failed', failure: shown }));
  }

  async function reset() {
    setState({ status: 'opening' });
    const result = await storageService.reset();
    if (result.ok) setAttempt((count) => count + 1);
    else setState({ status: 'failed', failure: result.error });
  }

  // Every screen goes away first, so none reads storage while it closes. The stored language is
  // erased with the rest, so the app goes back to the device language, which the next launch
  // would choose too, and the welcome screen that follows is the visible confirmation.
  async function erase(close: () => Promise<Result<void, ResetStorageError>>) {
    setState({ status: 'opening' });
    const result = await close();
    if (!result.ok) {
      setState({ status: 'erase-failed' });
      return;
    }
    await i18n.changeLanguage(getDeviceLanguage());
    AccessibilityInfo.announceForAccessibilityWithOptions(i18n.t('erase.done'), { queue: true });
    setAttempt((count) => count + 1);
  }

  if (state.status === 'opening') return null;
  if (state.status === 'ready') {
    const { storage } = state;
    return (
      <StorageContext value={storage}>
        <StorageFailureContext value={(failure) => fail(storage, failure)}>
          <EraseAllContext value={() => void erase(() => eraseAll(storage, storageService))}>
            {children}
          </EraseAllContext>
        </StorageFailureContext>
      </StorageContext>
    );
  }

  if (state.status === 'erase-failed') {
    return <EraseFailedScreen onRetry={() => void erase(() => storageService.reset())} />;
  }

  const screen = failureScreen(state.failure);
  return screen.kind === 'reset' ? (
    <ResetScreen reason={screen.reason} onRetry={retry} onReset={reset} />
  ) : (
    <RetryScreen reason={screen.reason} onRetry={retry} />
  );
}
