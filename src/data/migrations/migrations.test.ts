import { MIGRATIONS } from '@/data/migrations';
import { openStorage } from '@/data/open-storage';
import { DATABASE_NAME } from '@/data/storage-deps';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

describe('migrations', () => {
  it('are numbered 1, 2, 3 and so on, in order', () => {
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual(
      MIGRATIONS.map((_, index) => index + 1),
    );
  });

  it('create the tables the repositories use, and only those', async () => {
    const fake = createFakeStorage();
    unwrap(await openStorage(fake.deps));

    const tables = fake.disk
      .query(DATABASE_NAME, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((row) => row.name);

    expect(tables).toEqual(['journey', 'lapse', 'setting', 'unlocked_rank']);
  });

  it('allow a single journey row', async () => {
    const fake = createFakeStorage();
    unwrap(await openStorage(fake.deps));
    const raw = await fake.rawDatabase();

    await expect(raw.run('INSERT INTO journey (id, start_at) VALUES (2, 0)')).rejects.toThrow();
    await raw.close();
  });
});
