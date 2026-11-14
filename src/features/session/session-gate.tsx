import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import type { Journey } from '@/domain/journey';
import { withUnlocked, type RankId } from '@/domain/ranks';
import { createUnlockAnnouncer } from '@/features/ranks/unlock-announcer';
import { loadSession, type SessionData } from '@/features/session/load-session';
import { SessionContext } from '@/features/session/session-context';
import { useReportStorageFailure, useStorage } from '@/features/storage/storage-context';

type SessionState = { status: 'loading' } | { status: 'ready'; data: SessionData };

// Loads what decides the first screen, the journey, the onboarding draft and the chosen language,
// before hiding the splash screen, so nothing blank or wrong flashes before the first screen. A
// failure goes to StorageGate, which shows the retry or reset screen it calls for.
export function SessionGate({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const reportFailure = useReportStorageFailure();
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [announcer] = useState(() =>
    createUnlockAnnouncer({
      persist: (ids) => storage.ranks.unlock(ids),
      addToSession: (ids) => setState((previous) => addUnlocked(previous, ids)),
    }),
  );

  useEffect(() => {
    let active = true;
    loadSession(storage).then((result) => {
      if (!active) return;
      if (result.ok) setState({ status: 'ready', data: result.value });
      else reportFailure(result.error);
    });
    return () => {
      active = false;
    };
  }, [storage, reportFailure]);

  useEffect(() => {
    if (state.status === 'ready') SplashScreen.hideAsync();
  }, [state.status]);

  if (state.status === 'loading') return null;

  const { data } = state;
  const session = {
    journey: data.journey,
    draft: data.draft,
    unlockedRanks: data.unlockedRanks,
    setJourney: (journey: Journey) => setState({ status: 'ready', data: { ...data, journey } }),
    announceUnlock: announcer.announce,
  };
  return <SessionContext value={session}>{children}</SessionContext>;
}

function addUnlocked(state: SessionState, ids: readonly RankId[]): SessionState {
  if (state.status !== 'ready') return state;
  const unlockedRanks = withUnlocked(state.data.unlockedRanks, ids);
  return { status: 'ready', data: { ...state.data, unlockedRanks } };
}
