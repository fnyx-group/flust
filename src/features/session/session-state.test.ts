import type { CheckIn } from '@/domain/check-in';
import { EMPTY_DRAFT } from '@/domain/onboarding';
import { sessionSetters, type SessionState } from '@/features/session/session-state';
import { journeyOf } from '@test/arbitraries';

const START = Date.UTC(2026, 0, 1);

const CHECK_IN: CheckIn = {
  day: 10,
  recordedAt: START,
  updatedAt: START,
  mood: 4,
  urge: 'none',
  context: [],
  note: null,
};

// Like React, changes made before a render are queued and run in order, each on the state the
// previous one left.
function setUp() {
  let state: SessionState = {
    status: 'ready',
    data: {
      journey: journeyOf(START),
      draft: EMPTY_DRAFT,
      unlockedRanks: [],
      latestLapse: null,
      checkIns: [],
      lowMoodDismissedDay: null,
    },
  };
  const queue: ((previous: SessionState) => SessionState)[] = [];
  const setters = sessionSetters((change) => queue.push(change));
  const render = () => {
    for (const change of queue.splice(0)) state = change(state);
    if (state.status !== 'ready') throw new Error('Expected a ready session');
    return state.data;
  };
  return { setters, render };
}

describe('session setters', () => {
  it('keep a check-in saved just before a new journey', () => {
    const { setters, render } = setUp();
    setters.setCheckIn(CHECK_IN);
    setters.setJourney(journeyOf(START + 1000));

    const data = render();
    expect(data.checkIns).toEqual([CHECK_IN]);
    expect(data.journey).toEqual(journeyOf(START + 1000));
  });

  it('keep a dismissed card and a rank changed just before a lapse', () => {
    const { setters, render } = setUp();
    const lapse = { id: 1, at: START + 2000, recordedAt: START + 2000 };
    setters.dismissLowMood(10);
    setters.addUnlocked(['novice']);
    setters.setLapses(journeyOf(START, [START + 2000]), lapse);

    const data = render();
    expect(data.lowMoodDismissedDay).toBe(10);
    expect(data.unlockedRanks).toEqual(['novice']);
    expect(data.latestLapse).toEqual(lapse);
  });

  it('change nothing while the session is loading', () => {
    const queue: ((previous: SessionState) => SessionState)[] = [];
    sessionSetters((change) => queue.push(change)).setJourney(journeyOf(START));
    expect(queue[0]?.({ status: 'loading' })).toEqual({ status: 'loading' });
  });
});
