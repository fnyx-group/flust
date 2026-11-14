import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankStanding, type RankId } from '@/domain/ranks';
import { useClock } from '@/features/home/clock-context';
import { rankCardText } from '@/features/home/labels';
import { sameFields } from '@/features/home/minute-clock';
import { ForwardIcon } from '@/ui/icons/forward-icon';
import { Meter } from '@/ui/meter';
import { RankEmblem } from '@/ui/rank-emblem';
import { colors, pressedOpacity, radii, spacing, typography } from '@/ui/theme';

type RankCardProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

// Ranks reached here are not stored: the unlock screen stores a rank when it shows it, so that
// unlocked and announced stay the same thing. Until then the total alone gives the right rank.
// With a rank, the standing only changes once a day, so ticks in between do not re-render.
export function RankCard({ journey, unlockedRanks }: RankCardProps) {
  const { t } = useTranslation();
  const standing = useClock((now) => rankStanding(journey, unlockedRanks, now), sameFields);
  const text = rankCardText(t, standing);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.spokenLabel}
      accessibilityHint={t('home.rank.hint')}
      onPress={() => router.navigate('/ranks')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <RankEmblem circle={text.rank.circle} tier={text.rank.tier} unlocked={text.unlocked} />
        <View style={styles.titles}>
          <Text style={typography.sectionLabel}>{text.eyebrow}</Text>
          <Text style={styles.name}>{text.name}</Text>
        </View>
        <ForwardIcon color={colors.textSecondary} />
      </View>
      <Meter fraction={standing.fraction} />
      <View style={styles.footer}>
        <Text style={styles.progress}>{text.progress}</Text>
        <Text style={styles.target}>{text.target}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    padding: spacing.screen,
    gap: spacing.l,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  titles: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.rankName,
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.m,
    rowGap: spacing.xs,
  },
  progress: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  target: {
    ...typography.row,
    color: colors.text,
  },
});
