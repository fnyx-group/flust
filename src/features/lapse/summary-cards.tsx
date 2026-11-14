import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LapseSummary } from '@/domain/lapse';
import {
  endedStreakCard,
  keptRank,
  totalCard,
  type SummaryCardText,
} from '@/features/lapse/labels';
import { colors, radii, spacing, typography } from '@/ui/theme';

// What the lapse keeps and what it ends, side by side. Never the record streak.
export function SummaryCards({ summary }: { summary: LapseSummary }) {
  const { t } = useTranslation();
  const rank = keptRank(t, summary);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Card text={totalCard(t, summary)} />
        <Card text={endedStreakCard(t, summary)} />
      </View>
      {rank !== null && <Text style={styles.rank}>{rank}</Text>}
    </View>
  );
}

function Card({ text }: { text: SummaryCardText }) {
  return (
    <View accessible accessibilityLabel={text.spoken} style={styles.card}>
      <Text maxFontSizeMultiplier={1.2} style={styles.value}>
        {text.value}
      </Text>
      <Text style={styles.caption}>{text.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.m,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  card: {
    flex: 1,
    gap: spacing.xs,
    padding: 20,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  value: {
    ...typography.summaryNumber,
    color: colors.text,
  },
  caption: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rank: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
