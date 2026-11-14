import * as fc from 'fast-check';

import { addLapse, createJourney, type Journey } from '@/domain/journey';
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

export const rankIds: fc.Arbitrary<RankId[]> = fc.subarray(RANKS.map((rank) => rank.id));

export const totalDays = fc.integer({ min: 0, max: 500 });

export function valueOf<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Unexpected error: ${String(result.error)}`);
  return result.value;
}

export function journeyFrom({ start, lapses, now }: JourneyInput): Journey {
  return lapses.reduce(
    (journey, lapse) => valueOf(addLapse(journey, lapse, now)),
    valueOf(createJourney(start, now)),
  );
}
