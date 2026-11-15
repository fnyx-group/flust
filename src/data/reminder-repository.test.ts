import { openStorage } from '@/data/open-storage';
import { DEFAULT_REMINDER_SETTINGS } from '@/domain/reminders';
import { err, ok } from '@/domain/result';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('reminder repository', () => {
  it('has every reminder off before any is turned on', async () => {
    const { storage } = await setUp();
    expect(await storage.reminders.load()).toEqual(ok(DEFAULT_REMINDER_SETTINGS));
  });

  it('loads the settings last saved', async () => {
    const { storage } = await setUp();
    const settings = { ...DEFAULT_REMINDER_SETTINGS, ranks: true, checkInSince: 20_000 };
    expect(await storage.reminders.save(settings)).toEqual(ok(undefined));
    expect(await storage.reminders.load()).toEqual(ok(settings));
  });

  it('reads a damaged value as reminders off', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.run("INSERT INTO setting (key, value) VALUES ('reminders', '{broken')");
    await raw.close();

    expect(await storage.reminders.load()).toEqual(ok(DEFAULT_REMINDER_SETTINGS));
  });

  it('reports storage failures', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.reminders.load()).toEqual(err('storage-failed'));
    expect(await storage.reminders.save(DEFAULT_REMINDER_SETTINGS)).toEqual(err('storage-failed'));
  });
});
