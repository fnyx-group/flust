import { useTranslation } from 'react-i18next';

import { toggleRiskMoment } from '@/domain/onboarding';
import { RISK_MOMENT_IDS } from '@/domain/presets';
import { riskMomentLabel } from '@/features/onboarding/preset-labels';
import { StepLayout } from '@/features/onboarding/step-layout';
import type { StepProps } from '@/features/onboarding/step-props';
import { ChipList } from '@/ui/chip-list';

type RiskMomentsStepProps = Pick<
  StepProps,
  'answers' | 'onChange' | 'progress' | 'onBack' | 'onContinue'
>;

export function RiskMomentsStep({
  answers,
  onChange,
  progress,
  onBack,
  onContinue,
}: RiskMomentsStepProps) {
  const { t } = useTranslation();
  return (
    <StepLayout
      progress={progress}
      title={t('onboarding.riskMoments.title')}
      subtitle={t('onboarding.riskMoments.subtitle')}
      onBack={onBack}
      action={{ label: t('onboarding.continue'), onPress: onContinue }}
    >
      <ChipList
        items={RISK_MOMENT_IDS.map((id) => ({
          key: id,
          label: riskMomentLabel(t, id),
          selected: answers.riskMoments.includes(id),
        }))}
        onToggle={(id) =>
          onChange({ ...answers, riskMoments: toggleRiskMoment(answers.riskMoments, id) })
        }
      />
    </StepLayout>
  );
}
