import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { currentRankText } from '@/features/ranks/labels';
import { RankEmblem } from '@/ui/rank-emblem';
import { RankStars } from '@/ui/rank-stars';
import { colors, radii, sizes, spacing, typography } from '@/ui/theme';

type CurrentRankCardProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

export function CurrentRankCard({ journey, unlockedRanks }: CurrentRankCardProps) {
  const { t } = useTranslation();
  const standing = useClock((now) => rankStanding(journey, unlockedRanks, now), sameFields);
  const text = currentRankText(t, standing);
  return (
    <View accessible accessibilityLabel={text.spokenLabel} style={styles.card}>
      <RankEmblem
        circle={text.rank.circle}
        tier={text.rank.tier}
        unlocked={text.unlocked}
        size={sizes.currentRankEmblem}
      />
      <View style={styles.texts}>
        <View style={styles.circleRow}>
          <Text style={typography.sectionLabel}>{text.circle}</Text>
          <RankStars
            circle={text.rank.circle}
            color={text.unlocked ? colors.text : colors.locked}
          />
        </View>
        <Text style={styles.name}>{text.name}</Text>
        <Text style={styles.detail}>{text.detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    padding: spacing.screen,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  texts: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  circleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.s,
  },
  name: {
    ...typography.rankName,
    color: colors.text,
  },
  detail: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
