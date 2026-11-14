import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CUSTOM_TEXT_MAX_LENGTH, parseCustomText } from '@/domain/custom-text';
import { DEFAULT_PLAN, effectivePlan, triggerOptions, type Plan } from '@/domain/onboarding';
import { ACTION_IDS } from '@/domain/presets';
import { actionLabel, triggerLabel } from '@/features/onboarding/preset-labels';
import { StepLayout } from '@/features/onboarding/step-layout';
import type { StepProps } from '@/features/onboarding/step-props';
import { OptionSheet } from '@/ui/option-sheet';
import { RadioGroup } from '@/ui/radio-group';
import { SelectRow } from '@/ui/select-row';
import { TextEntryRow } from '@/ui/text-entry-row';
import { typography } from '@/ui/theme';

export function PlanStep({ answers, onChange, progress, onBack, onContinue }: StepProps) {
  const { t } = useTranslation();
  const plan = effectivePlan(answers);
  const [text, setText] = useState(() => (plan.action.kind === 'custom' ? plan.action.text : ''));
  const [choosingTrigger, setChoosingTrigger] = useState(false);

  function update(next: Partial<Plan>) {
    onChange({ ...answers, plan: { ...plan, ...next } });
  }

  // The custom action is chosen as soon as it holds text. Emptying it falls back to the default
  // action, so the plan always says what to do.
  function changeText(value: string) {
    setText(value);
    const parsed = parseCustomText(value);
    if (parsed.ok) update({ action: { kind: 'custom', text: parsed.value } });
    else if (plan.action.kind === 'custom') update({ action: DEFAULT_PLAN.action });
  }

  function selectCustom() {
    const parsed = parseCustomText(text);
    if (parsed.ok) update({ action: { kind: 'custom', text: parsed.value } });
  }

  return (
    <StepLayout
      progress={progress}
      title={t('onboarding.plan.title')}
      subtitle={t('onboarding.plan.subtitle')}
      onBack={onBack}
      action={{ label: t('onboarding.continue'), onPress: onContinue }}
    >
      <SelectRow
        prefix={t('onboarding.plan.if')}
        value={triggerLabel(t, plan.trigger)}
        accessibilityHint={t('onboarding.plan.triggerHint')}
        onPress={() => setChoosingTrigger(true)}
      />
      <View style={styles.then}>
        <Text style={styles.label}>{t('onboarding.plan.then')}</Text>
        <RadioGroup
          accessibilityLabel={t('onboarding.plan.then')}
          options={ACTION_IDS.map((id) => ({ key: id, label: actionLabel(t, id) }))}
          selected={plan.action.kind === 'preset' ? plan.action.id : null}
          onSelect={(id) => update({ action: { kind: 'preset', id } })}
        />
        <TextEntryRow
          label={t('onboarding.plan.custom')}
          value={text}
          maxLength={CUSTOM_TEXT_MAX_LENGTH}
          selected={plan.action.kind === 'custom'}
          onChangeText={changeText}
          onFocus={selectCustom}
        />
      </View>
      <OptionSheet
        visible={choosingTrigger}
        title={t('onboarding.plan.triggerTitle')}
        closeLabel={t('onboarding.back')}
        options={triggerOptions(answers.riskMoments).map((trigger) => ({
          key: trigger,
          label: triggerLabel(t, trigger),
        }))}
        selected={plan.trigger}
        onSelect={(trigger) => update({ trigger })}
        onClose={() => setChoosingTrigger(false)}
      />
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  then: {
    gap: 12,
  },
  label: {
    ...typography.label,
    paddingHorizontal: 4,
  },
});
