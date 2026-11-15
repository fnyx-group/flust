import { MS_PER_MINUTE } from '@/domain/time';
import type { AppActivity } from '@/features/clock/minute-clock';
import {
  createLockController,
  SYSTEM_SCREEN_GRACE_MS,
  type LockControllerDeps,
} from '@/features/lock/lock-controller';

function setUp(settings = { enabled: true, delay: MS_PER_MINUTE }, locked = false) {
  let wall = Date.UTC(2026, 2, 2, 9);
  let mono = 1_000;
  let listener: ((activity: AppActivity) => void) | null = null;
  const deps: LockControllerDeps = {
    now: () => wall,
    monotonicNow: () => mono,
    watchActivity: (next) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };
  const controller = createLockController({ settings, locked }, deps);
  const stop = controller.start();
  return {
    controller,
    stop,
    leave: () => listener?.('background'),
    back: () => listener?.('foreground'),
    pass: (ms: number, wallMs = ms) => {
      mono += ms;
      wall += wallMs;
    },
  };
}

describe('lock controller', () => {
  it('starts locked when the lock is on, and unlocked when it is off', () => {
    expect(setUp(undefined, true).controller.status()).toBe('locked');
    expect(setUp({ enabled: false, delay: 0 }, true).controller.status()).toBe('unlocked');
  });

  it('covers the app as soon as it leaves, and uncovers it within the delay', () => {
    const { controller, leave, back, pass } = setUp();
    leave();
    expect(controller.status()).toBe('covered');
    pass(MS_PER_MINUTE - 1);
    back();
    expect(controller.status()).toBe('unlocked');
  });

  it('locks once the app was away for the delay', () => {
    const { controller, leave, back, pass } = setUp();
    leave();
    pass(MS_PER_MINUTE);
    back();
    expect(controller.status()).toBe('locked');
  });

  it('counts the wall clock when the monotonic one stopped during sleep', () => {
    const { controller, leave, back, pass } = setUp();
    leave();
    pass(0, 10 * MS_PER_MINUTE);
    back();
    expect(controller.status()).toBe('locked');
  });

  it('is not fooled by the wall clock moved back', () => {
    const { controller, leave, back, pass } = setUp();
    leave();
    pass(2 * MS_PER_MINUTE, -MS_PER_MINUTE * 60);
    back();
    expect(controller.status()).toBe('locked');
  });

  it('does not cover or lock for a system screen it opened itself', async () => {
    const { controller, leave, back, pass } = setUp({ enabled: true, delay: 0 });
    await controller.withSystemScreen(async () => {
      leave();
      expect(controller.status()).toBe('unlocked');
      pass(SYSTEM_SCREEN_GRACE_MS - 1);
      back();
    });
    expect(controller.status()).toBe('unlocked');
  });

  it('locks after a system screen kept open past its grace', async () => {
    const { controller, leave, back, pass } = setUp({ enabled: true, delay: 0 });
    await controller.withSystemScreen(async () => {
      leave();
      pass(SYSTEM_SCREEN_GRACE_MS);
      back();
    });
    expect(controller.status()).toBe('locked');
  });

  it('stays locked until unlocked, and tells its listeners', () => {
    const { controller, leave, back } = setUp(undefined, true);
    const listener = jest.fn();
    controller.subscribe(listener);
    leave();
    back();
    expect(controller.status()).toBe('locked');
    controller.unlock();
    expect(controller.status()).toBe('unlocked');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('opens at once when the lock is turned off, and ignores leaving then', () => {
    const { controller, leave, back } = setUp(undefined, true);
    controller.setSettings({ enabled: false, delay: 0 });
    expect(controller.status()).toBe('unlocked');
    leave();
    expect(controller.status()).toBe('unlocked');
    back();
    expect(controller.status()).toBe('unlocked');
  });

  it('stops watching the app once stopped', () => {
    const { controller, stop, leave } = setUp();
    stop();
    leave();
    expect(controller.status()).toBe('unlocked');
  });
});
