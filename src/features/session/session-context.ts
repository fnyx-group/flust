import { createContext, use } from 'react';

import type { CheckIn } from '@/domain/check-in';
import type { Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import type { OnboardingDraft } from '@/domain/onboarding';
import type { RankId } from '@/domain/ranks';

export type Session = {
  // Null until the onboarding is finished.
  readonly journey: Journey | null;
  // The onboarding draft found at launch; empty once a journey exists.
  readonly draft: OnboardingDraft;
  // Ranks stored as unlocked, which the rank shown can never fall below.
  readonly unlockedRanks: readonly RankId[];
  // The last lapse logged, for undo and the hours that follow it.
  readonly latestLapse: LapseRecord | null;
  // Check-ins of the low mood window at launch and those saved since, the latest day first.
  readonly checkIns: readonly CheckIn[];
  // The local day the low mood card was last closed on.
  readonly lowMoodDismissedDay: number | null;
  setJourney(journey: Journey): void;
  // Called once a lapse is stored or undone, with the journey and the last lapse that follow.
  setLapses(journey: Journey, latestLapse: LapseRecord | null): void;
  // Stores newly unlocked ranks and adds them to the session. Returns false when they were
  // already announced in this run, so the unlock screen is never shown twice for a rank.
  announceUnlock(ids: readonly RankId[]): boolean;
  // Called once a check-in is stored, with the check-in as stored.
  setCheckIn(checkIn: CheckIn): void;
  dismissLowMood(day: number): void;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = use(SessionContext);
  if (session === null) throw new Error('useSession must be called below SessionGate.');
  return session;
}
