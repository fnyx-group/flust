import { openStorage, type Storage } from '@/data/open-storage';
import { DATABASE_NAME } from '@/data/storage-deps';
import { parseCustomText, type CustomText } from '@/domain/custom-text';
import {
  DEFAULT_PLAN,
  EMPTY_DRAFT,
  finishOnboarding,
  type OnboardingDraft,
  type OnboardingResult,
} from '@/domain/onboarding';
import { err, ok } from '@/domain/result';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const NOW = Date.UTC(2026, 10, 14, 12);

function text(value: string): CustomText {
  return unwrap(parseCustomText(value));
}

async function setUp() {
  const fake = createFakeStorage();
  const storage: Storage = unwrap(await openStorage(fake.deps));
  const query = (sql: string) => fake.disk.query(DATABASE_NAME, sql);
  return { ...fake, storage, query };
}

const draft: OnboardingDraft = {
  step: 'plan',
  answers: {
    reasons: [
      { kind: 'preset', id: 'loved-ones' },
      { kind: 'preset', id: 'sleep' },
      { kind: 'custom', text: text('Pour mes enfants') },
    ],
    riskMoments: ['in-bed-at-night', 'stress'],
    plan: { trigger: 'stress', action: { kind: 'custom', text: text('Call Sam') } },
    start: { kind: 'past', at: NOW - 3_600_000 },
  },
};

function result(): OnboardingResult {
  return unwrap(finishOnboarding(draft.answers, NOW));
}

describe('onboarding repository', () => {
  describe('draft', () => {
    it('is empty before anything is saved', async () => {
      const { storage } = await setUp();
      expect(await storage.onboarding.loadDraft()).toEqual(ok(EMPTY_DRAFT));
    });

    it('loads the step and answers it saved', async () => {
      const { storage } = await setUp();
      expect(await storage.onboarding.saveDraft(draft)).toEqual(ok(undefined));
      expect(await storage.onboarding.loadDraft()).toEqual(ok(draft));
    });

    it('replaces the previous draft', async () => {
      const { storage, query } = await setUp();
      unwrap(await storage.onboarding.saveDraft(draft));
      unwrap(await storage.onboarding.saveDraft(EMPTY_DRAFT));

      expect(await storage.onboarding.loadDraft()).toEqual(ok(EMPTY_DRAFT));
      expect(query('SELECT count(*) AS count FROM onboarding_draft')).toEqual([{ count: 1 }]);
    });

    // A back press while the onboarding finishes queues a save after the final transaction.
    it('is not saved again once a journey exists', async () => {
      const { storage, query } = await setUp();
      unwrap(await storage.onboarding.complete(result()));

      expect(await storage.onboarding.saveDraft(draft)).toEqual(ok(undefined));
      expect(query('SELECT * FROM onboarding_draft')).toEqual([]);
    });
  });

  describe('complete', () => {
    it('saves the journey and the answers as real data, and clears the draft', async () => {
      const { storage, query } = await setUp();
      unwrap(await storage.onboarding.saveDraft(draft));

      expect(await storage.onboarding.complete(result())).toEqual(ok(undefined));

      expect(await storage.journey.load()).toEqual(ok(journeyOf(NOW - 3_600_000)));
      expect(
        query('SELECT position, preset_id, custom_text FROM reason ORDER BY position'),
      ).toEqual([
        { position: 0, preset_id: 'loved-ones', custom_text: null },
        { position: 1, preset_id: 'sleep', custom_text: null },
        { position: 2, preset_id: null, custom_text: 'Pour mes enfants' },
      ]);
      expect(query('SELECT preset_id, position FROM risk_moment ORDER BY position')).toEqual([
        { preset_id: 'in-bed-at-night', position: 0 },
        { preset_id: 'stress', position: 1 },
      ]);
      expect(
        query('SELECT position, trigger_id, action_preset_id, action_custom_text FROM plan'),
      ).toEqual([
        {
          position: 0,
          trigger_id: 'stress',
          action_preset_id: null,
          action_custom_text: 'Call Sam',
        },
      ]);
      expect(query('SELECT * FROM onboarding_draft')).toEqual([]);
      expect(await storage.onboarding.loadDraft()).toEqual(ok(EMPTY_DRAFT));
    });

    it('saves the defaults when every step was skipped', async () => {
      const { storage, query } = await setUp();
      unwrap(await storage.onboarding.complete(unwrap(finishOnboarding(EMPTY_DRAFT.answers, NOW))));

      expect(await storage.journey.load()).toEqual(ok(journeyOf(NOW)));
      expect(query('SELECT * FROM reason')).toEqual([]);
      expect(query('SELECT * FROM risk_moment')).toEqual([]);
      expect(query('SELECT trigger_id, action_preset_id, action_custom_text FROM plan')).toEqual([
        {
          trigger_id: DEFAULT_PLAN.trigger,
          action_preset_id: 'guided-breathing',
          action_custom_text: null,
        },
      ]);
    });

    it('finishes a draft whose stored risk moments were duplicated', async () => {
      const { storage, rawDatabase, query } = await setUp();
      const raw = await rawDatabase();
      await raw.run('INSERT INTO onboarding_draft (id, step, answers) VALUES (1, ?, ?)', [
        'start',
        JSON.stringify({ ...draft.answers, riskMoments: ['stress', 'stress', 'in-bed-at-night'] }),
      ]);
      await raw.close();

      const loaded = unwrap(await storage.onboarding.loadDraft());
      const finished = unwrap(finishOnboarding(loaded.answers, NOW));
      expect(await storage.onboarding.complete(finished)).toEqual(ok(undefined));
      expect(query('SELECT preset_id FROM risk_moment ORDER BY position')).toEqual([
        { preset_id: 'in-bed-at-night' },
        { preset_id: 'stress' },
      ]);
    });

    it('never replaces an existing journey or its answers', async () => {
      const { storage, query } = await setUp();
      unwrap(await storage.onboarding.complete(result()));
      const again = unwrap(finishOnboarding(EMPTY_DRAFT.answers, NOW + 1000));

      expect(await storage.onboarding.complete(again)).toEqual(err('storage-failed'));
      expect(await storage.journey.load()).toEqual(ok(journeyOf(NOW - 3_600_000)));
      expect(query('SELECT count(*) AS count FROM reason')).toEqual([{ count: 3 }]);
    });

    it.each([
      ['the journey', 'journey'],
      ['a reason', 'reason'],
      ['a risk moment', 'risk_moment'],
      ['the plan', 'plan'],
    ])('changes nothing when writing %s fails', async (_, table) => {
      const { storage, rawDatabase, query } = await setUp();
      unwrap(await storage.onboarding.saveDraft(draft));
      const raw = await rawDatabase();
      await raw.exec(`
        CREATE TRIGGER fail_insert BEFORE INSERT ON ${table}
        BEGIN SELECT RAISE(ABORT, 'disk full'); END;
      `);
      await raw.close();

      expect(await storage.onboarding.complete(result())).toEqual(err('storage-failed'));

      expect(await storage.journey.load()).toEqual(ok(null));
      expect(await storage.onboarding.loadDraft()).toEqual(ok(draft));
      for (const other of ['reason', 'risk_moment', 'plan']) {
        expect(query(`SELECT * FROM ${other}`)).toEqual([]);
      }
    });

    it('changes nothing when clearing the draft fails', async () => {
      const { storage, rawDatabase } = await setUp();
      unwrap(await storage.onboarding.saveDraft(draft));
      const raw = await rawDatabase();
      await raw.exec(`
        CREATE TRIGGER fail_delete BEFORE DELETE ON onboarding_draft
        BEGIN SELECT RAISE(ABORT, 'disk full'); END;
      `);
      await raw.close();

      expect(await storage.onboarding.complete(result())).toEqual(err('storage-failed'));
      expect(await storage.journey.load()).toEqual(ok(null));
      expect(await storage.onboarding.loadDraft()).toEqual(ok(draft));
    });
  });

  it('reports storage failures', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.onboarding.loadDraft()).toEqual(err('storage-failed'));
    expect(await storage.onboarding.saveDraft(draft)).toEqual(err('storage-failed'));
    expect(await storage.onboarding.complete(result())).toEqual(err('storage-failed'));
  });
});
