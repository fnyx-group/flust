import { SUPPORT_WINDOW_MS } from '@/domain/lapse';
import { MS_PER_DAY } from '@/domain/time';
import { unlockToShow } from '@/features/ranks/unlock-to-show';
import { journeyOf } from '@test/arbitraries';

const START = Date.UTC(2026, 0, 1);
const REACHED = START + 3 * MS_PER_DAY;

describe('unlockToShow', () => {
  it('shows a rank as soon as it is reached when no lapse was logged', () => {
    expect(unlockToShow(journeyOf(START), ['novice'], null, REACHED)?.unlock.highest.id).toBe(
      'apprentice',
    );
  });

  it('holds it during the hours after a lapse, then shows it when they end', () => {
    const recordedAt = REACHED - 1000;
    const lapse = { id: 1, at: START + 1000, recordedAt };
    const journey = journeyOf(START - MS_PER_DAY, [START + 1000]);
    const ranks = ['novice' as const];

    expect(unlockToShow(journey, ranks, lapse, recordedAt + SUPPORT_WINDOW_MS - 1)).toBeNull();
    expect(
      unlockToShow(journey, ranks, lapse, recordedAt + SUPPORT_WINDOW_MS)?.unlock.highest.id,
    ).toBe('apprentice');
  });

  it('does not hold anything for a lapse logged before the time of logging was stored', () => {
    const lapse = { id: 1, at: START + 1000, recordedAt: null };
    expect(unlockToShow(journeyOf(START), ['novice'], lapse, REACHED)).not.toBeNull();
  });
});
