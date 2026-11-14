import { openStorage } from '@/data/open-storage';
import { DATABASE_NAME } from '@/data/storage-deps';
import { err, ok } from '@/domain/result';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const OPENED = Date.UTC(2026, 0, 1, 22);

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  const rows = () => fake.disk.query(DATABASE_NAME, 'SELECT * FROM urge_event ORDER BY id');
  return { storage, rows };
}

describe('urge repository', () => {
  it('stores the start when the screen opens, then the end and the outcome', async () => {
    const { storage, rows } = await setUp();
    const id = unwrap(await storage.urges.start(OPENED));
    expect(rows()).toEqual([{ id, started_at: OPENED, ended_at: null, outcome: null }]);

    expect(await storage.urges.finish(id, OPENED + 60_000, 'held')).toEqual(ok(undefined));
    expect(rows()).toEqual([
      { id, started_at: OPENED, ended_at: OPENED + 60_000, outcome: 'held' },
    ]);
  });

  it('keeps each visit apart', async () => {
    const { storage, rows } = await setUp();
    const first = unwrap(await storage.urges.start(OPENED));
    const second = unwrap(await storage.urges.start(OPENED + 1000));
    unwrap(await storage.urges.finish(second, OPENED + 2000, 'lapse'));

    expect(rows().map((row) => row.outcome)).toEqual([null, 'lapse']);
    expect(first).not.toBe(second);
  });

  it('ends a visit once', async () => {
    const { storage, rows } = await setUp();
    const id = unwrap(await storage.urges.start(OPENED));
    unwrap(await storage.urges.finish(id, OPENED + 1000, 'closed'));

    expect(await storage.urges.finish(id, OPENED + 2000, 'held')).toEqual(err('urge-not-open'));
    expect(await storage.urges.finish(id + 1, OPENED + 2000, 'held')).toEqual(err('urge-not-open'));
    expect(rows()[0]?.outcome).toBe('closed');
  });

  it('reports storage errors', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.urges.start(OPENED)).toEqual(err('storage-failed'));
    expect(await storage.urges.finish(1, OPENED, 'held')).toEqual(err('storage-failed'));
  });
});
