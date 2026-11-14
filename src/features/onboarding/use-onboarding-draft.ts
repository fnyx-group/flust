import { useEffect, useState } from 'react';

import { EMPTY_DRAFT, type OnboardingDraft } from '@/domain/onboarding';
import { useStorage } from '@/features/storage/storage-context';

// Every change is saved at once, so a kill in the background never loses an answer. A draft that
// cannot be read starts the onboarding over rather than blocking it.
export function useOnboardingDraft() {
  const storage = useStorage();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  useEffect(() => {
    let active = true;
    storage.onboarding.loadDraft().then((result) => {
      if (active) setDraft(result.ok ? result.value : EMPTY_DRAFT);
    });
    return () => {
      active = false;
    };
  }, [storage]);

  function update(next: OnboardingDraft) {
    setDraft(next);
    void storage.onboarding.saveDraft(next);
  }

  return { draft, update };
}
