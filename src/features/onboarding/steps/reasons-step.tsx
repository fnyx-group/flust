import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CUSTOM_TEXT_MAX_LENGTH, parseCustomText } from '@/domain/custom-text';
import {
  customReason,
  setCustomReason,
  toggleReason,
  type OnboardingAnswers,
} from '@/domain/onboarding';
import { REASON_IDS } from '@/domain/presets';
import { reasonLabel } from '@/features/onboarding/preset-labels';
import type { StepProps } from '@/features/onboarding/step-props';
import { StepLayout } from '@/features/onboarding/step-layout';
import { ChipList } from '@/ui/chip-list';
import { TextEntryRow } from '@/ui/text-entry-row';

export function ReasonsStep({ answers, onChange, progress, onBack, onContinue }: StepProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => customReason(answers.reasons) ?? '');
  const selected = answers.reasons.flatMap((reason) =>
    reason.kind === 'preset' ? [reason.id] : [],
  );

  function update(reasons: OnboardingAnswers['reasons']) {
    onChange({ ...answers, reasons });
  }

  function changeText(value: string) {
    setText(value);
    const parsed = parseCustomText(value);
    update(setCustomReason(answers.reasons, parsed.ok ? parsed.value : null));
  }

  return (
    <StepLayout
      progress={progress}
      title={t('onboarding.reasons.title')}
      subtitle={t('onboarding.reasons.subtitle')}
      onBack={onBack}
      action={{ label: t('onboarding.continue'), onPress: onContinue }}
    >
      <ChipList
        items={REASON_IDS.map((id) => ({
          key: id,
          label: reasonLabel(t, id),
          selected: selected.includes(id),
        }))}
        onToggle={(id) => update(toggleReason(answers.reasons, id))}
      />
      <TextEntryRow
        label={t('onboarding.reasons.custom')}
        value={text}
        maxLength={CUSTOM_TEXT_MAX_LENGTH}
        onChangeText={changeText}
      />
    </StepLayout>
  );
}
