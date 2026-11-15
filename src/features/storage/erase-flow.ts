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
  show: (step: EraseStep) => void;
};

// Every screen goes away first ("erasing"), so none reads storage while it closes. Storage is
// opened again only once everything is gone ("erased"). After a failure, part of the data may
// already be gone, so trying again erases again and never opens what is left. A second request
// while one runs is ignored.
export function createEraseFlow(deps: EraseFlowDeps) {
  let running = false;

  async function run(erase: () => Promise<Result<void, ResetStorageError>>): Promise<void> {
    if (running) return;
    running = true;
    try {
      deps.show('erasing');
      const result = await erase();
      if (!result.ok) {
        deps.show('erase-failed');
        return;
      }
      await deps.applyDeviceLanguage();
      deps.show('erased');
    } finally {
      running = false;
    }
  }

  return {
    eraseAll: (storage: Pick<Storage, 'close'>) => run(() => eraseAll(storage, deps)),
    retry: () => run(() => deps.reset()),
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
