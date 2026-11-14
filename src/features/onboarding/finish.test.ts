import { openStorage } from '@/data/open-storage';
import { EMPTY_DRAFT, type OnboardingAnswers } from '@/domain/onboarding';
import { err, ok } from '@/domain/result';
import { MS_PER_HOUR } from '@/domain/time';
import { finish, FINISH_ERROR_MESSAGES } from '@/features/onboarding/finish';
import { createI18n } from '@/lib/i18n';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const NOW = Date.UTC(2026, 10, 14, 12);

describe('finish', () => {
  it('returns the journey once the answers are stored', async () => {
    const storage = unwrap(await openStorage(createFakeStorage().deps));

    expect(await finish(storage.onboarding, EMPTY_DRAFT.answers, NOW)).toEqual(ok(journeyOf(NOW)));
    expect(await storage.journey.load()).toEqual(ok(journeyOf(NOW)));
  });

  it('stores nothing when the start is refused', async () => {
    const complete = jest.fn();
    const answers: OnboardingAnswers = {
      ...EMPTY_DRAFT.answers,
      start: { kind: 'past', at: NOW + MS_PER_HOUR },
    };

    expect(await finish({ complete }, answers, NOW)).toEqual(err('start-in-future'));
    expect(complete).not.toHaveBeenCalled();
  });

  it('returns no journey when saving fails', async () => {
    const complete = jest.fn().mockResolvedValue(err('storage-failed'));
    expect(await finish({ complete }, EMPTY_DRAFT.answers, NOW)).toEqual(err('save-failed'));
  });

  it.each(['en', 'fr'] as const)('has a message for every error in %s', (language) => {
    const i18n = createI18n(language);
    for (const key of Object.values(FINISH_ERROR_MESSAGES)) expect(i18n.exists(key)).toBe(true);
  });
});
