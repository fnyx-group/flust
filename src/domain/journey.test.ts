import * as fc from 'fast-check';

import { journeyFrom, journeyInput, timestamp, valueOf } from '@/domain/arbitraries';
import {
  addLapse,
  createJourney,
  removeLapse,
  restoreJourney,
  type Journey,
} from '@/domain/journey';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/time';

const start = Date.UTC(2026, 0, 1, 8);
const now = start + 10 * MS_PER_DAY;
const journey: Journey = { start, lapses: [] };

describe('createJourney', () => {
  it('starts a journey with no lapse', () => {
    expect(createJourney(start, now)).toEqual({ ok: true, value: journey });
  });

  it('accepts a start equal to now', () => {
    expect(createJourney(now, now).ok).toBe(true);
  });

  it('refuses a start in the future', () => {
    expect(createJourney(now + 1, now)).toEqual({ ok: false, error: 'start-in-future' });
  });

  it.each([
    [Number.NaN, now],
    [start, Number.NaN],
    [-1, now],
  ])('refuses invalid timestamps %p, %p', (s, n) => {
    expect(createJourney(s, n)).toEqual({ ok: false, error: 'invalid-timestamp' });
  });

  it('refuses any start after now', () => {
    fc.assert(
      fc.property(timestamp, fc.integer({ min: 1, max: MS_PER_DAY }), (n, ahead) => {
        const result = createJourney(n + ahead, n);
        return !result.ok && result.error === 'start-in-future';
      }),
    );
  });
});

describe('addLapse', () => {
  it('records a lapse', () => {
    const lapse = start + MS_PER_DAY;
    expect(valueOf(addLapse(journey, lapse, now)).lapses).toEqual([lapse]);
  });

  it('accepts a lapse exactly at the start and exactly at now', () => {
    expect(valueOf(addLapse(journey, start, now)).lapses).toEqual([start]);
    expect(valueOf(addLapse(journey, now, now)).lapses).toEqual([now]);
  });

  it('records two lapses on the same day', () => {
    const first = start + 2 * MS_PER_DAY;
    const second = first + 3 * MS_PER_HOUR;
    const result = valueOf(addLapse(valueOf(addLapse(journey, first, now)), second, now));
    expect(result.lapses).toEqual([first, second]);
  });

  it('inserts a backdated lapse in order', () => {
    const later = start + 5 * MS_PER_DAY;
    const backdated = start + 2 * MS_PER_DAY;
    const result = valueOf(addLapse(valueOf(addLapse(journey, later, now)), backdated, now));
    expect(result.lapses).toEqual([backdated, later]);
  });

  it('refuses a lapse before the start', () => {
    expect(addLapse(journey, start - 1, now)).toEqual({ ok: false, error: 'lapse-before-start' });
  });

  it('refuses a lapse after now', () => {
    expect(addLapse(journey, now + 1, now)).toEqual({ ok: false, error: 'lapse-in-future' });
  });

  it('refuses invalid timestamps', () => {
    expect(addLapse(journey, Number.NaN, now)).toEqual({ ok: false, error: 'invalid-timestamp' });
    expect(addLapse(journey, start, 1.5)).toEqual({ ok: false, error: 'invalid-timestamp' });
  });

  it('refuses any lapse outside the journey and leaves it unchanged', () => {
    fc.assert(
      fc.property(
        journeyInput,
        fc.integer({ min: 1, max: MS_PER_DAY }),
        fc.boolean(),
        (input, offset, before) => {
          const original = journeyFrom(input);
          const snapshot = structuredClone(original);
          const at = before ? input.start - offset : input.now + offset;
          const result = addLapse(original, at, input.now);
          return !result.ok && JSON.stringify(original) === JSON.stringify(snapshot);
        },
      ),
    );
  });

  it('keeps lapses sorted whatever the order they are added in', () => {
    fc.assert(
      fc.property(
        journeyInput.chain((input) =>
          fc.tuple(
            fc.constant(input),
            fc.shuffledSubarray(input.lapses, { minLength: input.lapses.length }),
          ),
        ),
        ([input, shuffled]) => {
          const inOrder = journeyFrom(input);
          const shuffledOrder = journeyFrom({ ...input, lapses: shuffled });
          const sorted = [...input.lapses].sort((a, b) => a - b);
          expect(inOrder.lapses).toEqual(sorted);
          expect(shuffledOrder).toEqual(inOrder);
        },
      ),
    );
  });
});

describe('removeLapse', () => {
  it('removes one occurrence of the lapse', () => {
    const lapse = start + MS_PER_DAY;
    const twice = valueOf(addLapse(valueOf(addLapse(journey, lapse, now)), lapse, now));
    expect(valueOf(removeLapse(twice, lapse)).lapses).toEqual([lapse]);
  });

  it('reports a lapse that does not exist', () => {
    expect(removeLapse(journey, start)).toEqual({ ok: false, error: 'lapse-not-found' });
  });

  it('restores the exact previous journey after adding a lapse', () => {
    fc.assert(
      fc.property(
        journeyInput.chain((input) =>
          fc.tuple(fc.constant(input), fc.integer({ min: input.start, max: input.now })),
        ),
        ([input, at]) => {
          const before = journeyFrom(input);
          const after = valueOf(removeLapse(valueOf(addLapse(before, at, input.now)), at));
          expect(after).toEqual(before);
        },
      ),
    );
  });
});

describe('restoreJourney', () => {
  it('sorts stored lapses', () => {
    const lapses = [start + 3 * MS_PER_DAY, start + MS_PER_DAY];
    expect(restoreJourney(start, lapses)).toEqual({
      ok: true,
      value: { start, lapses: [start + MS_PER_DAY, start + 3 * MS_PER_DAY] },
    });
  });

  it('accepts lapses after the current clock, which may be behind', () => {
    expect(restoreJourney(start, [now + MS_PER_DAY]).ok).toBe(true);
  });

  it('refuses a lapse before the start', () => {
    expect(restoreJourney(start, [start - 1])).toEqual({ ok: false, error: 'lapse-before-start' });
  });

  it('refuses invalid timestamps', () => {
    expect(restoreJourney(Number.NaN, [])).toEqual({ ok: false, error: 'invalid-timestamp' });
    expect(restoreJourney(start, [start, -5])).toEqual({ ok: false, error: 'invalid-timestamp' });
  });

  it('gives the same journey as adding the lapses one by one', () => {
    fc.assert(
      fc.property(journeyInput, (input) => {
        expect(valueOf(restoreJourney(input.start, input.lapses))).toEqual(journeyFrom(input));
      }),
    );
  });
});
