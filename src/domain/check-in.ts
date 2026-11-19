import { isOneOf } from '@/domain/guards';
import { isRiskMomentId, type RiskMomentId } from '@/domain/presets';
import { err, ok, type Result } from '@/domain/result';
import { isTimestamp, type Timestamp } from '@/domain/time';

export const MOODS = [1, 2, 3, 4, 5] as const;
export type Mood = (typeof MOODS)[number];
export const isMood = isOneOf(MOODS);

// Ids are stored on the device and translated on display, so a released id is never renamed.
export const URGE_LEVELS = ['none', 'light', 'strong', 'intense'] as const;
export type UrgeLevel = (typeof URGE_LEVELS)[number];
export const isUrgeLevel = isOneOf(URGE_LEVELS);

declare const noteBrand: unique symbol;

// The optional note, trimmed, with its line breaks kept.
export type CheckInNote = string & { readonly [noteBrand]: true };

export const CHECK_IN_NOTE_MAX_LENGTH = 500;

export type CheckInAnswers = {
  readonly mood: Mood;
  readonly urge: UrgeLevel;
  // Risk moment ids, like the lapse context, so patterns can be matched across both.
  readonly context: readonly RiskMomentId[];
  readonly note: CheckInNote | null;
};

// `day` is the local day number (see localDayNumber) at the first save. It is stored and never
// recomputed from a timestamp, so a check-in stays on its day when the time zone changes.
export type CheckIn = CheckInAnswers & {
  readonly day: number;
  readonly recordedAt: Timestamp;
  readonly updatedAt: Timestamp;
};

// A check-in as read back from storage, with the context already parsed from JSON.
export type StoredCheckIn = {
  readonly day: unknown;
  readonly recordedAt: unknown;
  readonly updatedAt: unknown;
  readonly mood: unknown;
  readonly urge: unknown;
  readonly context: unknown;
  readonly note: unknown;
};

// The length is counted in code points, like CustomText. An empty note is no note.
export function parseCheckInNote(raw: string): Result<CheckInNote | null, 'too-long'> {
  const text = raw.trim();
  if (text.length === 0) return ok(null);
  if ([...text].length > CHECK_IN_NOTE_MAX_LENGTH) return err('too-long');
  return ok(text as CheckInNote);
}

export function parseCheckIn(stored: StoredCheckIn): Result<CheckIn, 'invalid-check-in'> {
  const { day, recordedAt, updatedAt, mood, urge } = stored;
  const context = parseContext(stored.context);
  const note = parseStoredNote(stored.note);
  if (
    typeof day !== 'number' ||
    !Number.isSafeInteger(day) ||
    !isTimestamp(recordedAt) ||
    !isTimestamp(updatedAt) ||
    !isMood(mood) ||
    !isUrgeLevel(urge) ||
    context === null ||
    note === undefined
  ) {
    return err('invalid-check-in');
  }
  return ok({ day, recordedAt, updatedAt, mood, urge, context, note });
}

// Undefined when the note cannot be valid, since null already means no note.
function parseStoredNote(value: unknown): CheckInNote | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const note = parseCheckInNote(value);
  return note.ok ? note.value : undefined;
}

function parseContext(value: unknown): RiskMomentId[] | null {
  if (!Array.isArray(value)) return null;
  const ids: unknown[] = value;
  if (!ids.every(isRiskMomentId) || new Set(ids).size !== ids.length) return null;
  return ids;
}

export function todaysCheckIn(checkIns: readonly CheckIn[], today: number): CheckIn | null {
  return checkIns.find((checkIn) => checkIn.day === today) ?? null;
}

// Replaces the check-in of the same day, and keeps the most recent day first.
export function withCheckIn(checkIns: readonly CheckIn[], checkIn: CheckIn): CheckIn[] {
  return [...checkIns.filter((other) => other.day !== checkIn.day), checkIn].sort(
    (a, b) => b.day - a.day,
  );
}

const LOW_MOOD_MAX: Mood = 2;
const LOW_MOOD_RUN = 3;
const LOW_MOOD_WINDOW_DAYS = 14;

// The first local day of the window the low mood rule looks at, today included.
export function lowMoodWindowStart(today: number): number {
  return today - (LOW_MOOD_WINDOW_DAYS - 1);
}

// The three most recent check-ins of the last 14 local days are all low. Missed days never break
// the run, since missed check-ins are not failures; check-ins older than the window no longer
// count, so a hard week long past does not keep the card coming back. Days after today, left by
// a clock set back, are ignored.
export function hasLowMoodRun(checkIns: readonly CheckIn[], today: number): boolean {
  const first = lowMoodWindowStart(today);
  const recent = checkIns
    .filter((checkIn) => checkIn.day >= first && checkIn.day <= today)
    .sort((a, b) => b.day - a.day)
    .slice(0, LOW_MOOD_RUN);
  return recent.length === LOW_MOOD_RUN && recent.every((checkIn) => checkIn.mood <= LOW_MOOD_MAX);
}

// Closing the card hides it until the next local day.
export function showLowMoodCard(
  checkIns: readonly CheckIn[],
  today: number,
  dismissedDay: number | null,
): boolean {
  return dismissedDay !== today && hasLowMoodRun(checkIns, today);
}
