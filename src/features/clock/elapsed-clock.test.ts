import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from '@/domain/time';
import { createElapsedClock, type ElapsedClockDeps } from '@/features/clock/elapsed-clock';
import type { AppActivity } from '@/features/clock/minute-clock';

const WALL = Date.UTC(2026, 0, 1, 22);

type FakeTimer = { at: number; callback: () => void };

// The wall clock and the monotonic clock move together unless a test moves one alone, as setting
// the phone's time or a sleeping phone would.
function fakeDeps() {
  let wall = WALL;
  let monotonic = 5_000;
  const timers = new Set<FakeTimer>();
  const listeners = new Set<(activity: AppActivity) => void>();

  const deps: ElapsedClockDeps = {
    now: () => wall,
    monotonicNow: () => monotonic,
    setTimer(callback, ms) {
      const timer = { at: monotonic + ms, callback };
      timers.add(timer);
      return () => timers.delete(timer);
    },
    watchActivity(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function nextTimer(): FakeTimer | null {
    let next: FakeTimer | null = null;
    for (const timer of timers) if (next === null || timer.at < next.at) next = timer;
    return next;
  }

  return {
    deps,
    advance(ms: number) {
      const target = monotonic + ms;
      for (let timer = nextTimer(); timer !== null && timer.at <= target; timer = nextTimer()) {
        wall += timer.at - monotonic;
        monotonic = timer.at;
        timers.delete(timer);
        timer.callback();
      }
      wall += target - monotonic;
      monotonic = target;
    },
    moveWall(ms: number) {
      wall += ms;
    },
    // Time passes in the background: the timers are stopped, and the monotonic clock may pause.
    sleep(ms: number, monotonicMs: number) {
      wall += ms;
      monotonic += monotonicMs;
    },
    activity(activity: AppActivity) {
      for (const listener of listeners) listener(activity);
    },
  };
}

function setUp() {
  const fake = fakeDeps();
  const clock = createElapsedClock(fake.deps);
  const listener = jest.fn();
  clock.subscribe(listener);
  return { fake, clock, listener };
}

describe('createElapsedClock', () => {
  it('starts at zero and ticks on each whole second elapsed', () => {
    const { fake, clock, listener } = setUp();
    expect(clock.now()).toBe(0);

    fake.advance(3 * MS_PER_SECOND);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(clock.now()).toBe(3 * MS_PER_SECOND);
  });

  it('keeps counting when the clock is moved back in the foreground', () => {
    const { fake, clock } = setUp();
    fake.advance(10 * MS_PER_SECOND);
    fake.moveWall(-MS_PER_HOUR);

    fake.advance(5 * MS_PER_SECOND);
    expect(clock.now()).toBe(15 * MS_PER_SECOND);
  });

  it('does not skip when the clock is moved forward in the foreground', () => {
    const { fake, clock } = setUp();
    fake.moveWall(MS_PER_HOUR);

    fake.advance(2 * MS_PER_SECOND);
    expect(clock.now()).toBe(2 * MS_PER_SECOND);
  });

  it('counts the time spent in the background while the phone slept', () => {
    const { fake, clock, listener } = setUp();
    fake.advance(MS_PER_MINUTE);
    fake.activity('background');

    fake.sleep(5 * MS_PER_MINUTE, 0);
    fake.activity('foreground');
    expect(clock.now()).toBe(6 * MS_PER_MINUTE);
    expect(listener).toHaveBeenCalledTimes(61);
  });

  it('counts the monotonic time when the clock was moved back in the background', () => {
    const { fake, clock } = setUp();
    fake.advance(MS_PER_MINUTE);
    fake.activity('background');

    fake.sleep(-MS_PER_HOUR, 2 * MS_PER_MINUTE);
    fake.activity('foreground');
    expect(clock.now()).toBe(3 * MS_PER_MINUTE);
  });

  // On iOS, the app switcher passes through 'inactive' and comes back to 'active' without a
  // background in between: a clock moved meanwhile is not counted.
  it('ignores the wall clock on a return to the foreground without a background', () => {
    const { fake, clock } = setUp();
    fake.advance(MS_PER_MINUTE);
    fake.moveWall(MS_PER_HOUR);

    fake.activity('foreground');
    expect(clock.now()).toBe(MS_PER_MINUTE);
  });
});
