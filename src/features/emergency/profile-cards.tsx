import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Plan, Reason } from '@/domain/onboarding';
import { planSentence, reasonLabel } from '@/features/shared/preset-labels';
import { SectionLabel } from '@/ui/section-label';
import { colors, radii, spacing, typography } from '@/ui/theme';

// One sentence per plan, in their order, on the plan card.
export function PlansCard({ plans }: { plans: readonly Plan[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t(plans.length > 1 ? 'emergency.plans' : 'emergency.plan')}</Text>
      {/* The list is only read here, and two plans can read the same, so the index is the key. */}
      {plans.map((plan, index) => (
        <Text key={index} style={styles.plan}>
          {planSentence(t, plan)}
        </Text>
      ))}
    </View>
  );
}

// One pill per reason, under their label.
export function ReasonsList({ reasons }: { reasons: readonly Reason[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.reasons}>
      <SectionLabel color={colors.accentText}>{t('emergency.reasons')}</SectionLabel>
      {reasons.map((reason, index) => (
        <View key={reason.kind === 'preset' ? reason.id : `custom-${index}`} style={styles.reason}>
          <Text style={styles.reasonText}>
            {reason.kind === 'preset' ? reasonLabel(t, reason.id) : reason.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.s,
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.accentSurface,
  },
  label: {
    ...typography.sectionLabel,
    color: colors.teal,
  },
  plan: {
    ...typography.quote,
    color: colors.text,
  },
  reasons: {
    alignItems: 'flex-start',
    gap: spacing.s,
  },
  reason: {
    paddingHorizontal: spacing.chipHorizontal,
    paddingVertical: spacing.chipVertical,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  reasonText: {
    ...typography.bodyLarge,
    color: colors.text,
  },
});
