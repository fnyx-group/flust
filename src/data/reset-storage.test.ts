import { openStorage } from '@/data/open-storage';
import { resetStorage } from '@/data/reset-storage';
import { BACKUP_NAME, DATABASE_NAME } from '@/data/storage-deps';
import { err, ok } from '@/domain/result';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const OTHER_KEY = 'cd'.repeat(32);

// A database that can no longer be read, with a backup left next to it.
async function unreadable() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  unwrap(await storage.journey.save(journeyOf(Date.UTC(2026, 0, 1))));
  await storage.close();
  await fake.disk.files.copy(DATABASE_NAME, BACKUP_NAME);
  fake.keyStore.value = OTHER_KEY;
  return fake;
}

describe('resetStorage', () => {
  it('erases the database, its backup and the key, then the next open starts fresh', async () => {
    const fake = await unreadable();

    expect(await resetStorage(fake.deps)).toEqual(ok(undefined));
    expect(fake.disk.stored.size).toBe(0);
    expect(fake.keyStore.value).toBeNull();

    const storage = unwrap(await openStorage(fake.deps));
    expect(await storage.journey.load()).toEqual(ok(null));
  });

  it('removes the backup first, so that an interrupted reset never brings old data back', async () => {
    const fake = await unreadable();
    fake.disk.failNext('remove', DATABASE_NAME);

    expect(await resetStorage(fake.deps)).toEqual(err('reset-failed'));
    expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
  });

  it('removes the key last, so that an interrupted reset ends in a fresh start', async () => {
    const fake = await unreadable();
    fake.keyStore.failRemove = true;

    expect(await resetStorage(fake.deps)).toEqual(err('reset-failed'));
    expect(fake.disk.stored.size).toBe(0);

    fake.keyStore.failRemove = false;
    const storage = unwrap(await openStorage(fake.deps));
    expect(await storage.journey.load()).toEqual(ok(null));
  });
});
