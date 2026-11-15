import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Plan } from '@/domain/onboarding';
import { planColumns } from '@/features/profile/labels';
import { colors, spacing, typography } from '@/ui/theme';

// "If / Then" in two columns. Screen readers read the row as the whole plan sentence instead, set
// on the row that holds it.
export function PlanRow({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const columns = planColumns(t, plan);
  return (
    <View style={styles.lines}>
      <View style={styles.line}>
        <Text style={styles.label}>{t('onboarding.plan.if')}</Text>
        <Text style={styles.when}>{columns.when}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.label}>{t('onboarding.plan.then')}</Text>
        <Text style={styles.then}>{columns.then}</Text>
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
  // Wide enough for "Alors" and "Then" at large text sizes, which wrap rather than truncate.
  label: {
    ...typography.body,
    width: 64,
    color: colors.textSecondary,
  },
  when: {
    ...typography.row,
    flex: 1,
    color: colors.text,
  },
  then: {
    ...typography.bodyLarge,
    flex: 1,
    color: colors.text,
  },
});
