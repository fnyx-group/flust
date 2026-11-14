import type { OnboardingDraft } from '@/domain/onboarding';

export type DraftSaver = {
  saveNow(draft: OnboardingDraft): void;
  saveSoon(draft: OnboardingDraft): void;
  flush(): void;
};

export const TYPING_SAVE_DELAY_MS = 300;

// A tap is saved at once. Typing is saved when it pauses, and whatever is still waiting is saved
// when the field loses focus, the app leaves the foreground or the onboarding goes away, so a
// kill in the background loses nothing.
export function createDraftSaver(
  save: (draft: OnboardingDraft) => void,
  delayMs = TYPING_SAVE_DELAY_MS,
): DraftSaver {
  let pending: OnboardingDraft | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (pending === null) return;
    const draft = pending;
    pending = null;
    save(draft);
  }

  return {
    saveNow(draft) {
      pending = draft;
      flush();
    },
    saveSoon(draft) {
      pending = draft;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}
