import { openStorage } from '@/data/open-storage';
import { DATABASE_NAME } from '@/data/storage-deps';
import { err } from '@/domain/result';
import { startUrgeVisit } from '@/features/emergency/urge-visit';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const OPENED = Date.UTC(2026, 0, 1, 22);

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  const rows = () =>
    fake.disk.query(DATABASE_NAME, 'SELECT started_at, ended_at, outcome FROM urge_event');
  return { storage, rows };
}

describe('startUrgeVisit', () => {
  it('stores the visit when it starts, even before it ends', async () => {
    const { storage, rows } = await setUp();
    const visit = startUrgeVisit(storage.urges, OPENED);
    await visit.finish('held', OPENED + 1000);

    expect(rows()).toEqual([{ started_at: OPENED, ended_at: OPENED + 1000, outcome: 'held' }]);
  });

  it('keeps the first outcome, as the screen reports closed after a button', async () => {
    const { storage, rows } = await setUp();
    const visit = startUrgeVisit(storage.urges, OPENED);
    const first = visit.finish('lapse', OPENED + 1000);
    const second = visit.finish('closed', OPENED + 2000);
    await Promise.all([first, second]);

    expect(rows()).toEqual([{ started_at: OPENED, ended_at: OPENED + 1000, outcome: 'lapse' }]);
  });

  it('leaves a visit open when the app is killed before it ends', async () => {
    const { storage, rows } = await setUp();
    startUrgeVisit(storage.urges, OPENED);
    await storage.profile.load();

    expect(rows()).toEqual([{ started_at: OPENED, ended_at: null, outcome: null }]);
  });

  it('gives up quietly when the visit could not be stored', async () => {
    const finish = jest.fn();
    const visit = startUrgeVisit(
      { start: async () => err('storage-failed' as const), finish },
      OPENED,
    );
    await visit.finish('held', OPENED + 1000);

    expect(finish).not.toHaveBeenCalled();
  });
});
