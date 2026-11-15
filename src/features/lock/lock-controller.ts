import { shouldRelock, timeAway, type LockSettings } from '@/domain/lock';
import { MS_PER_MINUTE, type Timestamp } from '@/domain/time';
import type { AppActivity } from '@/features/clock/minute-clock';

// 'covered' hides the app as soon as it leaves the foreground, so no frame of content can show
// on return before the decision to ask again is made. It turns into 'locked' or 'unlocked' then.
export type LockStatus = 'unlocked' | 'covered' | 'locked';

export type LockControllerDeps = {
  now(): Timestamp;
  // Only moves forward, whatever is done to the phone's date and time.
  monotonicNow(): number;
  watchActivity(listener: (activity: AppActivity) => void): () => void;
};

// System screens the app opens itself, such as the device passcode or the notification prompt,
// can send it to the background on Android. Time spent there only locks after this long, so the
// app does not ask again right after the person unlocked it.
export const SYSTEM_SCREEN_GRACE_MS = MS_PER_MINUTE;

export type LockController = {
  status(): LockStatus;
  subscribe(listener: () => void): () => void;
  setSettings(settings: LockSettings): void;
  unlock(): void;
  // Runs a task that shows a system screen, such as the authentication prompt.
  withSystemScreen<T>(task: () => Promise<T>): Promise<T>;
  // Starts watching the app going to the background. Returns a function that stops.
  start(): () => void;
};

type Away = { monotonic: number; wall: Timestamp; fromSystemScreen: boolean };

export function createLockController(
  initial: { settings: LockSettings; locked: boolean },
  deps: LockControllerDeps,
): LockController {
  const listeners = new Set<() => void>();
  let settings = initial.settings;
  let current: LockStatus = initial.locked && settings.enabled ? 'locked' : 'unlocked';
  let away: Away | null = null;
  let systemScreens = 0;

  function set(next: LockStatus) {
    if (next === current) return;
    current = next;
    for (const listener of listeners) listener();
  }

  function leave() {
    if (!settings.enabled) return;
    away = {
      monotonic: deps.monotonicNow(),
      wall: deps.now(),
      fromSystemScreen: systemScreens > 0,
    };
    if (current === 'unlocked' && systemScreens === 0) set('covered');
  }

  function comeBack() {
    if (away === null) return;
    const gone = timeAway(deps.monotonicNow() - away.monotonic, deps.now() - away.wall);
    const threshold = away.fromSystemScreen
      ? { ...settings, delay: Math.max(settings.delay, SYSTEM_SCREEN_GRACE_MS) }
      : settings;
    away = null;
    if (current === 'locked') return;
    set(shouldRelock(threshold, gone) ? 'locked' : 'unlocked');
  }

  return {
    status: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setSettings(next) {
      settings = next;
      if (!next.enabled) {
        away = null;
        set('unlocked');
      }
    },
    unlock() {
      set('unlocked');
    },
    async withSystemScreen(task) {
      systemScreens += 1;
      try {
        return await task();
      } finally {
        systemScreens -= 1;
      }
    },
    start() {
      return deps.watchActivity((activity) => {
        if (activity === 'background') leave();
        else comeBack();
      });
    },
  };
}
