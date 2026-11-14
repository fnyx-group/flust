import type { OnboardingAnswers } from '@/domain/onboarding';

export type StepProps = {
  answers: OnboardingAnswers;
  onChange: (answers: OnboardingAnswers) => void;
  progress: { current: number; total: number };
  onBack: () => void;
  onContinue: () => void;
};
