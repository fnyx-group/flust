import type { OnboardingRepository } from '@/data/onboarding-repository';
import type { CreateJourneyError, Journey } from '@/domain/journey';
import { finishOnboarding, type OnboardingAnswers } from '@/domain/onboarding';
import { err, ok, type Result } from '@/domain/result';

export type FinishError = CreateJourneyError | 'save-failed';

export const FINISH_ERROR_MESSAGES = {
  'start-in-future': 'onboarding.start.errors.start-in-future',
  'invalid-timestamp': 'onboarding.start.errors.invalid-timestamp',
  'save-failed': 'onboarding.start.errors.save-failed',
} as const satisfies Record<FinishError, string>;

// The journey is only returned once it and every answer are stored, so the session never moves
// to the tabs with answers that were lost.
export async function finish(
  onboarding: Pick<OnboardingRepository, 'complete'>,
  answers: OnboardingAnswers,
  now: number,
): Promise<Result<Journey, FinishError>> {
  const result = finishOnboarding(answers, now);
  if (!result.ok) return err(result.error);
  const saved = await onboarding.complete(result.value);
  return saved.ok ? ok(result.value.journey) : err('save-failed');
}
