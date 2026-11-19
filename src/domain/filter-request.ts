import { isOneOf } from '@/domain/guards';
import { MS_PER_MINUTE, type Timestamp } from '@/domain/time';

// Weakening the filter waits 20 minutes, then asks once more and expires if no one answers within
// 10 minutes (docs/decisions/0040-filter-delay.md). Strengthening it is immediate.
export const FILTER_WAIT_MS = 20 * MS_PER_MINUTE;
export const FILTER_CONFIRM_MS = 10 * MS_PER_MINUTE;

export const FILTER_REQUEST_KINDS = ['filter', 'youtube'] as const;
export type FilterRequestKind = (typeof FILTER_REQUEST_KINDS)[number];
export const isFilterRequestKind = isOneOf(FILTER_REQUEST_KINDS);

// One countdown over the wait and the confirmation window together: the request asks for
// confirmation once only the window is left, and expires at zero.
export type FilterRequest = { readonly kind: FilterRequestKind; readonly leftMs: number };

export type FilterRequestPhase =
  | { readonly phase: 'waiting'; readonly waitMs: number }
  | { readonly phase: 'confirm'; readonly confirmMs: number }
  | { readonly phase: 'expired' };

// Turning the filter off replaces a request about YouTube strict, with a full wait of its own.
export function requestWeakening(kind: FilterRequestKind): FilterRequest {
  return { kind, leftMs: FILTER_WAIT_MS + FILTER_CONFIRM_MS };
}

export function requestPhase(request: FilterRequest): FilterRequestPhase {
  if (request.leftMs <= 0) return { phase: 'expired' };
  if (request.leftMs <= FILTER_CONFIRM_MS) return { phase: 'confirm', confirmMs: request.leftMs };
  return { phase: 'waiting', waitMs: request.leftMs - FILTER_CONFIRM_MS };
}

// Time only ever moves the request forward.
export function elapseRequest(request: FilterRequest, ms: number): FilterRequest {
  return { ...request, leftMs: Math.max(0, request.leftMs - Math.max(0, ms)) };
}

// Where the clocks stood when a request was read or saved. `elapsed` is the phone's elapsed time
// since boot, which sleep does not stop and the date settings do not move; `boot` counts the
// phone's boots, null where the platform does not say.
export type ClockReading = {
  readonly wall: Timestamp;
  readonly elapsed: number;
  readonly boot: number | null;
};

export type SavedFilterRequest = {
  readonly request: FilterRequest;
  readonly at: ClockReading;
};

// The time that passed since the request was saved. Within the same boot, the elapsed clock alone
// counts, so changing the date or restarting the app changes nothing. After a reboot, only the
// time since boot counts: the time the phone was off is never credited. Without a boot count, the
// wall clock counts, and a clock set back gives nothing (docs/decisions/0024-lock-wait.md).
export function timeSinceSaved(saved: ClockReading, now: ClockReading): number {
  if (saved.boot !== null && now.boot !== null) {
    return saved.boot === now.boot ? now.elapsed - saved.elapsed : now.elapsed;
  }
  return now.wall - saved.wall;
}

export function resumeRequest(saved: SavedFilterRequest, now: ClockReading): FilterRequest {
  return elapseRequest(saved.request, timeSinceSaved(saved.at, now));
}
