import { RANKS } from '@/domain/ranks';
import { endedStreakCard, keptRank, lapseTriggers, totalCard } from '@/features/lapse/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const fr = createI18n('fr').t;
const en = createI18n('en').t;
const sorcerer = RANKS[5];

describe('summary cards', () => {
  const summary = {
    totalCleanDays: 47,
    endedStreak: { unit: 'days', days: 12 },
    rank: sorcerer,
  } as const;

  it('show the total kept and the streak that ended', () => {
    expect(totalCard(fr, summary)).toEqual({
      value: '47',
      caption: 'jours propres, conservés',
      spoken: '47 jours propres, conservés',
    });
    expect(endedStreakCard(fr, summary)).toEqual({
      value: '12',
      caption: 'jours sur cette série',
      spoken: '12 jours sur cette série',
    });
    expect(totalCard(en, { ...summary, totalCleanDays: 1 }).caption).toBe('clean day, kept');
  });

  it('show a streak shorter than a day in hours and minutes', () => {
    const short = { ...summary, endedStreak: { unit: 'hours', hours: 3, minutes: 5 } } as const;
    expect(endedStreakCard(en, short)).toEqual({
      value: '3 h 05',
      caption: 'on this streak',
      spoken: '3 hours 5 minutes on this streak',
    });
  });

  it('name the rank kept, when there is one', () => {
    expect(keptRank(fr, summary)).toBe('Ton rang reste Sorcier.');
    expect(keptRank(en, { ...summary, rank: null })).toBeNull();
  });
});

describe('lapseTriggers', () => {
  it('offers the chosen risk moments and any urge', () => {
    expect(lapseTriggers(['stress'], 'urge')).toEqual(['stress', 'urge']);
  });

  it('keeps the current trigger when its risk moment is no longer chosen', () => {
    expect(lapseTriggers([], 'weekend')).toEqual(['weekend', 'urge']);
  });
});
