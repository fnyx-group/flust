import type { Storage } from '@/data/open-storage';
import type { ResetStorageError } from '@/data/reset-storage';
import type { StorageService } from '@/data/storage-service';
import type { Result } from '@/domain/result';
import { eraseAll } from '@/features/storage/erase-all';

export type EraseStep = 'erasing' | 'erase-failed' | 'erased';

type EraseFlowDeps = Pick<StorageService, 'reset'> & {
  // The stored language is erased with the rest, so the app goes back to the device language,
  // which the next launch would choose too.
  applyDeviceLanguage: () => Promise<void>;
  // Planned reminders live outside storage, with the system, so they are cancelled on their own.
  // Planning is paused first and waits for a plan being made, so none lands after the erase.
  pauseReminders: () => Promise<() => void>;
  clearReminders: () => Promise<void>;
  // The error log and the launch counter live outside storage too. They hold no personal data,
  // but erasing everything leaves nothing behind. Resolves to false when they could not go.
  eraseDiagnostics: () => Promise<boolean>;
  // Paused for the whole erase, so an error during it writes no new log after the old one goes.
  pauseDiagnostics: () => () => void;
  show: (step: EraseStep) => void;
};

// Every screen goes away first ("erasing"), so none reads storage while it closes. Storage is
// opened again only once everything is gone ("erased"). After a failure, part of the data may
// already be gone, so trying again erases again and never opens what is left. Safe mode, where
// storage was never opened, erases the same way. A second request while one runs is ignored.
export function createEraseFlow(deps: EraseFlowDeps) {
  let running = false;

  async function run(erase: () => Promise<Result<void, ResetStorageError>>): Promise<void> {
    if (running) return;
    running = true;
    let resumeReminders: () => void = () => undefined;
    const resumeDiagnostics = deps.pauseDiagnostics();
    try {
      deps.show('erasing');
      resumeReminders = await deps.pauseReminders();
      await deps.clearReminders().catch(() => undefined);
      const result = await erase();
      await deps.clearReminders().catch(() => undefined);
      if (!result.ok || !(await deps.eraseDiagnostics())) {
        deps.show('erase-failed');
        return;
      }
      await deps.applyDeviceLanguage();
      deps.show('erased');
    } finally {
      resumeReminders();
      resumeDiagnostics();
      running = false;
    }
  }

  return {
    eraseAll: (storage: Pick<Storage, 'close'>) => run(() => eraseAll(storage, deps)),
    eraseWithoutStorage: () => run(() => deps.reset()),
  };
}

// Set when an erase finishes, read once by the welcome screen that follows, so the confirmation
// is announced after that screen has mounted and never again.
export function createErasedNotice() {
  let pending = false;
  return {
    mark: () => {
      pending = true;
    },
    take: (): boolean => {
      const value = pending;
      pending = false;
      return value;
    },
  };
}

export type ErasedNotice = ReturnType<typeof createErasedNotice>;
