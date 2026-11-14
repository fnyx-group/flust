import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import {
  nextStep,
  previousStep,
  stepProgress,
  type OnboardingAnswers,
  type OnboardingDraft,
  type OnboardingStep,
} from '@/domain/onboarding';
import { PlanStep } from '@/features/onboarding/steps/plan-step';
import { ReasonsStep } from '@/features/onboarding/steps/reasons-step';
import { RiskMomentsStep } from '@/features/onboarding/steps/risk-moments-step';
import { StartStep } from '@/features/onboarding/steps/start-step';
import { WelcomeStep } from '@/features/onboarding/steps/welcome-step';
import { useOnboardingDraft } from '@/features/onboarding/use-onboarding-draft';

export function OnboardingScreen() {
  const { draft, update } = useOnboardingDraft();
  if (draft === null) return null;
  return <OnboardingSteps draft={draft} update={update} />;
}

type OnboardingStepsProps = {
  draft: OnboardingDraft;
  update: (draft: OnboardingDraft) => void;
};

// The stored step is the only navigation state: one route shows it, so a relaunch resumes on
// it, and going back works the same whether or not the earlier steps were shown in this session.
function OnboardingSteps({ draft, update }: OnboardingStepsProps) {
  const { step, answers } = draft;

  useEffect(() => {
    const previous = previousStep(step);
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (previous === null) return false;
      update({ step: previous, answers });
      return true;
    });
    return () => subscription.remove();
  }, [step, answers, update]);

  function goTo(target: OnboardingStep | null) {
    if (target !== null) update({ step: target, answers });
  }

  if (step === 'welcome') return <WelcomeStep onStart={() => goTo(nextStep(step))} />;

  const props = {
    answers,
    onChange: (next: OnboardingAnswers) => update({ step, answers: next }),
    progress: stepProgress(step) ?? { current: 1, total: 1 },
    onBack: () => goTo(previousStep(step)),
    onContinue: () => goTo(nextStep(step)),
  };

  switch (step) {
    case 'reasons':
      return <ReasonsStep key={step} {...props} />;
    case 'risk-moments':
      return <RiskMomentsStep key={step} {...props} />;
    case 'plan':
      return <PlanStep key={step} {...props} />;
    case 'start':
      return <StartStep key={step} {...props} />;
  }
}
