import { openStorage } from '@/data/open-storage';
import { EMPTY_DRAFT, type OnboardingDraft } from '@/domain/onboarding';
import { err, ok } from '@/domain/result';
import { loadSession } from '@/features/session/load-session';
import { i18n } from '@/lib/i18n';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';
import { seedJourney } from '@test/seed';

const START = Date.UTC(2026, 0, 1);
const TODAY = 20_500;
const NO_CHECK_INS = { checkIns: [], lowMoodDismissedDay: null };
const initialLanguage = i18n.language;

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('loadSession', () => {
  afterEach(async () => {
    await i18n.changeLanguage(initialLanguage);
  });

  it('loads the journey and applies the chosen language', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    unwrap(await storage.settings.saveLanguage('fr'));

    expect(await loadSession(storage, TODAY)).toEqual(
      ok({
        journey: journeyOf(START),
        draft: EMPTY_DRAFT,
        unlockedRanks: [],
        latestLapse: null,
        ...NO_CHECK_INS,
      }),
    );
    expect(i18n.language).toBe('fr');
  });

  it('loads the ranks stored as unlocked with the journey', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    unwrap(await storage.ranks.unlock(['novice', 'apprentice']));

    expect(await loadSession(storage, TODAY)).toEqual(
      ok({
        journey: journeyOf(START),
        draft: EMPTY_DRAFT,
        unlockedRanks: ['novice', 'apprentice'],
        latestLapse: null,
        ...NO_CHECK_INS,
      }),
    );
  });

  it('loads the last lapse logged, so home can offer to undo it', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    const recorded = unwrap(
      await storage.lapses.record({
        at: START + 1000,
        recordedAt: START + 2000,
        details: null,
        plan: null,
      }),
    );

    expect(await loadSession(storage, TODAY)).toEqual(
      ok({
        journey: journeyOf(START, [START + 1000]),
        draft: EMPTY_DRAFT,
        unlockedRanks: [],
        latestLapse: recorded,
        ...NO_CHECK_INS,
      }),
    );
  });

  it('reports lapses that cannot be read as a storage failure', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    const raw = await rawDatabase();
    await raw.exec('ALTER TABLE lapse RENAME COLUMN recorded_at TO logged_at');
    await raw.close();

    expect(await loadSession(storage, TODAY)).toEqual(err('storage-failed'));
  });

  it('loads the check-ins of the low mood window and the day the card was closed', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    const answers = { mood: 1, urge: 'none', context: [], note: null } as const;
    unwrap(await storage.checkIns.save(TODAY - 14, START, answers));
    const first = unwrap(await storage.checkIns.save(TODAY - 13, START, answers));
    const latest = unwrap(await storage.checkIns.save(TODAY, START, answers));
    unwrap(await storage.settings.saveLowMoodDismissedDay(TODAY - 1));

    expect(await loadSession(storage, TODAY)).toEqual(
      ok({
        journey: journeyOf(START),
        draft: EMPTY_DRAFT,
        unlockedRanks: [],
        latestLapse: null,
        checkIns: [latest, first],
        lowMoodDismissedDay: TODAY - 1,
      }),
    );
  });

  it('reports check-ins that cannot be read as a storage failure', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    const raw = await rawDatabase();
    await raw.exec('DROP TABLE check_in');
    await raw.close();

    expect(await loadSession(storage, TODAY)).toEqual(err('storage-failed'));
  });

  it('shows the low mood card again when its dismissal cannot be read', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    jest
      .spyOn(storage.settings, 'loadLowMoodDismissedDay')
      .mockResolvedValue(err('storage-failed'));

    expect(unwrap(await loadSession(storage, TODAY)).lowMoodDismissedDay).toBeNull();
  });

  it('reports unlocked ranks that cannot be read as a storage failure', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    const raw = await rawDatabase();
    await raw.exec('DROP TABLE unlocked_rank');
    await raw.close();

    expect(await loadSession(storage, TODAY)).toEqual(err('storage-failed'));
  });

  it('keeps the device language when the stored one is unknown', async () => {
    const { storage } = await setUp();
    unwrap(await storage.settings.saveLanguage('de'));

    unwrap(await loadSession(storage, TODAY));
    expect(i18n.language).toBe(initialLanguage);
  });

  it('starts an empty onboarding when nothing was answered yet', async () => {
    const { storage } = await setUp();
    expect(await loadSession(storage, TODAY)).toEqual(
      ok({
        journey: null,
        draft: EMPTY_DRAFT,
        unlockedRanks: [],
        latestLapse: null,
        ...NO_CHECK_INS,
      }),
    );
  });

  it('resumes the onboarding on the step and with the answers it was left at', async () => {
    const { storage } = await setUp();
    const draft: OnboardingDraft = {
      step: 'plan',
      answers: { ...EMPTY_DRAFT.answers, riskMoments: ['stress'] },
    };
    unwrap(await storage.onboarding.saveDraft(draft));

    expect(await loadSession(storage, TODAY)).toEqual(
      ok({ journey: null, draft, unlockedRanks: [], latestLapse: null, ...NO_CHECK_INS }),
    );
  });

  // A corrupted journey used to be reported like a storage failure, which only offered a retry
  // that reads the same data again.
  it('reports a corrupted journey as such, so that a reset is offered', async () => {
    const { storage, rawDatabase } = await setUp();
    await seedJourney({ rawDatabase }, journeyOf(START));
    const raw = await rawDatabase();
    await raw.run('INSERT INTO lapse (at) VALUES (?)', [START - 1]);
    await raw.close();

    expect(await loadSession(storage, TODAY)).toEqual(err('journey-corrupted'));
  });

  it('reports a draft that cannot be read as a storage failure, instead of starting over', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.exec('DROP TABLE onboarding_draft');
    await raw.close();

    expect(await loadSession(storage, TODAY)).toEqual(err('storage-failed'));
  });

  it('reports a storage failure as temporary', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await loadSession(storage, TODAY)).toEqual(err('storage-failed'));
  });
});
