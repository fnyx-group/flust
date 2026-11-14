import { rankGrid, rankProgress, RANKS, rankStanding, unlockFromIds } from '@/domain/ranks';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { circleLabel, currentRankText, rankCellText, unlockText } from '@/features/ranks/labels';
import { createI18n } from '@/lib/i18n';
import { journeyOf } from '@test/arbitraries';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;
const NBSP = ' ';

const start = Date.UTC(2026, 0, 1, 8);
const journey = journeyOf(start);

function unlock(...ids: string[]) {
  const value = unlockFromIds(ids);
  if (value === null) throw new Error('Unknown rank ids');
  return value;
}

describe('circleLabel', () => {
  it('shows the circle number in Roman numerals with its name', () => {
    expect(circleLabel(french, 2)).toBe('Cercle II · Ombre');
    expect(circleLabel(english, 4)).toBe('Circle IV · Crown');
  });
});

describe('currentRankText', () => {
  it('shows the first rank, locked, with the time left before day one', () => {
    const standing = rankStanding(journey, [], start + 7 * MS_PER_HOUR + 40 * MS_PER_MINUTE);
    const text = currentRankText(french, standing);
    expect(text).toMatchObject({
      unlocked: false,
      circle: 'Cercle I · Éveil',
      name: 'Premier rang',
      detail: `Novice dans 16${NBSP}h${NBSP}20`,
    });
    expect(text.rank.id).toBe('novice');
    expect(text.spokenLabel).toBe(
      'Premier rang, Novice dans 16 heures 20 minutes, cercle 1, Éveil',
    );
  });

  it('shows the current rank and the days left to the next one', () => {
    const text = currentRankText(french, rankStanding(journey, [], start + 32 * MS_PER_DAY));
    expect(text).toMatchObject({
      unlocked: true,
      circle: 'Cercle II · Ombre',
      name: 'Mage noir',
      detail: 'Prochain rang dans 13 jours',
      spokenLabel: 'Mage noir, cercle 2, Ombre, Prochain rang dans 13 jours',
    });
  });

  it('uses the singular for one day left', () => {
    const standing = rankStanding(journey, [], start + 44 * MS_PER_DAY);
    expect(currentRankText(french, standing).detail).toBe('Prochain rang dans 1 jour');
    expect(currentRankText(english, standing).detail).toBe('Next rank in 1 day');
  });

  it('says every rank is unlocked after the last one', () => {
    const standing = rankStanding(journey, [], start + 400 * MS_PER_DAY);
    expect(currentRankText(english, standing)).toMatchObject({
      name: 'Free soul',
      circle: 'Circle V · Absolute',
      detail: 'All ranks unlocked',
    });
  });
});

describe('rankCellText', () => {
  const cells = rankGrid(rankProgress([], 47));
  const cellOf = (id: string) => {
    const cell = cells.find((candidate) => candidate.rank.id === id);
    if (cell === undefined) throw new Error(`No cell for ${id}`);
    return cell;
  };

  it.each([
    ['watcher', 'Veilleur', 'Veilleur, cercle 2, débloqué, 14 jours'],
    ['sorcerer', 'Sorcier', 'Sorcier, cercle 2, rang actuel, 45 jours'],
    ['white-mage', 'Mage blanc', 'Mage blanc, cercle 3, prochain rang, verrouillé, 60 jours'],
    ['silver-mage', '???', 'Rang verrouillé, cercle 3, verrouillé, 90 jours'],
  ])('labels %p in French', (id, name, spokenLabel) => {
    expect(rankCellText(french, cellOf(id))).toEqual({ name, spokenLabel });
  });

  it('labels a hidden rank in English', () => {
    expect(rankCellText(english, cellOf('free-soul'))).toEqual({
      name: '???',
      spokenLabel: 'Locked rank, circle 5, locked, 365 days',
    });
  });

  it('uses the singular for the first rank threshold', () => {
    expect(rankCellText(english, cellOf('novice')).spokenLabel).toBe(
      'Novice, circle 1, unlocked, 1 day',
    );
  });
});

describe('unlockText', () => {
  it('opens a circle on its first rank', () => {
    expect(unlockText(french, unlock('white-mage'), 60)).toEqual({
      name: 'Mage blanc',
      circle: 'Cercle III · Lumière',
      line: "60 jours propres. Le cercle de la Lumière s'ouvre.",
      others: null,
      announcement: `Nouveau rang${NBSP}: Mage blanc, cercle 3, Lumière`,
    });
  });

  it('moves forward within a circle on its later ranks', () => {
    expect(unlockText(french, unlock('black-mage'), 30).line).toBe(
      "30 jours propres. Tu avances dans le cercle de l'Ombre.",
    );
    expect(unlockText(english, unlock('black-mage'), 30).line).toBe(
      '30 clean days. You move forward in the circle of Shadow.',
    );
  });

  it('uses the singular on the first clean day', () => {
    expect(unlockText(french, unlock('novice'), 1).line).toBe(
      "1 jour propre. Le cercle de l'Éveil s'ouvre.",
    );
    expect(unlockText(english, unlock('novice'), 1).line).toBe(
      '1 clean day. The circle of Awakening opens.',
    );
  });

  it('lists the other ranks unlocked at the same time', () => {
    expect(unlockText(french, unlock('initiate', 'watcher'), 20).others).toBe(
      `Aussi débloqué${NBSP}: Initié`,
    );
    expect(unlockText(french, unlock('apprentice', 'initiate', 'watcher'), 20).others).toBe(
      `Aussi débloqués${NBSP}: Apprenti, Initié`,
    );
  });

  it('has a line for every rank in both languages', () => {
    for (const t of [french, english]) {
      for (const rank of RANKS) {
        expect(unlockText(t, unlock(rank.id), rank.threshold).line).not.toMatch(/ranks\./);
      }
    }
  });
});
