import { openStorage } from '@/data/open-storage';
import { insertPlan, readPlanEntries } from '@/data/profile-repository';
import { parseCustomText } from '@/domain/custom-text';
import { MAX_PLANS, MAX_REASONS } from '@/domain/profile';
import type { OnboardingResult, Plan } from '@/domain/onboarding';
import { err, ok } from '@/domain/result';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';
import { NO_PROTECTION_SETTINGS } from '@test/protection';

const MINE = unwrap(parseCustomText('Be free'));
const CALL = unwrap(parseCustomText('Call Sam'));

const ANSWERS: OnboardingResult = {
  journey: journeyOf(Date.UTC(2026, 0, 1)),
  reasons: [
    { kind: 'preset', id: 'sleep' },
    { kind: 'preset', id: 'focus' },
    { kind: 'custom', text: MINE },
  ],
  riskMoments: ['stress', 'weekend'],
  plans: [
    { trigger: 'stress', action: { kind: 'custom', text: CALL } },
    { trigger: 'urge', action: { kind: 'preset', id: 'guided-breathing' } },
  ],
  ...NO_PROTECTION_SETTINGS,
};

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('profile repository', () => {
  it('is empty before the onboarding', async () => {
    const { storage } = await setUp();
    expect(await storage.profile.load()).toEqual(ok({ reasons: [], riskMoments: [], plans: [] }));
  });

  it('reads back the answers of the onboarding, in order', async () => {
    const { storage } = await setUp();
    unwrap(await storage.onboarding.complete(ANSWERS));

    expect(await storage.profile.load()).toEqual(
      ok({ reasons: ANSWERS.reasons, riskMoments: ANSWERS.riskMoments, plans: ANSWERS.plans }),
    );
  });

  it('leaves out rows that cannot be read and keeps the others', async () => {
    const { storage, rawDatabase } = await setUp();
    unwrap(await storage.onboarding.complete(ANSWERS));
    const raw = await rawDatabase();
    await raw.exec(`
      INSERT INTO reason (position, preset_id) VALUES (9, 'unknown');
      INSERT INTO reason (position, custom_text) VALUES (10, '   ');
      INSERT INTO risk_moment (preset_id, position) VALUES ('unknown', 9);
      INSERT INTO plan (position, trigger_id, action_preset_id) VALUES (-2, 'unknown', 'guided-breathing');
      INSERT INTO plan (position, trigger_id, action_preset_id) VALUES (-1, 'urge', 'unknown');
    `);
    await raw.close();

    expect(await storage.profile.load()).toEqual(
      ok({ reasons: ANSWERS.reasons, riskMoments: ANSWERS.riskMoments, plans: ANSWERS.plans }),
    );
  });

  describe('entries', () => {
    const WALK: Plan = { trigger: 'boredom', action: { kind: 'preset', id: 'walk-ten-minutes' } };

    it('reads every row with its id', async () => {
      const { storage } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));

      expect(await storage.profile.loadEntries()).toEqual(
        ok({
          reasons: ANSWERS.reasons.map((reason, index) => ({ id: index + 1, reason })),
          riskMoments: ANSWERS.riskMoments,
          plans: ANSWERS.plans.map((plan, index) => ({ id: index + 1, plan })),
        }),
      );
    });

    it('edits a reason in place and adds new ones at the end', async () => {
      const { storage } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));

      expect(await storage.profile.saveReason(1, { kind: 'preset', id: 'energy' })).toEqual(ok(1));
      expect(await storage.profile.saveReason(null, { kind: 'preset', id: 'sleep' })).toEqual(
        ok(4),
      );
      expect(unwrap(await storage.profile.load()).reasons).toEqual([
        { kind: 'preset', id: 'energy' },
        { kind: 'preset', id: 'focus' },
        { kind: 'custom', text: MINE },
        { kind: 'preset', id: 'sleep' },
      ]);
    });

    it('refuses a reason already there, a missing one, and one beyond the limit', async () => {
      const { storage } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));

      expect(await storage.profile.saveReason(null, { kind: 'custom', text: MINE })).toEqual(
        err('same-reason'),
      );
      expect(await storage.profile.saveReason(42, { kind: 'preset', id: 'energy' })).toEqual(
        err('not-found'),
      );
      for (let index = ANSWERS.reasons.length; index < MAX_REASONS; index += 1) {
        const text = unwrap(parseCustomText(`Reason ${index}`));
        unwrap(await storage.profile.saveReason(null, { kind: 'custom', text }));
      }
      expect(await storage.profile.saveReason(null, { kind: 'preset', id: 'energy' })).toEqual(
        err('too-many-reasons'),
      );
      expect(unwrap(await storage.profile.load()).reasons).toHaveLength(MAX_REASONS);
    });

    it('removes a reason, and counts one already gone as removed', async () => {
      const { storage } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));

      expect(await storage.profile.removeReason(2)).toEqual(ok(undefined));
      expect(await storage.profile.removeReason(2)).toEqual(ok(undefined));
      expect(unwrap(await storage.profile.load()).reasons).toEqual([
        { kind: 'preset', id: 'sleep' },
        { kind: 'custom', text: MINE },
      ]);
    });

    it('replaces the risk moments', async () => {
      const { storage } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));

      unwrap(await storage.profile.saveRiskMoments(['alone-at-home', 'boredom']));
      expect(unwrap(await storage.profile.load()).riskMoments).toEqual([
        'alone-at-home',
        'boredom',
      ]);
    });

    it('edits a plan in place, keeping its id and its place', async () => {
      const { storage } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));

      expect(await storage.profile.savePlan(1, WALK)).toEqual(ok(1));
      expect(unwrap(await storage.profile.loadEntries()).plans).toEqual([
        { id: 1, plan: WALK },
        { id: 2, plan: ANSWERS.plans[1] },
      ]);
    });

    it('adds plans after the others, so the first plan stays first', async () => {
      const { storage } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));

      expect(await storage.profile.savePlan(null, WALK)).toEqual(ok(3));
      expect(unwrap(await storage.profile.load()).plans).toEqual([...ANSWERS.plans, WALK]);
    });

    it('refuses a plan already there, a missing one, and one beyond the limit', async () => {
      const { storage } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));

      expect(await storage.profile.savePlan(2, ANSWERS.plans[0] ?? WALK)).toEqual(err('same-plan'));
      expect(await storage.profile.savePlan(42, WALK)).toEqual(err('not-found'));
      for (let index = ANSWERS.plans.length; index < MAX_PLANS; index += 1) {
        const text = unwrap(parseCustomText(`Plan ${index}`));
        unwrap(
          await storage.profile.savePlan(null, {
            trigger: 'urge',
            action: { kind: 'custom', text },
          }),
        );
      }
      expect(await storage.profile.savePlan(null, WALK)).toEqual(err('too-many-plans'));
      expect(unwrap(await storage.profile.load()).plans).toHaveLength(MAX_PLANS);
    });

    it('removes a plan but always keeps one that can be read', async () => {
      const { storage, rawDatabase } = await setUp();
      unwrap(await storage.onboarding.complete(ANSWERS));
      const raw = await rawDatabase();
      await raw.run(
        "INSERT INTO plan (position, trigger_id, action_preset_id) VALUES (9, 'unknown', 'guided-breathing')",
      );
      await raw.close();

      expect(await storage.profile.removePlan(1)).toEqual(ok(undefined));
      expect(await storage.profile.removePlan(2)).toEqual(err('last-plan'));
      expect(unwrap(await storage.profile.load()).plans).toEqual([ANSWERS.plans[1]]);
    });

    it('reports storage errors', async () => {
      const { storage } = await setUp();
      await storage.close();

      expect(await storage.profile.loadEntries()).toEqual(err('storage-failed'));
      expect(await storage.profile.saveReason(null, { kind: 'custom', text: MINE })).toEqual(
        err('storage-failed'),
      );
      expect(await storage.profile.removeReason(1)).toEqual(err('storage-failed'));
      expect(await storage.profile.saveRiskMoments([])).toEqual(err('storage-failed'));
      expect(await storage.profile.savePlan(null, WALK)).toEqual(err('storage-failed'));
      expect(await storage.profile.removePlan(1)).toEqual(err('storage-failed'));
    });
  });

  it('reports storage errors', async () => {
    const { storage } = await setUp();
    await storage.close();
    expect(await storage.profile.load()).toEqual(err('storage-failed'));
  });
});

describe('insertPlan', () => {
  const STRESS: Plan = { trigger: 'stress', action: { kind: 'custom', text: CALL } };
  const URGE: Plan = { trigger: 'urge', action: { kind: 'preset', id: 'guided-breathing' } };
  const BORED: Plan = { trigger: 'boredom', action: { kind: 'preset', id: 'guided-breathing' } };

  it('puts a plan first, last or at a given position, and returns its id', async () => {
    const { storage, rawDatabase } = await setUp();
    await storage.close();
    const db = await rawDatabase();

    const entries = await db.transaction(async (tx) => {
      const middle = await insertPlan(tx, 5, STRESS);
      const last = await insertPlan(tx, 'last', URGE);
      const first = await insertPlan(tx, 'first', BORED);
      return { ids: [first, middle, last], plans: await readPlanEntries(tx) };
    });

    expect(entries.plans).toEqual([
      { id: entries.ids[0], plan: BORED },
      { id: entries.ids[1], plan: STRESS },
      { id: entries.ids[2], plan: URGE },
    ]);
  });
});
