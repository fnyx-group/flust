import type { CheckInRepository } from '@/data/check-in-repository';
import { parseCheckInNote, type CheckIn, type Mood, type UrgeLevel } from '@/domain/check-in';
import { localDayNumber, type UtcOffsetAt } from '@/domain/local-time';
import type { RiskMomentId } from '@/domain/presets';
import { err, ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';

// The answers as the screen holds them: nothing is chosen until the user picks it.
export type CheckInDraft = {
  readonly mood: Mood | null;
  readonly urge: UrgeLevel | null;
  readonly context: readonly RiskMomentId[];
  readonly note: string;
};

export type CompleteDraft = CheckInDraft & { readonly mood: Mood; readonly urge: UrgeLevel };

export type SaveCheckInError = 'note-too-long' | 'save-failed';

export const SAVE_CHECK_IN_ERROR_MESSAGES = {
  'note-too-long': 'checkIn.errors.note-too-long',
  'save-failed': 'checkIn.errors.save-failed',
} as const satisfies Record<SaveCheckInError, string>;

export const EMPTY_DRAFT: CheckInDraft = { mood: null, urge: null, context: [], note: '' };

export function draftOf(checkIn: CheckIn | null): CheckInDraft {
  if (checkIn === null) return EMPTY_DRAFT;
  const { mood, urge, context, note } = checkIn;
  return { mood, urge, context, note: note ?? '' };
}

// Saving needs a mood and an urge level; the context and the note are optional.
export function isComplete(draft: CheckInDraft): draft is CompleteDraft {
  return draft.mood !== null && draft.urge !== null;
}

// The local day is chosen here, once, from the time of saving: a screen left open past midnight
// saves to the new day, and the previous day's check-in stays as it was.
export async function saveCheckIn(
  checkIns: Pick<CheckInRepository, 'save'>,
  draft: CompleteDraft,
  now: Timestamp,
  offsetAt: UtcOffsetAt,
): Promise<Result<CheckIn, SaveCheckInError>> {
  const note = parseCheckInNote(draft.note);
  if (!note.ok) return err('note-too-long');
  const saved = await checkIns.save(localDayNumber(now, offsetAt), now, {
    mood: draft.mood,
    urge: draft.urge,
    context: draft.context,
    note: note.value,
  });
  return saved.ok ? ok(saved.value) : err('save-failed');
}
