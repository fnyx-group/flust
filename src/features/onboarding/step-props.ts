import type { OnboardingAnswers, StepProgress } from '@/domain/onboarding';

export type StepProps = {
  answers: OnboardingAnswers;
  progress: StepProgress;
  // Saved at once.
  onChange: (answers: OnboardingAnswers) => void;
  // Saved once typing pauses, or when onTypingEnd is called.
  onType: (answers: OnboardingAnswers) => void;
  onTypingEnd: () => void;
  onBack: () => void;
  onContinue: () => void;
};
