import { createContext, use } from 'react';

import type { Journey } from '@/domain/journey';
import type { OnboardingDraft } from '@/domain/onboarding';
import type { RankId } from '@/domain/ranks';

export type Session = {
  // Null until the onboarding is finished.
  readonly journey: Journey | null;
  // The onboarding draft found at launch; empty once a journey exists.
  readonly draft: OnboardingDraft;
  // Ranks stored as unlocked, which the rank shown can never fall below.
  readonly unlockedRanks: readonly RankId[];
  setJourney(journey: Journey): void;
  // Stores newly unlocked ranks and adds them to the session. Returns false when they were
  // already announced in this run, so the unlock screen is never shown twice for a rank.
  announceUnlock(ids: readonly RankId[]): boolean;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = use(SessionContext);
  if (session === null) throw new Error('useSession must be called below SessionGate.');
  return session;
}
