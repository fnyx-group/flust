import {
  nextStep,
  previousStep,
  shownStep,
  stepProgress,
  type OnboardingStep,
} from '@/domain/onboarding';
import { filterOffered } from '@/features/filter/filter-native';
import type { StepProps } from '@/features/onboarding/step-props';
import { FilterStep } from '@/features/onboarding/steps/filter-step';
import { PlanStep } from '@/features/onboarding/steps/plan-step';
import { ReasonsStep } from '@/features/onboarding/steps/reasons-step';
import { RiskMomentsStep } from '@/features/onboarding/steps/risk-moments-step';
import { StartStep } from '@/features/onboarding/steps/start-step';
import { WelcomeStep } from '@/features/onboarding/steps/welcome-step';
import { useOnboardingDraft } from '@/features/onboarding/use-onboarding-draft';

// The stored step is the only navigation state: one route shows it, so a relaunch resumes on
// it, and going back works the same whether or not the earlier steps were shown in this session.
export function OnboardingScreen() {
  const { draft, change, type, flush } = useOnboardingDraft();
  const { answers } = draft;
  const hasFilter = filterOffered();
  const step = shownStep(draft.step, hasFilter);

  function goTo(target: OnboardingStep | null) {
    if (target !== null) change({ step: target, answers });
  }

  if (step === 'welcome') return <WelcomeStep onStart={() => goTo(nextStep(step, hasFilter))} />;

  const props: StepProps = {
    answers,
    progress: stepProgress(step, hasFilter),
    onChange: (next) => change({ step, answers: next }),
    onType: (next) => type({ step, answers: next }),
    onTypingEnd: flush,
    onBack: () => goTo(previousStep(step, hasFilter)),
    onContinue: () => goTo(nextStep(step, hasFilter)),
  };

  switch (step) {
    case 'reasons':
      return <ReasonsStep {...props} />;
    case 'risk-moments':
      return <RiskMomentsStep {...props} />;
    case 'plan':
      return <PlanStep {...props} />;
    case 'filter':
      return <FilterStep {...props} />;
    case 'start':
      return <StartStep {...props} />;
  }
}
