import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { OnboardingDraft } from '@/domain/onboarding';
import { createDraftSaver } from '@/features/onboarding/draft-saver';
import { useSession } from '@/features/session/session-context';
import { useStorage } from '@/features/storage/storage-context';

// The draft was read with the session, before the splash screen hid. A failed save is not shown:
// the answers stay on screen, the next change saves them all again, and finishing writes them in
// its own transaction, which does report failures.
export function useOnboardingDraft() {
  const storage = useStorage();
  const session = useSession();
  const [draft, setDraft] = useState(session.draft);
  const [saver] = useState(() =>
    createDraftSaver((next) => {
      void storage.onboarding.saveDraft(next);
    }),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saver.flush();
    });
    return () => {
      subscription.remove();
      saver.flush();
    };
  }, [saver]);

  return {
    draft,
    change(next: OnboardingDraft) {
      setDraft(next);
      saver.saveNow(next);
    },
    type(next: OnboardingDraft) {
      setDraft(next);
      saver.saveSoon(next);
    },
    flush: saver.flush,
  };
}
