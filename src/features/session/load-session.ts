import type { CheckInStorageError } from '@/data/check-in-repository';
import type { LoadJourneyError } from '@/data/journey-repository';
import type { LapseStorageError } from '@/data/lapse-repository';
import type { OnboardingStorageError } from '@/data/onboarding-repository';
import type { RankStorageError } from '@/data/rank-repository';
import type { Storage } from '@/data/open-storage';
import { lowMoodWindowStart, type CheckIn } from '@/domain/check-in';
import type { Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import { EMPTY_DRAFT, type OnboardingDraft } from '@/domain/onboarding';
import type { RankId } from '@/domain/ranks';
import { err, ok, type Result } from '@/domain/result';
import { i18n } from '@/lib/i18n';
import { isLanguage } from '@/lib/i18n/language';

export type SessionData = {
  readonly journey: Journey | null;
  readonly draft: OnboardingDraft;
  readonly unlockedRanks: readonly RankId[];
  readonly latestLapse: LapseRecord | null;
  readonly checkIns: readonly CheckIn[];
  readonly lowMoodDismissedDay: number | null;
};

export type LoadSessionError =
  | LoadJourneyError
  | OnboardingStorageError
  | RankStorageError
  | LapseStorageError
  | CheckInStorageError;

const NO_CHECK_INS = { checkIns: [], lowMoodDismissedDay: null } as const;

// A language that cannot be read, or that the app does not know, leaves the device language in
// place: it never blocks startup. Journey errors are passed on unchanged, because a corrupted
// journey and a storage failure lead to different screens. The draft is only read while there is
// no journey, since the onboarding never shows again afterwards. Unlocked ranks are read with the
// journey because a backdated lapse can lower the total below a rank that must be kept. The last
// lapse logged decides whether home offers to undo it and holds rank unlocks for a while.
// Check-ins are read from the start of the low mood window of `today`, the local day at launch:
// the window only moves forward, so check-ins saved later are added by the session. A low mood
// dismissal that cannot be read only shows the card again.
export async function loadSession(
  storage: Storage,
  today: number,
): Promise<Result<SessionData, LoadSessionError>> {
  const language = await storage.settings.loadLanguage();
  if (language.ok && isLanguage(language.value)) await i18n.changeLanguage(language.value);
  const journey = await storage.journey.load();
  if (!journey.ok) return err(journey.error);
  if (journey.value !== null) {
    const unlockedRanks = await storage.ranks.loadUnlocked();
    if (!unlockedRanks.ok) return err(unlockedRanks.error);
    const latestLapse = await storage.lapses.latest();
    if (!latestLapse.ok) return err(latestLapse.error);
    const checkIns = await storage.checkIns.since(lowMoodWindowStart(today));
    if (!checkIns.ok) return err(checkIns.error);
    const dismissed = await storage.settings.loadLowMoodDismissedDay();
    return ok({
      journey: journey.value,
      draft: EMPTY_DRAFT,
      unlockedRanks: unlockedRanks.value,
      latestLapse: latestLapse.value,
      checkIns: checkIns.value,
      lowMoodDismissedDay: dismissed.ok ? dismissed.value : null,
    });
  }
  const draft = await storage.onboarding.loadDraft();
  return draft.ok
    ? ok({
        journey: null,
        draft: draft.value,
        unlockedRanks: [],
        latestLapse: null,
        ...NO_CHECK_INS,
      })
    : err(draft.error);
}
