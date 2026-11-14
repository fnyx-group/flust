import { MS_PER_MINUTE } from '@/domain/time';
import {
  createMinuteClock,
  sameFields,
  selectFromClock,
  type AppActivity,
  type ClockDeps,
} from '@/features/home/minute-clock';

// A streak started 12.5 seconds into a minute.
const ANCHOR = Date.UTC(2026, 0, 1, 8, 0, 12, 500);

type FakeTimer = { at: number; callback: () => void };

// Keeps every pending timer and every activity listener, so that a timer or a listener the clock
// forgets to cancel shows up in the counts instead of being silently replaced.
function fakeDeps(start: number) {
  let time = start;
  const timers = new Set<FakeTimer>();
  const activityListeners = new Set<(activity: AppActivity) => void>();

  const deps: ClockDeps = {
    now: () => time,
    setTimer(callback, ms) {
      const timer = { at: time + ms, callback };
      timers.add(timer);
      return () => timers.delete(timer);
    },
    watchActivity(listener) {
      activityListeners.add(listener);
      return () => activityListeners.delete(listener);
    },
  };

  function nextTimer(): FakeTimer | null {
    let next: FakeTimer | null = null;
    for (const timer of timers) if (next === null || timer.at < next.at) next = timer;
    return next;
  }

  function fire(timer: FakeTimer) {
    timers.delete(timer);
    timer.callback();
  }

  return {
    deps,
    get timerCount() {
      return timers.size;
    },
    get timerAt() {
      return nextTimer()?.at ?? null;
    },
    get watcherCount() {
      return activityListeners.size;
    },
    // Moves the clock forward, firing each timer when its time comes.
    advance(ms: number) {
      const target = time + ms;
      for (let timer = nextTimer(); timer !== null && timer.at <= target; timer = nextTimer()) {
        time = timer.at;
        fire(timer);
      }
      time = target;
    },
    // Fires the pending timer `ms` before its time, as a native timer may do.
    fireEarly(ms: number) {
      const timer = nextTimer();
      if (timer === null) throw new Error('No timer to fire.');
      time = timer.at - ms;
      fire(timer);
    },
    setTime(value: number) {
      time = value;
    },
    activity(activity: AppActivity) {
      for (const listener of activityListeners) listener(activity);
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
    expect(fake.timerCount).toBe(1);
  });

  it('reads the time again on subscribe, as the clock may have been created earlier', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    fake.setTime(ANCHOR + 10 * MS_PER_MINUTE);

    clock.subscribe(jest.fn());
    expect(clock.now()).toBe(ANCHOR + 10 * MS_PER_MINUTE);
  });

  it('catches up on the same minute when a timer fires early', () => {
    const fake = fakeDeps(ANCHOR + 30_000);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    clock.subscribe(jest.fn());

    fake.fireEarly(2);
    expect(clock.now()).toBe(ANCHOR + MS_PER_MINUTE - 2);
    expect(fake.timerAt).toBe(ANCHOR + MS_PER_MINUTE);
    expect(fake.timerCount).toBe(1);

    fake.advance(2);
    expect(clock.now()).toBe(ANCHOR + MS_PER_MINUTE);
    expect(fake.timerAt).toBe(ANCHOR + 2 * MS_PER_MINUTE);
  });

  it('stops in the background and refreshes at once in the foreground', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    const listener = jest.fn();
    clock.subscribe(listener);

    fake.activity('background');
    expect(fake.timerCount).toBe(0);
    expect(fake.watcherCount).toBe(1);

    fake.setTime(ANCHOR + 2 * 60 * MS_PER_MINUTE + 5_000);
    fake.activity('foreground');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(clock.now()).toBe(ANCHOR + 2 * 60 * MS_PER_MINUTE + 5_000);
    expect(fake.timerAt).toBe(ANCHOR + 121 * MS_PER_MINUTE);
    expect(fake.timerCount).toBe(1);
  });

  // On iOS, the app switcher and the notification center pass through 'inactive' and come back to
  // 'active' without a background in between.
  it('keeps a single timer when it comes to the foreground while already running', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    clock.subscribe(jest.fn());

    fake.setTime(ANCHOR + 30_000);
    fake.activity('foreground');
    fake.activity('foreground');
    expect(fake.timerCount).toBe(1);
    expect(fake.timerAt).toBe(ANCHOR + MS_PER_MINUTE);
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
    expect(fake.watcherCount).toBe(1);

    unsubscribeFirst();
    expect(fake.watcherCount).toBe(1);
    expect(fake.timerCount).toBe(1);

    unsubscribeSecond();
    expect(fake.watcherCount).toBe(0);
    expect(fake.timerCount).toBe(0);
  });

  it('starts again after the last listener left while in the background', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    const unsubscribe = clock.subscribe(jest.fn());
    fake.activity('background');
    unsubscribe();
    expect(fake.watcherCount).toBe(0);
    expect(fake.timerCount).toBe(0);

    fake.setTime(ANCHOR + 5 * MS_PER_MINUTE + 1_000);
    const listener = jest.fn();
    clock.subscribe(listener);
    expect(clock.now()).toBe(ANCHOR + 5 * MS_PER_MINUTE + 1_000);
    expect(fake.watcherCount).toBe(1);
    expect(fake.timerCount).toBe(1);

    fake.advance(MS_PER_MINUTE);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('selectFromClock', () => {
  it('keeps the previous value while it is equal, and follows the clock when it changes', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    clock.subscribe(jest.fn());
    const selection = selectFromClock(
      clock,
      (now) => ({ hour: Math.floor((now - ANCHOR) / (60 * MS_PER_MINUTE)) }),
      sameFields,
    );

    const first = selection.getSnapshot();
    expect(selection.getSnapshot()).toBe(first);
    fake.advance(MS_PER_MINUTE);
    expect(selection.getSnapshot()).toBe(first);

    fake.advance(60 * MS_PER_MINUTE);
    expect(selection.getSnapshot()).not.toBe(first);
    expect(selection.getSnapshot()).toEqual({ hour: 1 });
  });

  it('compares by Object.is without an equality check', () => {
    const fake = fakeDeps(ANCHOR);
    const clock = createMinuteClock(ANCHOR, fake.deps);
    clock.subscribe(jest.fn());
    const selection = selectFromClock(clock, (now) => ({ now }));

    const first = selection.getSnapshot();
    expect(selection.getSnapshot()).toBe(first);
    fake.advance(MS_PER_MINUTE);
    expect(selection.getSnapshot()).not.toBe(first);
  });
});

describe('sameFields', () => {
  it('compares the values of each key by Object.is', () => {
    const shared = { id: 'novice' };
    expect(sameFields({ a: 1, rank: shared }, { a: 1, rank: shared })).toBe(true);
    expect(sameFields({ a: 1, rank: shared }, { a: 1, rank: { id: 'novice' } })).toBe(false);
    expect(sameFields({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameFields({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameFields({ a: undefined }, { b: undefined })).toBe(false);
  });
});
