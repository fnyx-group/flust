import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Plan } from '@/domain/onboarding';
import { planColumns } from '@/features/profile/labels';
import { colors, spacing, typography } from '@/ui/theme';
import { useLargeText } from '@/ui/use-large-text';

// "If / Then" in two columns. Screen readers read the row as the whole plan sentence instead, set
// on the row that holds it.
export function PlanRow({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  // With large text, "Alors" no longer fits its column and a single word cannot wrap, so each
  // label goes above its text instead.
  const stacked = useLargeText();
  const columns = planColumns(t, plan);
  const line = stacked ? styles.stackedLine : styles.line;
  const label = stacked ? styles.label : [styles.label, styles.column];
  // Flexing only in a row: in a stacked column with no height, it could squash the text.
  const fill = stacked ? null : styles.fill;
  return (
    <View style={styles.lines}>
      <View style={line}>
        <Text style={label}>{t('onboarding.plan.if')}</Text>
        <Text style={[styles.when, fill]}>{columns.when}</Text>
      </View>
      <View style={line}>
        <Text style={label}>{t('onboarding.plan.then')}</Text>
        <Text style={[styles.then, fill]}>{columns.then}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lines: {
    gap: spacing.s,
  },
  line: {
    flexDirection: 'row',
    gap: spacing.l,
  },
  stackedLine: {
    gap: spacing.xxs,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Wide enough for "Alors" and "Then" up to the stacked text scale.
  column: {
    width: 64,
  },
  fill: {
    flex: 1,
  },
  when: {
    ...typography.row,
    color: colors.text,
  },
  then: {
    ...typography.bodyLarge,
    color: colors.text,
  },
});
