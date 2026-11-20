import {
  elapseRequest,
  FILTER_CONFIRM_MS,
  FILTER_WAIT_MS,
  requestPhase,
  requestWeakening,
  resumeRequest,
  timeSinceSaved,
  type ClockReading,
} from '@/domain/filter-request';
import { MS_PER_MINUTE } from '@/domain/time';

const SAVED: ClockReading = {
  wall: Date.UTC(2026, 10, 19, 21),
  elapsed: 50 * MS_PER_MINUTE,
  boot: 7,
};

describe('a request to weaken the filter', () => {
  it('waits 20 minutes, then asks for 10 minutes, then expires', () => {
    const request = requestWeakening('filter');

    expect(requestPhase(request)).toEqual({ phase: 'waiting', waitMs: FILTER_WAIT_MS });
    expect(requestPhase(elapseRequest(request, FILTER_WAIT_MS - 1))).toEqual({
      phase: 'waiting',
      waitMs: 1,
    });
    expect(requestPhase(elapseRequest(request, FILTER_WAIT_MS))).toEqual({
      phase: 'confirm',
      confirmMs: FILTER_CONFIRM_MS,
    });
    expect(requestPhase(elapseRequest(request, FILTER_WAIT_MS + FILTER_CONFIRM_MS))).toEqual({
      phase: 'expired',
    });
  });

  it('keeps what it is about', () => {
    expect(requestWeakening('youtube').kind).toBe('youtube');
  });

  it('never goes back in time', () => {
    const request = requestWeakening('filter');

    expect(elapseRequest(request, -MS_PER_MINUTE)).toEqual(request);
    expect(elapseRequest(request, 3 * FILTER_WAIT_MS).leftMs).toBe(0);
  });
});

describe('the time since a request was saved', () => {
  it('follows the elapsed clock within the same boot, whatever the date says', () => {
    const now = {
      wall: SAVED.wall - 60 * MS_PER_MINUTE,
      elapsed: SAVED.elapsed + 3 * MS_PER_MINUTE,
      boot: 7,
    };

    expect(timeSinceSaved(SAVED, now)).toBe(3 * MS_PER_MINUTE);
    expect(timeSinceSaved(SAVED, { ...now, wall: SAVED.wall + 600 * MS_PER_MINUTE })).toBe(
      3 * MS_PER_MINUTE,
    );
  });

  it('counts only the time since boot after a reboot, even with the clock moved forward', () => {
    const now = { wall: SAVED.wall + 600 * MS_PER_MINUTE, elapsed: 2 * MS_PER_MINUTE, boot: 8 };

    expect(timeSinceSaved(SAVED, now)).toBe(2 * MS_PER_MINUTE);
  });

  // A userspace reboot restarts Android and counts a new boot, but the kernel keeps its clock.
  it('counts only the wall time after a reboot that kept the elapsed clock running', () => {
    const now = {
      wall: SAVED.wall + 3 * MS_PER_MINUTE,
      elapsed: SAVED.elapsed + 3 * MS_PER_MINUTE,
      boot: 8,
    };

    expect(timeSinceSaved(SAVED, now)).toBe(3 * MS_PER_MINUTE);
    expect(timeSinceSaved(SAVED, { ...now, elapsed: 3 * 24 * 60 * MS_PER_MINUTE })).toBe(
      3 * MS_PER_MINUTE,
    );
  });

  it('credits nothing after a reboot with the clock set back', () => {
    const now = { wall: SAVED.wall - 60 * MS_PER_MINUTE, elapsed: 2 * MS_PER_MINUTE, boot: 8 };

    expect(timeSinceSaved(SAVED, now)).toBe(0);
  });

  it('falls back to the wall clock without a boot count', () => {
    const saved = { ...SAVED, boot: null };

    expect(
      timeSinceSaved(saved, { wall: SAVED.wall + MS_PER_MINUTE, elapsed: 0, boot: null }),
    ).toBe(MS_PER_MINUTE);
  });

  it('resumes a request with that time taken off, and a clock set back gives nothing', () => {
    const saved = { request: requestWeakening('youtube'), at: { ...SAVED, boot: null } };

    expect(
      resumeRequest(saved, { wall: SAVED.wall + 5 * MS_PER_MINUTE, elapsed: 0, boot: null }),
    ).toEqual({ kind: 'youtube', leftMs: FILTER_WAIT_MS + FILTER_CONFIRM_MS - 5 * MS_PER_MINUTE });
    expect(
      resumeRequest(saved, { wall: SAVED.wall - 5 * MS_PER_MINUTE, elapsed: 0, boot: null }),
    ).toEqual(saved.request);
  });
});
