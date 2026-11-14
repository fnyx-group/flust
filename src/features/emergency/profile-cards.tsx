import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Plan, Reason } from '@/domain/onboarding';
import { planSentence, reasonLabel } from '@/features/shared/preset-labels';
import { colors, radii, spacing, typography } from '@/ui/theme';

export function PlanCard({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  return (
    <Card label={t('emergency.plan')}>
      <Text style={styles.text}>{planSentence(t, plan)}</Text>
    </Card>
  );
}

export function ReasonsCard({ reasons }: { reasons: readonly Reason[] }) {
  const { t } = useTranslation();
  return (
    <Card label={t('emergency.reasons')}>
      {reasons.map((reason) => (
        <Text
          key={reason.kind === 'preset' ? reason.id : `custom-${reason.text}`}
          style={styles.text}
        >
          {reason.kind === 'preset' ? reasonLabel(t, reason.id) : reason.text}
        </Text>
      ))}
    </Card>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.s,
    padding: 20,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.sectionLabel,
  },
  content: {
    gap: spacing.s,
  },
  text: {
    ...typography.bodyLarge,
    lineHeight: 24,
    color: colors.text,
  },
});
