import { requireOptionalNativeModule } from 'expo';

import type { ElapsedClockDeps } from '@/features/clock/elapsed-clock';
import { nativeElapsedClockDeps } from '@/features/clock/native-clock';

type FlustClock = { elapsedMs(): number };

const native = requireOptionalNativeModule<FlustClock>('FlustClock');

// For waits that moving the phone's date must not shorten, even while the app is away:
// modules/flust-clock reads a clock that keeps running while the phone sleeps. Without it, such
// as on the web, the usual clock and its wall clock fallback are used.
export const continuousClockDeps: ElapsedClockDeps =
  native === null
    ? nativeElapsedClockDeps
    : {
        ...nativeElapsedClockDeps,
        monotonicNow: () => native.elapsedMs(),
        monotonicCountsSleep: true,
      };
