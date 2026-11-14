import type { LoadJourneyError } from '@/data/journey-repository';
import type { OnboardingStorageError } from '@/data/onboarding-repository';
import type { Storage } from '@/data/open-storage';
import type { Journey } from '@/domain/journey';
import { EMPTY_DRAFT, type OnboardingDraft } from '@/domain/onboarding';
import { err, ok, type Result } from '@/domain/result';
import { i18n } from '@/lib/i18n';
import { isLanguage } from '@/lib/i18n/language';

export type SessionData = { readonly journey: Journey | null; readonly draft: OnboardingDraft };

export type LoadSessionError = LoadJourneyError | OnboardingStorageError;

// A language that cannot be read, or that the app does not know, leaves the device language in
// place: it never blocks startup. Journey errors are passed on unchanged, because a corrupted
// journey and a storage failure lead to different screens. The draft is only read while there is
// no journey, since the onboarding never shows again afterwards.
export async function loadSession(
  storage: Storage,
): Promise<Result<SessionData, LoadSessionError>> {
  const language = await storage.settings.loadLanguage();
  if (language.ok && isLanguage(language.value)) await i18n.changeLanguage(language.value);
  const journey = await storage.journey.load();
  if (!journey.ok) return err(journey.error);
  if (journey.value !== null) return ok({ journey: journey.value, draft: EMPTY_DRAFT });
  const draft = await storage.onboarding.loadDraft();
  return draft.ok ? ok({ journey: null, draft: draft.value }) : err(draft.error);
}
