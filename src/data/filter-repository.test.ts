import { openStorage } from '@/data/open-storage';
import { FILTER_CONFIRM_MS, FILTER_WAIT_MS, requestWeakening } from '@/domain/filter-request';
import { ok } from '@/domain/result';
import { MS_PER_MINUTE } from '@/domain/time';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const NOW = { wall: Date.UTC(2026, 10, 19, 21), elapsed: 90 * MS_PER_MINUTE, boot: 3 };
const FULL = FILTER_WAIT_MS + FILTER_CONFIRM_MS;

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('filter repository', () => {
  it('has no request before one is made', async () => {
    const { storage } = await setUp();
    expect(await storage.filter.loadRequest(NOW)).toEqual(ok(null));
  });

  it('resumes a request with the elapsed time since it was saved, not the date', async () => {
    const { storage } = await setUp();
    expect(await storage.filter.saveRequest(requestWeakening('filter'), NOW)).toEqual(
      ok(undefined),
    );

    const later = {
      wall: NOW.wall + 600 * MS_PER_MINUTE,
      elapsed: NOW.elapsed + 4 * MS_PER_MINUTE,
      boot: 3,
    };
    expect(await storage.filter.loadRequest(later)).toEqual(
      ok({ kind: 'filter', leftMs: FULL - 4 * MS_PER_MINUTE }),
    );
  });

  it('forgets a cleared request', async () => {
    const { storage } = await setUp();
    await storage.filter.saveRequest(requestWeakening('youtube'), NOW);

    expect(await storage.filter.clearRequest()).toEqual(ok(undefined));
    expect(await storage.filter.loadRequest(NOW)).toEqual(ok(null));
  });

  it('reads a damaged value as no request', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.run("INSERT INTO setting (key, value) VALUES ('filter-request', 'garbage')");
    await raw.close();

    expect(await storage.filter.loadRequest(NOW)).toEqual(ok(null));
  });
});
