import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Plan, Reason } from '@/domain/onboarding';
import { planSentence, reasonLabel } from '@/features/shared/preset-labels';
import { Button } from '@/ui/button';
import { colors, radii, spacing, typography } from '@/ui/theme';

// One sentence per plan, in their order. The card offers to start a note when one of them is to
// write in the journal.
export function PlansCard({ plans, onWrite }: { plans: readonly Plan[]; onWrite?: () => void }) {
  const { t } = useTranslation();
  return (
    <Card label={t(plans.length > 1 ? 'emergency.plans' : 'emergency.plan')}>
      {/* The list is only read here, and two plans can read the same, so the index is the key. */}
      {plans.map((plan, index) => (
        <Text key={index} style={styles.text}>
          {planSentence(t, plan)}
        </Text>
      ))}
      {onWrite !== undefined && (
        <View style={styles.action}>
          <Button variant="secondary" label={t('emergency.writeNote')} onPress={onWrite} />
        </View>
      )}
    </Card>
  );
}

export function ReasonsCard({ reasons }: { reasons: readonly Reason[] }) {
  const { t } = useTranslation();
  return (
    <Card label={t('emergency.reasons')}>
      {reasons.map((reason, index) => (
        <Text key={reason.kind === 'preset' ? reason.id : `custom-${index}`} style={styles.text}>
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
    padding: spacing.card,
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
    ...typography.paragraph,
    color: colors.text,
  },
  action: {
    paddingTop: spacing.s,
  },
});
