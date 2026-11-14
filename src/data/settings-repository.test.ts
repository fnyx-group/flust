import { openStorage } from '@/data/open-storage';
import { err, ok } from '@/domain/result';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('settings repository', () => {
  it('has no language before one is chosen', async () => {
    const { storage } = await setUp();
    expect(await storage.settings.loadLanguage()).toEqual(ok(null));
  });

  it('loads the last language saved', async () => {
    const { storage } = await setUp();
    expect(await storage.settings.saveLanguage('fr')).toEqual(ok(undefined));
    unwrap(await storage.settings.saveLanguage('en'));
    expect(await storage.settings.loadLanguage()).toEqual(ok('en'));
  });

  it('returns the stored value as written, for the caller to validate', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.run("INSERT INTO setting (key, value) VALUES ('language', 'de')");
    await raw.close();

    expect(await storage.settings.loadLanguage()).toEqual(ok('de'));
  });

  it('reports storage failures', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.settings.loadLanguage()).toEqual(err('storage-failed'));
    expect(await storage.settings.saveLanguage('fr')).toEqual(err('storage-failed'));
  });
});
