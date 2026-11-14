import type { Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import type { Timestamp } from '@/domain/time';
import type { UrgeVisit } from '@/features/emergency/urge-visit';
import type { RecordedLapse } from '@/features/lapse/record-lapse';

export type AfterSave = {
  setLapses(journey: Journey, latestLapse: LapseRecord | null): void;
  close(): void;
};

export type LapseExit = {
  saved(recorded: RecordedLapse, at: Timestamp, after: AfterSave): void;
  // The screen was removed, after a save or by going back.
  removed(at: Timestamp): void;
};

// `visit` is the emergency visit that led to the lapse screen, if any. It ends as a lapse once
// the lapse is saved, or as closed when the user goes back without saving; the removal that
// follows a save keeps the first outcome. The session gets the lapse before the screen closes:
// Home takes the focus back as it closes and must already know about the lapse, so that no rank
// unlock screen opens over it.
export function createLapseExit(visit: UrgeVisit | null): LapseExit {
  return {
    saved({ journey, record }, at, { setLapses, close }) {
      void visit?.finish('lapse', at);
      setLapses(journey, record);
      close();
    },
    removed(at) {
      void visit?.finish('closed', at);
    },
  };
}
