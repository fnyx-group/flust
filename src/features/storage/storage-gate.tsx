import { useEffect, useState, type ReactNode } from 'react';

import { storageService } from '@/data/native';
import type { Storage } from '@/data/open-storage';
import { useFirstScreenShown, useLaunchErasedNotice } from '@/features/errors/launch-context';
import { recordError } from '@/features/errors/report-error';
import { createAppEraseFlow } from '@/features/storage/app-erase-flow';
import { closeThenShow } from '@/features/storage/close-then-show';
import { EraseFailedScreen } from '@/features/storage/erase-failed-screen';
import type { EraseStep } from '@/features/storage/erase-flow';
import { ErasingScreen } from '@/features/storage/erasing-screen';
import { ResetScreen } from '@/features/storage/reset-screen';
import { RetryScreen } from '@/features/storage/retry-screen';
import {
  EraseAllContext,
  ErasedNoticeContext,
  StorageContext,
  StorageFailureContext,
} from '@/features/storage/storage-context';
import { failureScreen, type StorageFailure } from '@/features/storage/storage-failure';

type GateState =
  | { status: 'opening' }
  | { status: 'ready'; storage: Storage }
  | { status: 'failed'; failure: StorageFailure }
  | { status: 'erasing' }
  | { status: 'erase-failed' };

// Renders its children only once storage is open. The splash screen stays up until then, and
// after that until SessionGate has loaded the first screen; a failure here hides it at once.
export function StorageGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: 'opening' });
  const [attempt, setAttempt] = useState(0);
  const erasedNotice = useLaunchErasedNotice();
  const firstScreenShown = useFirstScreenShown();
  const [eraseFlow] = useState(() =>
    createAppEraseFlow((step: EraseStep) => {
      if (step !== 'erased') {
        setState({ status: step });
        return;
      }
      // The erasing screen stays until storage is open again, so nothing blank shows between.
      erasedNotice.mark();
      setAttempt((count) => count + 1);
    }),
  );

  useEffect(() => {
    let active = true;
    // openStorage turns every error into a Result, so this never rejects.
    void storageService.open().then((result) => {
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

  // A failure screen is a first screen too: the launch went as far as it could.
  useEffect(() => {
    if (state.status === 'failed' || state.status === 'erase-failed') firstScreenShown();
  }, [state.status, firstScreenShown]);

  useEffect(() => {
    if (state.status === 'failed') {
      void recordError(undefined, { kind: 'storage-failure', code: state.failure });
    }
  }, [state]);

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

  if (state.status === 'opening') return null;
  if (state.status === 'ready') {
    const { storage } = state;
    return (
      <StorageContext value={storage}>
        <StorageFailureContext value={(failure) => fail(storage, failure)}>
          <EraseAllContext value={() => void eraseFlow.eraseAll(storage)}>
            <ErasedNoticeContext value={erasedNotice}>{children}</ErasedNoticeContext>
          </EraseAllContext>
        </StorageFailureContext>
      </StorageContext>
    );
  }

  if (state.status === 'erasing') return <ErasingScreen />;
  if (state.status === 'erase-failed') {
    return <EraseFailedScreen onRetry={() => void eraseFlow.eraseWithoutStorage()} />;
  }

  const screen = failureScreen(state.failure);
  return screen.kind === 'reset' ? (
    <ResetScreen reason={screen.reason} onRetry={retry} onReset={() => void reset()} />
  ) : (
    <RetryScreen reason={screen.reason} onRetry={retry} />
  );
}
