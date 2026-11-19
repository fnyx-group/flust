import { useEffect, useState, type ReactNode } from 'react';

import { localDayNumber } from '@/domain/local-time';
import { useFirstScreenShown } from '@/features/errors/launch-context';
import { createUnlockAnnouncer } from '@/features/ranks/unlock-announcer';
import { loadSession } from '@/features/session/load-session';
import { SessionContext } from '@/features/session/session-context';
import { sessionSetters, type SessionState } from '@/features/session/session-state';
import { useFollowDeviceLanguage } from '@/features/session/use-follow-device-language';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { useReportStorageFailure, useStorage } from '@/features/storage/storage-context';

// Loads what decides the first screen, the journey, the onboarding draft and the chosen language,
// before hiding the splash screen, so nothing blank or wrong flashes before the first screen. A
// failure goes to StorageGate, which shows the retry or reset screen it calls for.
export function SessionGate({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const reportFailure = useReportStorageFailure();
  const firstScreenShown = useFirstScreenShown();
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [setters] = useState(() => sessionSetters(setState));
  const [announcer] = useState(() =>
    createUnlockAnnouncer({
      persist: (ids) => storage.ranks.unlock(ids),
      addToSession: setters.addUnlocked,
    }),
  );

  useFollowDeviceLanguage(storage.settings);

  useEffect(() => {
    let active = true;
    // loadSession turns every error into a Result, so this never rejects.
    void loadSession(storage, localDayNumber(Date.now(), deviceOffsetAt)).then((result) => {
      if (!active) return;
      if (result.ok) setState({ status: 'ready', data: result.value });
      else reportFailure(result.error);
    });
    return () => {
      active = false;
    };
  }, [storage, reportFailure]);

  useEffect(() => {
    if (state.status === 'ready') firstScreenShown();
  }, [state.status, firstScreenShown]);

  if (state.status === 'loading') return null;

  const { data } = state;
  const session = {
    journey: data.journey,
    draft: data.draft,
    unlockedRanks: data.unlockedRanks,
    latestLapse: data.latestLapse,
    checkIns: data.checkIns,
    lowMoodDismissedDay: data.lowMoodDismissedDay,
    setJourney: setters.setJourney,
    setLapses: setters.setLapses,
    announceUnlock: announcer.announce,
    setCheckIn: setters.setCheckIn,
    dismissLowMood: setters.dismissLowMood,
  };
  return <SessionContext value={session}>{children}</SessionContext>;
}
