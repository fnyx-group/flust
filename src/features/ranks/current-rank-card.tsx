import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { currentRankText } from '@/features/ranks/labels';
import { RankEmblem } from '@/ui/rank-emblem';
import { circleTextColors, colors, radii, sizes, spacing, typography } from '@/ui/theme';

type CurrentRankCardProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

export function CurrentRankCard({ journey, unlockedRanks }: CurrentRankCardProps) {
  const { t } = useTranslation();
  const standing = useClock((now) => rankStanding(journey, unlockedRanks, now), sameFields);
  const text = currentRankText(t, standing);
  const fill = `${Math.round(Math.min(1, Math.max(0, standing.fraction)) * 100)}%` as const;
  return (
    <View accessible accessibilityLabel={text.spokenLabel} style={styles.card}>
      <View style={styles.top}>
        <RankEmblem
          circle={text.rank.circle}
          tier={text.rank.tier}
          unlocked={text.unlocked}
          size={sizes.currentRankEmblem}
        />
        <View style={styles.texts}>
          <Text
            style={[
              styles.circle,
              { color: text.unlocked ? circleTextColors[text.rank.circle] : colors.textSecondary },
            ]}
          >
            {text.circle}
          </Text>
          <Text style={styles.name}>{text.name}</Text>
          <Text style={styles.detail}>{text.detail}</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.bar, { width: fill }]} />
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{text.total}</Text>
        {text.target !== null && <Text style={[styles.end, styles.target]}>{text.target}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.l,
    padding: spacing.screen,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.accentSurface,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  texts: {
    flexShrink: 1,
    gap: spacing.xxs,
  },
  circle: {
    ...typography.row,
  },
  name: {
    ...typography.screenTitle,
    color: colors.text,
  },
  detail: {
    ...typography.body,
    color: colors.textSecondary,
  },
  track: {
    height: sizes.rankProgressHeight,
    borderRadius: sizes.rankProgressHeight / 2,
    overflow: 'hidden',
    backgroundColor: colors.separator,
  },
  bar: {
    height: '100%',
    borderRadius: sizes.rankProgressHeight / 2,
    backgroundColor: colors.accent,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.s,
  },
  end: {
    ...typography.body,
    color: colors.textSecondary,
  },
  target: {
    textAlign: 'right',
  },
});
