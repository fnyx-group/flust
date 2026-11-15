import { openStorage } from '@/data/open-storage';
import { DEFAULT_LOCK_SETTINGS, NO_ATTEMPTS } from '@/domain/lock';
import { err, ok } from '@/domain/result';
import { MS_PER_MINUTE } from '@/domain/time';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const NOW = Date.UTC(2026, 2, 2, 9);

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('lock repository', () => {
  it('is off before it is turned on', async () => {
    const { storage } = await setUp();
    expect(await storage.lock.loadSettings()).toEqual(ok(DEFAULT_LOCK_SETTINGS));
  });

  it('loads the settings last saved', async () => {
    const { storage } = await setUp();
    const settings = { enabled: true, delay: 0 };
    expect(await storage.lock.saveSettings(settings)).toEqual(ok(undefined));
    expect(await storage.lock.loadSettings()).toEqual(ok(settings));
  });

  it('keeps the lock on when its value is damaged', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.run("INSERT INTO setting (key, value) VALUES ('lock', 'garbage')");
    await raw.close();

    expect(await storage.lock.loadSettings()).toEqual(
      ok({ ...DEFAULT_LOCK_SETTINGS, enabled: true }),
    );
  });

  it('has no attempts before a failure', async () => {
    const { storage } = await setUp();
    expect(await storage.lock.loadAttempts(NOW)).toEqual(ok(NO_ATTEMPTS));
  });

  it('takes the time since the attempts were saved off the wait', async () => {
    const { storage } = await setUp();
    const attempts = { failures: 5, waitMs: 5 * MS_PER_MINUTE };
    expect(await storage.lock.saveAttempts(attempts, NOW)).toEqual(ok(undefined));

    expect(await storage.lock.loadAttempts(NOW + 2 * MS_PER_MINUTE)).toEqual(
      ok({ failures: 5, waitMs: 3 * MS_PER_MINUTE }),
    );
    // A clock set back gives no credit.
    expect(await storage.lock.loadAttempts(NOW - MS_PER_MINUTE)).toEqual(ok(attempts));
  });

  it('reports storage failures', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.lock.loadSettings()).toEqual(err('storage-failed'));
    expect(await storage.lock.saveSettings(DEFAULT_LOCK_SETTINGS)).toEqual(err('storage-failed'));
    expect(await storage.lock.loadAttempts(NOW)).toEqual(err('storage-failed'));
    expect(await storage.lock.saveAttempts(NO_ATTEMPTS, NOW)).toEqual(err('storage-failed'));
  });
});
