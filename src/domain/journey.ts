import { err, ok, type Result } from '@/domain/result';
import { isValidTimestamp, type Timestamp } from '@/domain/time';

declare const journeyBrand: unique symbol;

// Branded so that only the functions below can produce a Journey: streak calculations rely on
// lapses being sorted and never before the start, and a wrong total would unlock ranks for good.
export type Journey = {
  readonly start: Timestamp;
  readonly lapses: readonly Timestamp[];
  readonly [journeyBrand]: true;
};

export type CreateJourneyError = 'invalid-timestamp' | 'start-in-future';
export type AddLapseError = 'invalid-timestamp' | 'lapse-before-start' | 'lapse-in-future';
export type RestoreJourneyError = 'invalid-timestamp' | 'lapse-before-start';
export type RemoveLapseError = 'lapse-not-found';

export function createJourney(
  start: Timestamp,
  now: Timestamp,
): Result<Journey, CreateJourneyError> {
  if (!isValidTimestamp(start) || !isValidTimestamp(now)) return err('invalid-timestamp');
  if (start > now) return err('start-in-future');
  return ok(toJourney(start, []));
}

// Stored lapses are not compared with now: a clock that is currently behind must not
// make previously valid data unreadable.
export function restoreJourney(
  start: Timestamp,
  lapses: readonly Timestamp[],
): Result<Journey, RestoreJourneyError> {
  if (!isValidTimestamp(start) || !lapses.every(isValidTimestamp)) {
    return err('invalid-timestamp');
  }
  if (lapses.some((lapse) => lapse < start)) return err('lapse-before-start');
  return ok(
    toJourney(
      start,
      [...lapses].sort((a, b) => a - b),
    ),
  );
}

export function addLapse(
  journey: Journey,
  at: Timestamp,
  now: Timestamp,
): Result<Journey, AddLapseError> {
  if (!isValidTimestamp(at) || !isValidTimestamp(now)) return err('invalid-timestamp');
  if (at < journey.start) return err('lapse-before-start');
  if (at > now) return err('lapse-in-future');
  const index = insertionIndex(journey.lapses, at);
  return ok(
    toJourney(journey.start, [
      ...journey.lapses.slice(0, index),
      at,
      ...journey.lapses.slice(index),
    ]),
  );
}

export function removeLapse(journey: Journey, at: Timestamp): Result<Journey, RemoveLapseError> {
  const index = journey.lapses.indexOf(at);
  if (index === -1) return err('lapse-not-found');
  return ok(
    toJourney(journey.start, [
      ...journey.lapses.slice(0, index),
      ...journey.lapses.slice(index + 1),
    ]),
  );
}

// The only cast of the brand. Callers have already checked that lapses are sorted and valid.
function toJourney(start: Timestamp, sortedLapses: readonly Timestamp[]): Journey {
  return { start, lapses: sortedLapses } as Journey;
}

function insertionIndex(sorted: readonly Timestamp[], value: Timestamp): number {
  const index = sorted.findIndex((existing) => existing > value);
  return index === -1 ? sorted.length : index;
}
