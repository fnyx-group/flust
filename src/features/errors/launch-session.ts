import type { LaunchGuard, LaunchMode } from '@/data/launch-guard';
import type { ErasedNotice } from '@/features/storage/erase-flow';

type LaunchSessionDeps = {
  guard: Pick<LaunchGuard, 'begin' | 'finish'>;
  hideSplash: () => void;
  erasedNotice: ErasedNotice;
};

// One launch, from the counter to the first screen. Leaving safe mode starts the app without
// counting a launch: if it fails again before a first screen, the next launch opens safe mode
// again. See docs/decisions/0028-error-boundaries-and-safe-mode.md.
export function createLaunchSession({ guard, hideSplash, erasedNotice }: LaunchSessionDeps) {
  let finished = false;
  return {
    erasedNotice,
    begin: (): Promise<LaunchMode> => guard.begin(),
    // Whichever gate draws the first screen calls this; only the first call resets the counter.
    firstScreenShown(): void {
      hideSplash();
      if (finished) return;
      finished = true;
      void guard.finish();
    },
    // Erasing removed the counter too; the welcome screen then announces the erase.
    erasedFromSafeMode(): LaunchMode {
      erasedNotice.mark();
      return 'normal';
    },
  };
}

export type LaunchSession = ReturnType<typeof createLaunchSession>;
