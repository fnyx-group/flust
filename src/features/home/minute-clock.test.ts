import { MS_PER_MINUTE } from '@/domain/time';
import { createMinuteClock, type AppActivity, type ClockDeps } from '@/features/home/minute-clock';

// A streak started 12.5 seconds into a minute.
const ANCHOR = Date.UTC(2026, 0, 1, 8, 0, 12, 500);

function fakeDeps(start: number) {
  let time = start;
  let timer: { at: number; callback: () => void } | null = null;
  let activityListener: ((activity: AppActivity) => void) | null = null;

  const deps: ClockDeps = {
    now: () => time,
    setTimer(callback, ms) {
      const scheduled = { at: time + ms, callback };
      timer = scheduled;
      return () => {
        if (timer === scheduled) timer = null;
      };
    },
    watchActivity(listener) {
      activityListener = listener;
      return () => {
        activityListener = null;
      };
    },
  };

  return {
    deps,
    get timerAt() {
      return timer?.at ?? null;
    },
    get watching() {
      return activityListener !== null;
    },
    // Moves the clock forward, firing the timer when its time comes.
    advance(ms: number) {
      const target = time + ms;
      while (timer !== null && timer.at <= target) {
        const { at, callback } = timer;
        timer = null;
        time = at;
        callback();
      }
      time = target;
    },
    setTime(value: number) {
      time = value;
    },
    activity(activity: AppActivity) {
      activityListener?.(activity);
    },
  };
}

describe('createMinuteClock', () => {
  it('ticks when a minute of the streak completes, not on the wall clock minute', () => {
    const fake = fakeDeps(ANCHOR + 40_000);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    const listener = jest.fn();
    clock.subscribe(listener);

    expect(fake.timerAt).toBe(ANCHOR + MS_PER_MINUTE);
    fake.advance(20_000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(clock.now()).toBe(ANCHOR + MS_PER_MINUTE);

    fake.advance(3 * MS_PER_MINUTE);
    expect(listener).toHaveBeenCalledTimes(4);
    expect(fake.timerAt).toBe(ANCHOR + 5 * MS_PER_MINUTE);
  });

  it('reads the time again on subscribe, as the clock may have been created earlier', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    fake.setTime(ANCHOR + 10 * MS_PER_MINUTE);

    clock.subscribe(jest.fn());
    expect(clock.now()).toBe(ANCHOR + 10 * MS_PER_MINUTE);
  });

  it('stops in the background and refreshes at once in the foreground', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    const listener = jest.fn();
    clock.subscribe(listener);

    fake.activity('background');
    expect(fake.timerAt).toBeNull();

    fake.setTime(ANCHOR + 2 * 60 * MS_PER_MINUTE + 5_000);
    fake.activity('foreground');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(clock.now()).toBe(ANCHOR + 2 * 60 * MS_PER_MINUTE + 5_000);
    expect(fake.timerAt).toBe(ANCHOR + 121 * MS_PER_MINUTE);
  });

  it('reschedules from the new time when the clock was moved back', () => {
    const fake = fakeDeps(ANCHOR + 10 * MS_PER_MINUTE);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    clock.subscribe(jest.fn());

    fake.setTime(ANCHOR + 30_000);
    fake.activity('foreground');
    expect(clock.now()).toBe(ANCHOR + 30_000);
    expect(fake.timerAt).toBe(ANCHOR + MS_PER_MINUTE);
  });

  it('stops the timer and the app state watch when the last listener leaves', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    const unsubscribeFirst = clock.subscribe(jest.fn());
    const unsubscribeSecond = clock.subscribe(jest.fn());

    unsubscribeFirst();
    expect(fake.watching).toBe(true);
    expect(fake.timerAt).not.toBeNull();

    unsubscribeSecond();
    expect(fake.watching).toBe(false);
    expect(fake.timerAt).toBeNull();
  });
});
