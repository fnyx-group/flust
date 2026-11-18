import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { lapseSummary, type LapseSummary } from '@/domain/lapse';
import type { RankId } from '@/domain/ranks';
import type { Timestamp } from '@/domain/time';
import { useClock } from '@/features/clock/clock-context';
import {
  endedStreakCard,
  keptRank,
  totalCard,
  type SummaryCardText,
} from '@/features/lapse/labels';
import { RankEmblem } from '@/ui/rank-emblem';
import { colors, maxFontScale, radii, sizes, spacing, typography } from '@/ui/theme';

type LapseSummaryCardsProps = {
  // The journey before the lapse.
  journey: Journey;
  // Null for now.
  at: Timestamp | null;
  unlockedRanks: readonly RankId[];
};

// Follows the clock, so a lapse logged now shows the streak it really ends even when the screen
// stays open a while. Nothing shows when the time cannot be used: the error says why on save.
export function LapseSummaryCards({ journey, at, unlockedRanks }: LapseSummaryCardsProps) {
  const summary = useClock((now) => lapseSummary(journey, at ?? now, unlockedRanks, now));
  return summary.ok ? <SummaryCards summary={summary.value} /> : null;
}

// What the lapse keeps and what it ends, side by side. Never the record streak.
function SummaryCards({ summary }: { summary: LapseSummary }) {
  const { t } = useTranslation();
  const rank = keptRank(t, summary);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Card text={totalCard(t, summary)} kept />
        <Card text={endedStreakCard(t, summary)} />
      </View>
      {rank !== null && summary.rank !== null && (
        <View style={styles.rankCard}>
          <RankEmblem
            circle={summary.rank.circle}
            tier={summary.rank.tier}
            unlocked
            size={sizes.rankCardEmblem}
          />
          <Text style={styles.rank}>{rank}</Text>
        </View>
      )}
    </View>
  );
}

// The days kept read in teal, never in red: what stays is what matters here.
function Card({ text, kept = false }: { text: SummaryCardText; kept?: boolean }) {
  return (
    <View accessible accessibilityLabel={text.spoken} style={styles.card}>
      <Text
        maxFontSizeMultiplier={maxFontScale.lapseSummary}
        style={[styles.value, kept && styles.kept]}
      >
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
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  value: {
    ...typography.summaryNumber,
    color: colors.text,
  },
  kept: {
    color: colors.teal,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    padding: spacing.card,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.accentSurface,
  },
  caption: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rank: {
    ...typography.badgeName,
    fontSize: 17,
    flexShrink: 1,
    color: colors.text,
  },
});
