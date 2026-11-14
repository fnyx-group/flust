import { err, ok, type Result } from '@/domain/result';
import { isValidTimestamp, type Timestamp } from '@/domain/time';

export type Journey = {
  readonly start: Timestamp;
  readonly lapses: readonly Timestamp[];
};

export type JourneyError = 'invalid-timestamp' | 'start-in-future';
export type LapseError = 'invalid-timestamp' | 'lapse-before-start' | 'lapse-in-future';
export type RestoreError = 'invalid-timestamp' | 'lapse-before-start';
export type UndoError = 'lapse-not-found';

export function createJourney(start: Timestamp, now: Timestamp): Result<Journey, JourneyError> {
  if (!isValidTimestamp(start) || !isValidTimestamp(now)) return err('invalid-timestamp');
  if (start > now) return err('start-in-future');
  return ok({ start, lapses: [] });
}

// Stored lapses are not compared with now: a clock that is currently behind must not
// make previously valid data unreadable.
export function restoreJourney(
  start: Timestamp,
  lapses: readonly Timestamp[],
): Result<Journey, RestoreError> {
  if (!isValidTimestamp(start) || !lapses.every(isValidTimestamp)) {
    return err('invalid-timestamp');
  }
  if (lapses.some((lapse) => lapse < start)) return err('lapse-before-start');
  return ok({ start, lapses: [...lapses].sort((a, b) => a - b) });
}

export function addLapse(
  journey: Journey,
  at: Timestamp,
  now: Timestamp,
): Result<Journey, LapseError> {
  if (!isValidTimestamp(at) || !isValidTimestamp(now)) return err('invalid-timestamp');
  if (at < journey.start) return err('lapse-before-start');
  if (at > now) return err('lapse-in-future');
  const index = insertionIndex(journey.lapses, at);
  return ok({
    start: journey.start,
    lapses: [...journey.lapses.slice(0, index), at, ...journey.lapses.slice(index)],
  });
}

export function removeLapse(journey: Journey, at: Timestamp): Result<Journey, UndoError> {
  const index = journey.lapses.indexOf(at);
  if (index === -1) return err('lapse-not-found');
  return ok({
    start: journey.start,
    lapses: [...journey.lapses.slice(0, index), ...journey.lapses.slice(index + 1)],
  });
}

function insertionIndex(sorted: readonly Timestamp[], value: Timestamp): number {
  const index = sorted.findIndex((existing) => existing > value);
  return index === -1 ? sorted.length : index;
}
