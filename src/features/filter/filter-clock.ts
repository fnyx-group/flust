import type { ClockReading } from '@/domain/filter-request';
import { continuousClockDeps } from '@/features/clock/continuous-clock';
import { flustPrivacy } from '@/features/shared/flust-privacy';

// Where the clocks stand, for the filter delay (docs/decisions/0040-filter-delay.md). The boot
// count comes from modules/flust-privacy on Android; anything else reads as unknown.
export function readFilterClock(): ClockReading {
  return {
    wall: Date.now(),
    elapsed: Math.floor(continuousClockDeps.monotonicNow()),
    boot: readBoot(),
  };
}

function readBoot(): number | null {
  try {
    const boot = flustPrivacy?.bootCount?.();
    return typeof boot === 'number' && Number.isSafeInteger(boot) && boot >= 0 ? boot : null;
  } catch {
    return null;
  }
}
