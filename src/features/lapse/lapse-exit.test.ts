import { openStorage } from '@/data/open-storage';
import { DATABASE_NAME } from '@/data/storage-deps';
import { startUrgeVisit, type UrgeVisit } from '@/features/emergency/urge-visit';
import { handedOffVisit, handOffVisit } from '@/features/emergency/visit-handoff';
import { createLapseExit } from '@/features/lapse/lapse-exit';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const OPENED = Date.UTC(2026, 0, 1, 22);
const START = Date.UTC(2025, 11, 1);
const RECORDED = {
  journey: journeyOf(START, [OPENED + 1000]),
  record: { id: 1, at: OPENED + 1000, recordedAt: OPENED + 2000 },
};

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  const started = startUrgeVisit(storage.urges, OPENED);
  // The exit does not wait for the visit's writes, so the test keeps them to wait for them.
  const writes: Promise<void>[] = [];
  const visit: UrgeVisit = {
    finish(outcome, at) {
      const write = started.finish(outcome, at);
      writes.push(write);
      return write;
    },
  };
  const rows = () => fake.disk.query(DATABASE_NAME, 'SELECT ended_at, outcome FROM urge_event');
  const settle = () => Promise.all(writes);
  return { visit, rows, settle };
}

describe('createLapseExit', () => {
  it('gives the session the lapse before the screen closes', () => {
    const calls: string[] = [];
    createLapseExit(null).saved(RECORDED, OPENED, {
      setLapses: () => calls.push('setLapses'),
      close: () => calls.push('close'),
    });

    expect(calls).toEqual(['setLapses', 'close']);
  });

  it('ends the visit as a lapse once saved, and keeps it when the screen is then removed', async () => {
    const { visit, rows, settle } = await setUp();
    const exit = createLapseExit(visit);
    exit.saved(RECORDED, OPENED + 2000, { setLapses: jest.fn(), close: jest.fn() });
    exit.removed(OPENED + 3000);
    await settle();

    expect(rows()).toEqual([{ ended_at: OPENED + 2000, outcome: 'lapse' }]);
  });

  it('ends the visit as closed when the user goes back without saving', async () => {
    const { visit, rows, settle } = await setUp();
    createLapseExit(visit).removed(OPENED + 3000);
    await settle();

    expect(rows()).toEqual([{ ended_at: OPENED + 3000, outcome: 'closed' }]);
  });
});

describe('visit hand-off', () => {
  it('passes the visit to the lapse screen under a key, until it ends', async () => {
    const { visit, rows, settle } = await setUp();
    const key = handOffVisit(visit);
    const handed = handedOffVisit(key);
    expect(handedOffVisit(key)).toBe(handed);

    await handed?.finish('lapse', OPENED + 2000);
    await settle();
    expect(rows()).toEqual([{ ended_at: OPENED + 2000, outcome: 'lapse' }]);
    expect(handedOffVisit(key)).toBeNull();
  });

  it('finds no visit for a missing or unknown key', () => {
    expect(handedOffVisit(undefined)).toBeNull();
    expect(handedOffVisit('unknown')).toBeNull();
  });
});
