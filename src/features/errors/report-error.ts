import { errorLog } from '@/data/native';
import { createErrorRecorder } from '@/features/errors/error-recorder';
import { installGlobalHandlers } from '@/features/errors/global-handlers';

export const recordError = createErrorRecorder(errorLog, Date.now);

type HermesGlobal = {
  HermesInternal?: {
    enablePromiseRejectionTracker?: Parameters<typeof installGlobalHandlers>[0]['rejectionTracker'];
  };
};

const FATAL_WAIT_MS = 1000;

// In development, React Native already tracks rejections to show them as warnings, and taking
// the tracker over would hide them. Release builds track none, so the log takes it there.
export function installErrorHandlers(): void {
  const hermes = (globalThis as HermesGlobal).HermesInternal;
  installGlobalHandlers({
    errorUtils: typeof ErrorUtils === 'undefined' ? undefined : ErrorUtils,
    rejectionTracker: __DEV__ ? undefined : hermes?.enablePromiseRejectionTracker,
    record: recordError,
    waitMs: FATAL_WAIT_MS,
  });
}
