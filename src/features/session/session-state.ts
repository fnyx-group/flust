import { withCheckIn, type CheckIn } from '@/domain/check-in';
import type { Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import { withUnlocked, type RankId } from '@/domain/ranks';
import type { SessionData } from '@/features/session/load-session';

export type SessionState = { status: 'loading' } | { status: 'ready'; data: SessionData };

type UpdateState = (change: (previous: SessionState) => SessionState) => void;

// Every change applies to the state as it is when React runs it, never to the data of the last
// render: two changes made before a render, such as a check-in then a lapse, both land.
export function sessionSetters(setState: UpdateState) {
  return {
    setJourney: (journey: Journey) => setState((previous) => update(previous, () => ({ journey }))),
    setLapses: (journey: Journey, latestLapse: LapseRecord | null) =>
      setState((previous) => update(previous, () => ({ journey, latestLapse }))),
    setCheckIn: (checkIn: CheckIn) =>
      setState((previous) =>
        update(previous, (ready) => ({ checkIns: withCheckIn(ready.checkIns, checkIn) })),
      ),
    dismissLowMood: (day: number) =>
      setState((previous) => update(previous, () => ({ lowMoodDismissedDay: day }))),
    addUnlocked: (ids: readonly RankId[]) =>
      setState((previous) =>
        update(previous, (data) => ({ unlockedRanks: withUnlocked(data.unlockedRanks, ids) })),
      ),
  };
}

function update(
  state: SessionState,
  change: (data: SessionData) => Partial<SessionData>,
): SessionState {
  if (state.status !== 'ready') return state;
  return { status: 'ready', data: { ...state.data, ...change(state.data) } };
}
