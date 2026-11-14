import { openStorage } from '@/data/open-storage';
import { err, ok } from '@/domain/result';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

async function setUp() {
  const fake = createFakeStorage();
  return { ...fake, storage: unwrap(await openStorage(fake.deps)) };
}

describe('rank repository', () => {
  it('has no unlocked rank at first', async () => {
    const { storage } = await setUp();
    expect(await storage.ranks.loadUnlocked()).toEqual(ok([]));
  });

  it('keeps every unlocked rank once, across unlocks', async () => {
    const { storage } = await setUp();

    unwrap(await storage.ranks.unlock(['novice', 'apprentice']));
    unwrap(await storage.ranks.unlock(['apprentice', 'initiate']));

    const unlocked = unwrap(await storage.ranks.loadUnlocked());
    expect([...unlocked].sort()).toEqual(['apprentice', 'initiate', 'novice']);
  });

  it('never loses a rank when unlocking nothing new', async () => {
    const { storage } = await setUp();
    unwrap(await storage.ranks.unlock(['novice']));

    unwrap(await storage.ranks.unlock([]));

    expect(await storage.ranks.loadUnlocked()).toEqual(ok(['novice']));
  });

  it('drops rank ids it does not know', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.run('INSERT INTO unlocked_rank (rank_id) VALUES (?), (?)', ['novice', 'emperor']);
    await raw.close();

    expect(await storage.ranks.loadUnlocked()).toEqual(ok(['novice']));
  });

  it('reports storage errors', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.ranks.loadUnlocked()).toEqual(err('storage-failed'));
    expect(await storage.ranks.unlock(['novice'])).toEqual(err('storage-failed'));
  });
});
