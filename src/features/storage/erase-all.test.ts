import { openStorage } from '@/data/open-storage';
import { BACKUP_NAME, DATABASE_NAME } from '@/data/storage-deps';
import { createStorageService } from '@/data/storage-service';
import { err, ok } from '@/domain/result';
import { eraseAll } from '@/features/storage/erase-all';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

describe('eraseAll', () => {
  it('closes storage, then deletes the data and the key, and a new open starts empty', async () => {
    const fake = createFakeStorage();
    const service = createStorageService(fake.deps);
    const storage = unwrap(await service.open());
    unwrap(
      await storage.onboarding.complete({
        journey: journeyOf(Date.UTC(2026, 0, 1)),
        reasons: [],
        riskMoments: [],
        plans: [],
      }),
    );
    unwrap(await storage.settings.saveLanguage('fr'));
    const oldKey = fake.keyStore.value;

    expect(await eraseAll(storage, service)).toEqual(ok(undefined));
    expect(await fake.deps.files.exists(DATABASE_NAME)).toBe(false);
    expect(await fake.deps.files.exists(BACKUP_NAME)).toBe(false);
    expect(fake.keyStore.value).toBeNull();

    const reopened = unwrap(await openStorage(fake.deps));
    expect(await reopened.journey.load()).toEqual(ok(null));
    expect(await reopened.settings.loadLanguage()).toEqual(ok(null));
    expect(fake.keyStore.value).not.toEqual(oldKey);
    await reopened.close();
  });

  it('closes storage before erasing', async () => {
    const events: string[] = [];
    const storage = { close: async () => void events.push('close') };
    const service = {
      reset: async () => {
        events.push('reset');
        return ok(undefined);
      },
    };

    await eraseAll(storage, service);
    expect(events).toEqual(['close', 'reset']);
  });

  it('still erases when closing fails, and reports a failed erase', async () => {
    const storage = { close: () => Promise.reject(new Error('already closed')) };
    const reset = jest.fn().mockResolvedValue(err('reset-failed'));

    expect(await eraseAll(storage, { reset })).toEqual(err('reset-failed'));
    expect(reset).toHaveBeenCalled();
  });
});
