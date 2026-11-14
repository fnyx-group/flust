import * as fc from 'fast-check';

import { restoreJourney, type Journey } from '@/domain/journey';
import { RANKS, type RankId } from '@/domain/ranks';
import type { Result } from '@/domain/result';
import { MS_PER_DAY, type Timestamp } from '@/domain/time';

const MIN_TIMESTAMP = Date.UTC(2020, 0, 1);
const SPAN = 3 * 365 * MS_PER_DAY;

export const timestamp = fc.integer({ min: MIN_TIMESTAMP, max: MIN_TIMESTAMP + SPAN });

export const duration = fc.integer({ min: 0, max: 2 * 365 * MS_PER_DAY });

export type JourneyInput = { start: Timestamp; lapses: Timestamp[]; now: Timestamp };

// Lapses lie within [start, now], as addLapse guarantees, with duplicates on purpose.
export const journeyInput: fc.Arbitrary<JourneyInput> = fc
  .tuple(timestamp, duration)
  .chain(([start, length]) =>
    fc.record({
      start: fc.constant(start),
      lapses: fc.array(fc.integer({ min: start, max: start + length }), { maxLength: 12 }),
      now: fc.constant(start + length),
    }),
  );

// Ranks unlock in order, so a valid list of unlocked ranks is always a prefix of RANKS.
export const rankIds: fc.Arbitrary<RankId[]> = fc
  .nat({ max: RANKS.length })
  .map((count) => RANKS.slice(0, count).map((rank) => rank.id));

export const totalDays = fc.integer({ min: 0, max: 500 });

export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Unexpected error: ${String(result.error)}`);
  return result.value;
}

export function journeyOf(start: Timestamp, lapses: readonly Timestamp[] = []): Journey {
  return unwrap(restoreJourney(start, lapses));
}

export function journeyFrom({ start, lapses }: JourneyInput): Journey {
  return journeyOf(start, lapses);
}
