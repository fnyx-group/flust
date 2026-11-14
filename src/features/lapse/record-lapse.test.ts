import { openStorage } from '@/data/open-storage';
import { DATABASE_NAME } from '@/data/storage-deps';
import { DEFAULT_PLAN, type Plan } from '@/domain/onboarding';
import { err, ok } from '@/domain/result';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/time';
import { recordLapse, skippedAnswers } from '@/features/lapse/record-lapse';
import { undoLapse } from '@/features/lapse/undo-lapse';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const START = Date.UTC(2026, 0, 1, 8);
const NOW = START + 12 * MS_PER_DAY;
const SKIPPED = skippedAnswers(null);
const WALK: Plan = { trigger: 'stress', action: { kind: 'preset', id: 'walk-ten-minutes' } };

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  const journey = journeyOf(START);
  unwrap(
    await storage.onboarding.complete({
      journey,
      reasons: [],
      riskMoments: ['stress'],
      plans: [DEFAULT_PLAN],
    }),
  );
  const rows = (sql: string) => fake.disk.query(DATABASE_NAME, sql);
  return { storage, journey, rows };
}

describe('recordLapse', () => {
  it('logs a skipped lapse now, with no detail', async () => {
    const { storage, journey, rows } = await setUp();
    const result = unwrap(await recordLapse(storage.lapses, journey, SKIPPED, NOW));

    expect(result.journey).toEqual(journeyOf(START, [NOW]));
    expect(result.record).toEqual({ id: 1, at: NOW, recordedAt: NOW });
    expect(await storage.journey.load()).toEqual(ok(result.journey));
    expect(rows('SELECT * FROM lapse_detail')).toEqual([]);
  });

  it('keeps a time chosen before skipping, and stores nothing else', async () => {
    const { storage, journey, rows } = await setUp();
    const at = NOW - 3 * MS_PER_HOUR;
    const result = unwrap(await recordLapse(storage.lapses, journey, skippedAnswers(at), NOW));

    expect(result.record).toEqual({ id: 1, at, recordedAt: NOW });
    expect(await storage.journey.load()).toEqual(ok(journeyOf(START, [at])));
    expect(rows('SELECT * FROM lapse_detail')).toEqual([]);
    expect(unwrap(await storage.profile.load()).plans).toEqual([DEFAULT_PLAN]);
  });

  it('logs a backdated lapse with its answers and the adjusted plan', async () => {
    const { storage, journey, rows } = await setUp();
    const at = NOW - 2 * MS_PER_HOUR;
    const result = unwrap(
      await recordLapse(
        storage.lapses,
        journey,
        {
          at,
          details: { place: 'bedroom', context: ['stress'] },
          plan: { current: DEFAULT_PLAN, adjusted: WALK },
        },
        NOW,
      ),
    );

    expect(result.record).toEqual({ id: 1, at, recordedAt: NOW });
    expect(rows('SELECT place_id, context FROM lapse_detail')).toEqual([
      { place_id: 'bedroom', context: '["stress"]' },
    ]);
    expect(unwrap(await storage.profile.load()).plans).toEqual([WALK]);
  });

  it('stores no plan change when the plan was left as it was', async () => {
    const { storage, journey, rows } = await setUp();
    unwrap(
      await recordLapse(
        storage.lapses,
        journey,
        { ...SKIPPED, plan: { current: DEFAULT_PLAN, adjusted: { ...DEFAULT_PLAN } } },
        NOW,
      ),
    );

    expect(rows('SELECT * FROM lapse_detail')).toEqual([]);
  });

  it('refuses a time before the last lapse without storing anything', async () => {
    const { storage, journey, rows } = await setUp();
    const first = unwrap(await recordLapse(storage.lapses, journey, SKIPPED, NOW));

    expect(
      await recordLapse(storage.lapses, first.journey, { ...SKIPPED, at: NOW - 1 }, NOW + 5),
    ).toEqual(err('lapse-before-last'));
    expect(rows('SELECT id FROM lapse')).toEqual([{ id: 1 }]);
  });

  it('reports a failed write, and the journey is not changed', async () => {
    const { storage, journey } = await setUp();
    await storage.close();

    expect(await recordLapse(storage.lapses, journey, SKIPPED, NOW)).toEqual(err('save-failed'));
  });
});

describe('undoLapse', () => {
  it('restores the exact state before the lapse: streak, details and plan', async () => {
    const { storage, journey, rows } = await setUp();
    const recorded = unwrap(
      await recordLapse(
        storage.lapses,
        journey,
        {
          at: NOW - MS_PER_HOUR,
          details: { place: 'work', context: ['tiredness'] },
          plan: { current: DEFAULT_PLAN, adjusted: WALK },
        },
        NOW,
      ),
    );

    const undone = unwrap(await undoLapse(storage.lapses, recorded.journey, recorded.record));
    expect(undone).toEqual({ journey, latestLapse: null });
    expect(await storage.journey.load()).toEqual(ok(journey));
    expect(rows('SELECT * FROM lapse_detail')).toEqual([]);
    expect(unwrap(await storage.profile.load()).plans).toEqual([DEFAULT_PLAN]);
  });

  it('leaves the previous lapse as the last one, so it can be undone in turn', async () => {
    const { storage, journey } = await setUp();
    const first = unwrap(await recordLapse(storage.lapses, journey, SKIPPED, NOW));
    const second = unwrap(await recordLapse(storage.lapses, first.journey, SKIPPED, NOW));

    const undone = unwrap(await undoLapse(storage.lapses, second.journey, second.record));
    expect(undone).toEqual({ journey: first.journey, latestLapse: first.record });
  });

  it('changes nothing when the lapse is not in the journey', async () => {
    const { storage, journey } = await setUp();
    const recorded = unwrap(await recordLapse(storage.lapses, journey, SKIPPED, NOW));

    expect(await undoLapse(storage.lapses, journey, recorded.record)).toEqual(err('undo-failed'));
    expect(await storage.journey.load()).toEqual(ok(recorded.journey));
  });

  it('reports a failed write', async () => {
    const { storage, journey } = await setUp();
    const recorded = unwrap(await recordLapse(storage.lapses, journey, SKIPPED, NOW));
    await storage.close();

    expect(await undoLapse(storage.lapses, recorded.journey, recorded.record)).toEqual(
      err('undo-failed'),
    );
  });

  it('hides the undo of an older lapse that cannot be read, once this one is gone', async () => {
    const recorded = { id: 2, at: NOW, recordedAt: NOW };
    const lapses = {
      undo: async () => ok(undefined),
      latest: async () => err('storage-failed' as const),
    };

    expect(await undoLapse(lapses, journeyOf(START, [NOW]), recorded)).toEqual(
      ok({ journey: journeyOf(START), latestLapse: null }),
    );
  });
});
