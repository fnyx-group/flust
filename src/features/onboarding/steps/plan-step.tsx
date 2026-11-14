import { useTranslation } from 'react-i18next';

import { effectivePlan, triggerOptions, type Plan } from '@/domain/onboarding';
import { StepLayout } from '@/features/onboarding/step-layout';
import type { StepProps } from '@/features/onboarding/step-props';
import { PlanFields } from '@/features/shared/plan-fields';

export function PlanStep({
  answers,
  onChange,
  onType,
  onTypingEnd,
  progress,
  onBack,
  onContinue,
}: StepProps) {
  const { t } = useTranslation();

  return (
    <StepLayout
      progress={progress}
      title={t('onboarding.plan.title')}
      subtitle={t('onboarding.plan.subtitle')}
      onBack={onBack}
      action={{ label: t('onboarding.continue'), onPress: onContinue }}
    >
      <PlanFields
        plan={effectivePlan(answers)}
        triggers={triggerOptions(answers.riskMoments)}
        onChange={(plan: Plan) => onChange({ ...answers, plan })}
        onType={(plan: Plan) => onType({ ...answers, plan })}
        onTypingEnd={onTypingEnd}
      />
    </StepLayout>
  );
}
