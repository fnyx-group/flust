import type { LapseRepository } from '@/data/lapse-repository';
import type { Journey } from '@/domain/journey';
import { logLapse, type LapseDetails, type LapseRecord, type LogLapseError } from '@/domain/lapse';
import { samePlan, type Plan } from '@/domain/onboarding';
import { err, ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';

export type RecordLapseError = LogLapseError | 'save-failed';

export const RECORD_LAPSE_ERROR_MESSAGES = {
  'lapse-in-future': 'lapse.errors.lapse-in-future',
  'lapse-before-last': 'lapse.errors.lapse-before-last',
  'lapse-before-start': 'lapse.errors.lapse-before-start',
  'invalid-timestamp': 'lapse.errors.invalid-timestamp',
  'save-failed': 'lapse.errors.save-failed',
} as const satisfies Record<RecordLapseError, string>;

export type LapseAnswers = {
  // Null for now.
  readonly at: Timestamp | null;
  // Null when the questions were skipped.
  readonly details: LapseDetails | null;
  readonly plan: { readonly current: Plan; readonly adjusted: Plan } | null;
};

// Skipping leaves out the place, the context and the plan change, but keeps a time the user chose.
export function skippedAnswers(at: Timestamp | null): LapseAnswers {
  return { at, details: null, plan: null };
}

export type RecordedLapse = { readonly journey: Journey; readonly record: LapseRecord };

// The new journey is only returned once the lapse is stored, so the session never shows a lapse
// that a relaunch would lose. A plan left as it was is not stored as a change.
export async function recordLapse(
  lapses: Pick<LapseRepository, 'record'>,
  journey: Journey,
  answers: LapseAnswers,
  now: Timestamp,
): Promise<Result<RecordedLapse, RecordLapseError>> {
  const at = answers.at ?? now;
  const logged = logLapse(journey, at, now);
  if (!logged.ok) return err(logged.error);
  const { plan } = answers;
  const planChange =
    plan === null || samePlan(plan.current, plan.adjusted)
      ? null
      : { previous: plan.current, next: plan.adjusted };
  const saved = await lapses.record({ at, recordedAt: now, details: answers.details, planChange });
  return saved.ok ? ok({ journey: logged.value, record: saved.value }) : err('save-failed');
}
