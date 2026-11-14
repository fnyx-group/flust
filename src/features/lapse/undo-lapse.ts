import type { LapseRepository } from '@/data/lapse-repository';
import { removeLapse, type Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import { err, ok, type Result } from '@/domain/result';

export type UndoneLapse = { readonly journey: Journey; readonly latestLapse: LapseRecord | null };

// The streak, the total and the week strip come back on their own once the lapse is gone from
// the journey: they are computed from its timestamps. Ranks are left as they are, since logging
// a lapse never changes them. A lapse already gone from storage, after a second tap, counts as
// undone.
export async function undoLapse(
  lapses: Pick<LapseRepository, 'undo' | 'latest'>,
  journey: Journey,
  record: LapseRecord,
): Promise<Result<UndoneLapse, 'undo-failed'>> {
  const restored = removeLapse(journey, record.at);
  if (!restored.ok) return err('undo-failed');
  const undone = await lapses.undo(record.id);
  if (!undone.ok && undone.error !== 'lapse-not-found') return err('undo-failed');
  // The lapse is gone whatever happens next: an unreadable previous lapse only hides its undo.
  const latest = await lapses.latest();
  return ok({ journey: restored.value, latestLapse: latest.ok ? latest.value : null });
}
