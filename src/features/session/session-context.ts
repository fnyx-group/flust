import { createContext, use } from 'react';

import type { Journey } from '@/domain/journey';
import type { OnboardingDraft } from '@/domain/onboarding';

export type Session = {
  // Null until the onboarding is finished.
  readonly journey: Journey | null;
  // The onboarding draft found at launch; empty once a journey exists.
  readonly draft: OnboardingDraft;
  setJourney(journey: Journey): void;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = use(SessionContext);
  if (session === null) throw new Error('useSession must be called below SessionGate.');
  return session;
}
