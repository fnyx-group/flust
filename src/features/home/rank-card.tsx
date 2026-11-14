import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { rankProgress, rankStanding, type RankId } from '@/domain/ranks';
import { currentStreakMs, totalCleanDays } from '@/domain/streak';
import type { Timestamp } from '@/domain/time';
import { useClock } from '@/features/home/clock-context';
import { rankCardText } from '@/features/home/labels';
import { ForwardIcon } from '@/ui/icons/forward-icon';
import { Meter } from '@/ui/meter';
import { RankEmblem } from '@/ui/rank-emblem';
import { colors, radii, spacing, typography } from '@/ui/theme';

type RankCardProps = {
  journey: Journey;
  unlockedRanks: readonly RankId[];
};

const identity = (now: Timestamp) => now;

// Ranks reached here are not stored: the unlock screen stores a rank when it shows it, so that
// unlocked and announced stay the same thing. Until then the total alone gives the right rank.
export function RankCard({ journey, unlockedRanks }: RankCardProps) {
  const { t } = useTranslation();
  const now = useClock(identity);
  const total = totalCleanDays(journey, now);
  const standing = rankStanding(
    rankProgress(unlockedRanks, total),
    total,
    currentStreakMs(journey, now),
  );
  const text = rankCardText(t, standing);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[text.name, text.eyebrow].join(', ')}
      accessibilityValue={{ text: text.spokenProgress }}
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
    gap: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.rankName,
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
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
