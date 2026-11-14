import { openStorage } from '@/data/open-storage';
import type { NewLapse } from '@/data/lapse-repository';
import { parseCustomText } from '@/domain/custom-text';
import { DEFAULT_PLAN, type Plan } from '@/domain/onboarding';
import { err, ok } from '@/domain/result';
import { MS_PER_HOUR } from '@/domain/time';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';
import { DATABASE_NAME } from '@/data/storage-deps';

const START = Date.UTC(2026, 0, 1);
const NOW = START + 10 * 24 * MS_PER_HOUR;
const WALK: Plan = { trigger: 'stress', action: { kind: 'preset', id: 'walk-ten-minutes' } };
const CALL: Plan = {
  trigger: 'in-bed-at-night',
  action: { kind: 'custom', text: unwrap(parseCustomText('Call Sam')) },
};

function lapse(overrides: Partial<NewLapse> = {}): NewLapse {
  return { at: NOW, recordedAt: NOW, details: null, planChange: null, ...overrides };
}

async function setUp(plans: readonly Plan[] = [DEFAULT_PLAN]) {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  unwrap(
    await storage.onboarding.complete({
      journey: journeyOf(START),
      reasons: [],
      riskMoments: ['stress'],
      plans,
    }),
  );
  const rows = (sql: string) => fake.disk.query(DATABASE_NAME, sql);
  return { ...fake, storage, rows };
}

describe('lapse repository', () => {
  describe('record', () => {
    it('stores a skipped lapse with its time of logging and nothing else', async () => {
      const { storage, rows } = await setUp();
      const recorded = unwrap(await storage.lapses.record(lapse({ at: NOW - MS_PER_HOUR })));

      expect(recorded).toEqual({ id: 1, at: NOW - MS_PER_HOUR, recordedAt: NOW });
      expect(await storage.journey.load()).toEqual(ok(journeyOf(START, [NOW - MS_PER_HOUR])));
      expect(rows('SELECT * FROM lapse_detail')).toEqual([]);
      expect(await storage.lapses.latest()).toEqual(ok(recorded));
    });

    it('stores the place and the context', async () => {
      const { storage, rows } = await setUp();
      unwrap(
        await storage.lapses.record(
          lapse({ details: { place: 'bedroom', context: ['stress', 'tiredness'] } }),
        ),
      );

      expect(rows('SELECT * FROM lapse_detail')).toEqual([
        {
          lapse_id: 1,
          place_id: 'bedroom',
          context: '["stress","tiredness"]',
          previous_plan: null,
          new_plan: null,
        },
      ]);
    });

    it('stores no detail when no question was answered', async () => {
      const { storage, rows } = await setUp();
      unwrap(await storage.lapses.record(lapse({ details: { place: null, context: [] } })));

      expect(rows('SELECT * FROM lapse_detail')).toEqual([]);
    });

    it('replaces the first plan and keeps the previous one with the lapse', async () => {
      const { storage, rows } = await setUp([DEFAULT_PLAN, CALL]);
      unwrap(
        await storage.lapses.record(lapse({ planChange: { previous: DEFAULT_PLAN, next: WALK } })),
      );

      expect(unwrap(await storage.profile.load()).plans).toEqual([WALK, CALL]);
      expect(rows('SELECT context, previous_plan, new_plan FROM lapse_detail')).toEqual([
        {
          context: '[]',
          previous_plan: JSON.stringify(DEFAULT_PLAN),
          new_plan: JSON.stringify(WALK),
        },
      ]);
    });

    it('adds the plan when none is stored', async () => {
      const { storage } = await setUp([]);
      unwrap(
        await storage.lapses.record(lapse({ planChange: { previous: DEFAULT_PLAN, next: CALL } })),
      );

      expect(unwrap(await storage.profile.load()).plans).toEqual([CALL]);
    });

    it('stores nothing when a write fails partway', async () => {
      const { storage, rawDatabase, rows } = await setUp();
      const raw = await rawDatabase();
      await raw.exec(`
        CREATE TRIGGER fail_on_plan BEFORE UPDATE ON plan
        BEGIN SELECT RAISE(ABORT, 'disk full'); END;
      `);
      await raw.close();

      expect(
        await storage.lapses.record(
          lapse({
            details: { place: 'work', context: [] },
            planChange: { previous: DEFAULT_PLAN, next: WALK },
          }),
        ),
      ).toEqual(err('storage-failed'));
      expect(rows('SELECT * FROM lapse')).toEqual([]);
      expect(rows('SELECT * FROM lapse_detail')).toEqual([]);
      expect(unwrap(await storage.profile.load()).plans).toEqual([DEFAULT_PLAN]);
    });
  });

  describe('undo', () => {
    it('removes the lapse and its detail, and puts the previous plan back', async () => {
      const { storage, rows } = await setUp();
      const recorded = unwrap(
        await storage.lapses.record(
          lapse({
            details: { place: 'bedroom', context: ['stress'] },
            planChange: { previous: DEFAULT_PLAN, next: WALK },
          }),
        ),
      );

      expect(await storage.lapses.undo(recorded.id)).toEqual(ok(undefined));
      expect(await storage.journey.load()).toEqual(ok(journeyOf(START)));
      expect(rows('SELECT * FROM lapse_detail')).toEqual([]);
      expect(unwrap(await storage.profile.load()).plans).toEqual([DEFAULT_PLAN]);
      expect(await storage.lapses.latest()).toEqual(ok(null));
    });

    it('removes only the chosen lapse when two share the same time', async () => {
      const { storage, rows } = await setUp();
      const first = unwrap(
        await storage.lapses.record(lapse({ details: { place: 'work', context: [] } })),
      );
      const second = unwrap(
        await storage.lapses.record(lapse({ details: { place: 'bedroom', context: [] } })),
      );

      unwrap(await storage.lapses.undo(second.id));
      expect(await storage.journey.load()).toEqual(ok(journeyOf(START, [NOW])));
      expect(rows('SELECT lapse_id, place_id FROM lapse_detail')).toEqual([
        { lapse_id: first.id, place_id: 'work' },
      ]);
      expect(await storage.lapses.latest()).toEqual(ok(first));
    });

    it('keeps a plan edited after the lapse', async () => {
      const { storage, rawDatabase } = await setUp();
      const recorded = unwrap(
        await storage.lapses.record(lapse({ planChange: { previous: DEFAULT_PLAN, next: WALK } })),
      );
      const raw = await rawDatabase();
      await raw.run("UPDATE plan SET trigger_id = 'boredom'");
      await raw.close();

      unwrap(await storage.lapses.undo(recorded.id));
      expect(unwrap(await storage.profile.load()).plans).toEqual([{ ...WALK, trigger: 'boredom' }]);
    });

    it('leaves the plan alone when the stored change cannot be read', async () => {
      const { storage, rawDatabase } = await setUp();
      const recorded = unwrap(
        await storage.lapses.record(lapse({ planChange: { previous: DEFAULT_PLAN, next: WALK } })),
      );
      const raw = await rawDatabase();
      await raw.run("UPDATE lapse_detail SET previous_plan = 'oops'");
      await raw.close();

      unwrap(await storage.lapses.undo(recorded.id));
      expect(unwrap(await storage.profile.load()).plans).toEqual([WALK]);
    });

    it('reports a lapse that is not there', async () => {
      const { storage } = await setUp();
      expect(await storage.lapses.undo(42)).toEqual(err('lapse-not-found'));
    });

    it('changes nothing when a write fails partway', async () => {
      const { storage, rawDatabase, rows } = await setUp();
      const recorded = unwrap(
        await storage.lapses.record(
          lapse({
            details: { place: 'bedroom', context: [] },
            planChange: { previous: DEFAULT_PLAN, next: WALK },
          }),
        ),
      );
      const raw = await rawDatabase();
      await raw.exec(`
        CREATE TRIGGER fail_on_delete BEFORE DELETE ON lapse
        BEGIN SELECT RAISE(ABORT, 'disk full'); END;
      `);
      await raw.close();

      expect(await storage.lapses.undo(recorded.id)).toEqual(err('storage-failed'));
      expect(await storage.journey.load()).toEqual(ok(journeyOf(START, [NOW])));
      expect(rows('SELECT lapse_id FROM lapse_detail')).toEqual([{ lapse_id: recorded.id }]);
      expect(unwrap(await storage.profile.load()).plans).toEqual([WALK]);
    });
  });

  describe('latest', () => {
    it('is the last lapse logged, even when it was backdated before another', async () => {
      const { storage } = await setUp();
      unwrap(await storage.lapses.record(lapse({ at: NOW })));
      const backdated = unwrap(
        await storage.lapses.record(lapse({ at: NOW - MS_PER_HOUR, recordedAt: NOW + 5 })),
      );

      expect(await storage.lapses.latest()).toEqual(ok(backdated));
    });

    it('ignores a damaged row rather than offering to undo it', async () => {
      const { storage, rawDatabase } = await setUp();
      const raw = await rawDatabase();
      await raw.run('INSERT INTO lapse (at, recorded_at) VALUES (?, ?)', [-1, NOW]);
      await raw.close();

      expect(await storage.lapses.latest()).toEqual(ok(null));
    });

    it('reads a damaged time of logging as none', async () => {
      const { storage, rawDatabase } = await setUp();
      const raw = await rawDatabase();
      await raw.run('INSERT INTO lapse (at, recorded_at) VALUES (?, ?)', [NOW, -1]);
      await raw.close();

      expect(await storage.lapses.latest()).toEqual(ok({ id: 1, at: NOW, recordedAt: null }));
    });
  });

  it('reports storage errors', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.lapses.record(lapse())).toEqual(err('storage-failed'));
    expect(await storage.lapses.undo(1)).toEqual(err('storage-failed'));
    expect(await storage.lapses.latest()).toEqual(err('storage-failed'));
  });
});
