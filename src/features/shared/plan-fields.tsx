import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CUSTOM_TEXT_MAX_LENGTH, parseCustomText } from '@/domain/custom-text';
import { DEFAULT_PLAN, type Plan } from '@/domain/onboarding';
import { ACTION_IDS, type PlanTrigger } from '@/domain/presets';
import { actionLabel, planCondition, planSentence } from '@/features/shared/preset-labels';
import { NavRow } from '@/ui/nav-row';
import { OptionSheet } from '@/ui/option-sheet';
import { RadioGroup } from '@/ui/radio-group';
import { RowGroup } from '@/ui/row-group';
import { SectionLabel } from '@/ui/section-label';
import { TextEntryRow } from '@/ui/text-entry-row';
import { colors, radii, spacing, typography } from '@/ui/theme';

type PlanFieldsProps = {
  plan: Plan;
  triggers: readonly PlanTrigger[];
  onChange: (plan: Plan) => void;
  // Called instead of onChange while the user types, so that a caller can save less often.
  onType?: (plan: Plan) => void;
  onTypingEnd?: () => void;
};

// The "If ... then ..." editor of the onboarding and the lapse screen.
export function PlanFields({
  plan,
  triggers,
  onChange,
  onType = onChange,
  onTypingEnd,
}: PlanFieldsProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => (plan.action.kind === 'custom' ? plan.action.text : ''));
  const [choosingTrigger, setChoosingTrigger] = useState(false);
  const customSelected = plan.action.kind === 'custom';

  function update(next: Partial<Plan>, save: (plan: Plan) => void = onChange) {
    save({ ...plan, ...next });
  }

  // The custom action is chosen as soon as it holds text. Emptying it falls back to the default
  // action, so the plan always says what to do.
  function changeText(value: string) {
    setText(value);
    const parsed = parseCustomText(value);
    if (parsed.ok) update({ action: { kind: 'custom', text: parsed.value } }, onType);
    else if (customSelected) update({ action: DEFAULT_PLAN.action }, onType);
  }

  function selectCustom() {
    const parsed = parseCustomText(text);
    if (parsed.ok) update({ action: { kind: 'custom', text: parsed.value } });
  }

  return (
    <>
      <View style={styles.field}>
        <SectionLabel color={colors.gold}>{t('onboarding.plan.if')}</SectionLabel>
        <RowGroup>
          <NavRow
            label={planCondition(t, plan.trigger)}
            accessibilityLabel={t('onboarding.plan.ifSpoken', {
              condition: planCondition(t, plan.trigger),
            })}
            accessibilityHint={t('onboarding.plan.triggerHint')}
            onPress={() => setChoosingTrigger(true)}
          />
        </RowGroup>
      </View>
      <View style={styles.field}>
        <SectionLabel color={colors.teal}>{t('onboarding.plan.then')}</SectionLabel>
        <RadioGroup
          accessibilityLabel={t('onboarding.plan.then')}
          options={ACTION_IDS.map((id) => ({ key: id, label: actionLabel(t, id) }))}
          selected={plan.action.kind === 'preset' ? plan.action.id : null}
          onSelect={(id) => update({ action: { kind: 'preset', id } })}
          last={
            <TextEntryRow
              embedded
              label={t('onboarding.plan.custom')}
              accessibilityHint={t('onboarding.plan.customHint')}
              value={text}
              maxLength={CUSTOM_TEXT_MAX_LENGTH}
              selected={customSelected}
              onChangeText={changeText}
              onFocus={selectCustom}
              onBlur={onTypingEnd}
            />
          }
        />
      </View>
      <View style={styles.sentence}>
        <Text style={styles.sentenceText}>{planSentence(t, plan)}</Text>
      </View>
      <OptionSheet
        visible={choosingTrigger}
        title={t('onboarding.plan.triggerTitle')}
        closeLabel={t('onboarding.close')}
        options={triggers.map((trigger) => ({ key: trigger, label: planCondition(t, trigger) }))}
        selected={plan.trigger}
        onSelect={(trigger) => update({ trigger })}
        onClose={() => setChoosingTrigger(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.m,
  },
  // The whole plan as it will read on the emergency screen.
  sentence: {
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.accentSurface,
  },
  sentenceText: {
    ...typography.quote,
    color: colors.text,
  },
});
